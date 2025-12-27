import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { storage } from "./storage.js";
import { setupAuth } from "./auth.js";
import { api } from "../shared/routes.js";
import { z } from "zod";
import { insertUserSchema, insertEventSchema, insertSharedEventSchema, insertEventCommentSchema } from "../shared/schema.js";
import { createClient } from '@supabase/supabase-js';

import { db } from "./db.js";
import { users, events, sharedEvents, eventComments } from "../shared/schema.js";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth
  const { hashPassword } = await setupAuth(app);

  // Initialize Supabase client with multiple possible environment variable names
  const supabaseUrl = process.env.SUPABASE_URL || 
                        process.env.NEXT_PUBLIC_SUPABASE_URL || 
                        process.env.VITE_SUPABASE_URL || '';
  
  const supabaseKey = process.env.SUPABASE_ANON_KEY || 
                       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                       process.env.VITE_SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables. Available env vars:', {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      VITE_SUPABASE_ANON_KEY: !!process.env.VITE_SUPABASE_ANON_KEY
    });
    throw new Error('Supabase configuration is missing. Please check your environment variables.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'));
      }
    }
  });

  // File upload endpoint with Supabase Storage
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    console.log('Upload request received');
    
    if (!req.isAuthenticated()) {
      console.log('User not authenticated');
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ message: "No file uploaded" });
    }

    try {
      const userId = (req.user as any).id;
      const originalName = req.file.originalname;
      
      console.log('Processing upload:', {
        userId,
        originalName,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      });
      
      // Clean file name: replace spaces with hyphens, remove special characters
      const cleanFileName = originalName
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9.-]/g, '');
      
      // Create organized path with user folder and timestamp
      const timestamp = Date.now();
      const filePath = `${userId}/${timestamp}-${cleanFileName}`;
      
      console.log('Uploading to path:', filePath);
      
      // Upload to Supabase Storage (for potential future file attachments)
      const { data, error } = await supabase.storage
        .from('calendar-files')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw new Error('Failed to upload file to Supabase Storage: ' + error.message);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('calendar-files')
        .getPublicUrl(filePath);

      console.log('Upload successful, public URL:', publicUrl);
      res.json({ fileUrl: publicUrl });
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({ message: "Failed to upload file: " + errorMessage });
    }
  });

  // === User Management (Admin Only ideally, but open for now for setup) ===
  app.get(api.users.list.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.post(api.users.create.path, async (req, res) => {
    // Only admins can create users, or if no users exist (initial setup)
    const allUsers = await storage.getAllUsers();
    const isAdmin = req.isAuthenticated() && (req.user as any).role === 'admin';
    
    if (allUsers.length > 0 && !isAdmin) {
       return res.status(401).json({ message: "Unauthorized. Only admins can create users." });
    }

    try {
      const input = insertUserSchema.parse(req.body);
      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({
        ...input,
        password: hashedPassword,
      });
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // === Calendar Events ===
  app.get("/api/events", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const user = req.user as any;
    const userId = user.id;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    let query = db.select().from(events).where(eq(events.userId, userId));
    
    if (startDate && endDate) {
      query = db.select().from(events).where(and(
        eq(events.userId, userId),
        gte(events.date, startDate),
        lte(events.date, endDate)
      ));
    }
    
    const eventsList = await query.orderBy(desc(events.date));
    res.json(eventsList);
  });

  app.post("/api/events", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const input = insertEventSchema.parse(req.body);
      
      const event = await db.insert(events).values({
        ...input,
        userId: (req.user as any).id
      }).returning();
      
      res.status(201).json(event[0]);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch("/api/events/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const existing = await db.select().from(events).where(eq(events.id, id)).limit(1);
    
    if (!existing.length) return res.status(404).json({ message: "Event not found" });
    
    const user = req.user as any;
    if (existing[0].userId !== user.id) {
      return res.status(403).json({ message: "Cannot edit this event" });
    }

    const updated = await db.update(events)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    
    res.json(updated[0]);
  });

  app.delete("/api/events/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const existing = await db.select().from(events).where(eq(events.id, id)).limit(1);
    
    if (!existing.length) return res.status(404).json({ message: "Event not found" });
    
    const user = req.user as any;
    if (existing[0].userId !== user.id) {
      return res.status(403).json({ message: "Cannot delete this event" });
    }

    await db.delete(events).where(eq(events.id, id));
    res.sendStatus(204);
  });

  // === Shared Events ===
  app.get("/api/shared-events", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const sharedEventsList = await db
      .select({
        sharedEvent: sharedEvents,
        event: events,
        sharedBy: users,
      })
      .from(sharedEvents)
      .innerJoin(events, eq(sharedEvents.eventId, events.id))
      .innerJoin(users, eq(sharedEvents.sharedBy, users.id))
      .orderBy(desc(sharedEvents.sharedAt));
    
    res.json(sharedEventsList);
  });

  app.post("/api/shared-events", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const input = insertSharedEventSchema.parse(req.body);
      const user = req.user as any;
      
      // Check if user owns the event
      const event = await db.select().from(events).where(eq(events.id, input.eventId)).limit(1);
      if (!event.length || event[0].userId !== user.id) {
        return res.status(403).json({ message: "Cannot share this event" });
      }
      
      // Check if already shared
      const alreadyShared = await db.select().from(sharedEvents)
        .where(and(eq(sharedEvents.eventId, input.eventId), eq(sharedEvents.sharedBy, user.id)))
        .limit(1);
      
      if (alreadyShared.length) {
        return res.status(409).json({ message: "Event already shared" });
      }
      
      const sharedEvent = await db.insert(sharedEvents).values({
        ...input,
        sharedBy: user.id
      }).returning();
      
      res.status(201).json(sharedEvent[0]);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/shared-events/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const user = req.user as any;
    
    // Check if user owns the shared event (can only unshare their own)
    const existing = await db
      .select({
        sharedEvent: sharedEvents,
        event: events
      })
      .from(sharedEvents)
      .innerJoin(events, eq(sharedEvents.eventId, events.id))
      .where(eq(sharedEvents.id, id))
      .limit(1);
    
    if (!existing.length) return res.status(404).json({ message: "Shared event not found" });
    if (existing[0].event.userId !== user.id) {
      return res.status(403).json({ message: "Cannot unshare this event" });
    }

    await db.delete(sharedEvents).where(eq(sharedEvents.id, id));
    res.sendStatus(204);
  });

  // === Event Comments ===
  app.get("/api/events/:eventId/comments", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const eventId = Number(req.params.eventId);
    
    // Check if event is shared
    const isShared = await db.select().from(sharedEvents).where(eq(sharedEvents.eventId, eventId)).limit(1);
    if (!isShared.length) {
      return res.status(403).json({ message: "Event is not shared" });
    }
    
    const comments = await db
      .select({
        comment: eventComments,
        user: users
      })
      .from(eventComments)
      .innerJoin(users, eq(eventComments.userId, users.id))
      .where(eq(eventComments.eventId, eventId))
      .orderBy(desc(eventComments.createdAt));
    
    res.json(comments);
  });

  app.post("/api/events/:eventId/comments", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const eventId = Number(req.params.eventId);
      const { comment } = req.body;
      const user = req.user as any;
      
      // Check if event is shared
      const isShared = await db.select().from(sharedEvents).where(eq(sharedEvents.eventId, eventId)).limit(1);
      if (!isShared.length) {
        return res.status(403).json({ message: "Event is not shared" });
      }
      
      const newComment = await db.insert(eventComments).values({
        eventId,
        userId: user.id,
        comment
      }).returning();
      
      res.status(201).json(newComment[0]);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch("/api/comments/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const user = req.user as any;
    
    const existing = await db.select().from(eventComments).where(eq(eventComments.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ message: "Comment not found" });
    if (existing[0].userId !== user.id) {
      return res.status(403).json({ message: "Cannot edit this comment" });
    }

    const updated = await db.update(eventComments)
      .set({ comment: req.body.comment })
      .where(eq(eventComments.id, id))
      .returning();
    
    res.json(updated[0]);
  });

  app.delete("/api/comments/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const user = req.user as any;
    
    const existing = await db.select().from(eventComments).where(eq(eventComments.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ message: "Comment not found" });
    if (existing[0].userId !== user.id) {
      return res.status(403).json({ message: "Cannot delete this comment" });
    }

    await db.delete(eventComments).where(eq(eventComments.id, id));
    res.sendStatus(204);
  });

  app.delete("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = Number(req.params.id);
    await db.delete(users).where(eq(users.id, id));
    res.sendStatus(204);
  });

  app.patch("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = Number(req.params.id);
    const [updated] = await db.update(users).set(req.body).where(eq(users.id, id)).returning();
    res.json(updated);
  });

  return httpServer;
}
