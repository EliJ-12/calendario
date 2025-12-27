import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { storage } from "./storage.js";
import { setupAuth } from "./auth.js";
import { api } from "../shared/routes.js";
import { z } from "zod";
import { insertUserSchema, insertCalendarEventSchema, insertSharedEventSchema, insertEventCommentSchema } from "../shared/schema.js";
import { createClient } from '@supabase/supabase-js';

import { db } from "./db.js";
import { users, calendarEvents, sharedEvents, eventComments } from "../shared/schema.js";
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
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('absence-files')
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
        .from('absence-files')
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
  app.get(api.calendarEvents.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const user = req.user as any;
    const userId = user.role === 'admin' && req.query.userId ? 
      Number(req.query.userId) : user.id;

    const conditions = [];
    if (userId !== undefined) conditions.push(eq(calendarEvents.userId, userId));
    if (req.query.startDate) conditions.push(gte(calendarEvents.eventDate, req.query.startDate as string));
    if (req.query.endDate) conditions.push(lte(calendarEvents.eventDate, req.query.endDate as string));
    if (req.query.category) conditions.push(eq(calendarEvents.category, req.query.category as any));

    let query = db.select().from(calendarEvents);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const events = await query.orderBy(desc(calendarEvents.eventDate));
    res.json(events);
  });

  app.post(api.calendarEvents.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const input = insertCalendarEventSchema.parse(req.body);
      
      const event = await db.insert(calendarEvents).values({
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

  app.patch(api.calendarEvents.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const [existing] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
    
    if (!existing) return res.status(404).json({ message: "Not found" });
    
    const user = req.user as any;
    if (user.role !== 'admin' && existing.userId !== user.id) {
      return res.status(403).json({ message: "Cannot edit this event" });
    }

    const [updated] = await db.update(calendarEvents)
      .set(req.body)
      .where(eq(calendarEvents.id, id))
      .returning();
    
    res.json(updated);
  });

  app.delete(api.calendarEvents.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const [existing] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
    
    if (!existing) return res.status(404).json({ message: "Not found" });
    
    const user = req.user as any;
    if (user.role !== 'admin' && existing.userId !== user.id) {
      return res.status(403).json({ message: "Cannot delete this event" });
    }

    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
    res.sendStatus(204);
  });

  // === Shared Events ===
  app.get(api.sharedEvents.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });

    // Get basic shared events with original event info
    const sharedEventsList = await db
      .select({
        id: sharedEvents.id,
        originalEventId: sharedEvents.originalEventId,
        sharedByUserId: sharedEvents.sharedByUserId,
        sharedAt: sharedEvents.sharedAt,
        isActive: sharedEvents.isActive,
      })
      .from(sharedEvents)
      .where(eq(sharedEvents.isActive, true))
      .orderBy(desc(sharedEvents.sharedAt));

    // Get detailed info for each shared event
    const eventsWithDetails = await Promise.all(
      sharedEventsList.map(async (sharedEvent) => {
        // Get original event with user info
        const [originalEvent] = await db
          .select({
            id: calendarEvents.id,
            title: calendarEvents.title,
            description: calendarEvents.description,
            category: calendarEvents.category,
            eventDate: calendarEvents.eventDate,
            eventTime: calendarEvents.eventTime,
            userId: calendarEvents.userId,
            isShared: calendarEvents.isShared,
            createdAt: calendarEvents.createdAt,
            updatedAt: calendarEvents.updatedAt,
            user: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              role: users.role,
              createdAt: users.createdAt,
              updatedAt: users.updatedAt,
            }
          })
          .from(calendarEvents)
          .innerJoin(users, eq(calendarEvents.userId, users.id))
          .where(eq(calendarEvents.id, sharedEvent.originalEventId));

        // Get shared by user info
        const [sharedByUser] = await db
          .select({
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            role: users.role,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          })
          .from(users)
          .where(eq(users.id, sharedEvent.sharedByUserId));

        // Get comments
        const comments = await db
          .select({
            id: eventComments.id,
            comment: eventComments.comment,
            createdAt: eventComments.createdAt,
            user: {
              id: users.id,
              username: users.username,
              fullName: users.fullName,
              role: users.role,
            }
          })
          .from(eventComments)
          .innerJoin(users, eq(eventComments.userId, users.id))
          .where(eq(eventComments.sharedEventId, sharedEvent.id))
          .orderBy(eventComments.createdAt);

        return {
          ...sharedEvent,
          originalEvent: originalEvent,
          sharedByUser: sharedByUser,
          comments
        };
      })
    );

    res.json(eventsWithDetails);
  });

  app.post(api.sharedEvents.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const { originalEventId } = req.body;
      const userId = (req.user as any).id;
      
      // Check if the original event exists and belongs to the user
      const [originalEvent] = await db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.id, originalEventId));
      
      if (!originalEvent) {
        return res.status(404).json({ message: "Original event not found" });
      }
      
      if (originalEvent.userId !== userId) {
        return res.status(403).json({ message: "Cannot share events that don't belong to you" });
      }
      
      // Check if already shared
      const [existingShared] = await db
        .select()
        .from(sharedEvents)
        .where(and(
          eq(sharedEvents.originalEventId, originalEventId),
          eq(sharedEvents.sharedByUserId, userId),
          eq(sharedEvents.isActive, true)
        ));
      
      if (existingShared) {
        return res.status(409).json({ message: "Event already shared" });
      }
      
      const [sharedEvent] = await db.insert(sharedEvents)
        .values({
          originalEventId,
          sharedByUserId: userId
        })
        .returning();
      
      // Mark the original event as shared
      await db.update(calendarEvents)
        .set({ isShared: true })
        .where(eq(calendarEvents.id, originalEventId));
      
      res.status(201).json(sharedEvent);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.sharedEvents.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const [existing] = await db.select().from(sharedEvents).where(eq(sharedEvents.id, id));
    
    if (!existing) return res.status(404).json({ message: "Not found" });
    
    const user = req.user as any;
    if (user.role !== 'admin' && existing.sharedByUserId !== user.id) {
      return res.status(403).json({ message: "Cannot delete this shared event" });
    }

    await db.update(sharedEvents)
      .set({ isActive: false })
      .where(eq(sharedEvents.id, id));
    
    // Check if there are any other active shares for this event
    const [otherShares] = await db
      .select()
      .from(sharedEvents)
      .where(and(
        eq(sharedEvents.originalEventId, existing.originalEventId),
        eq(sharedEvents.isActive, true)
      ));
    
    if (!otherShares) {
      // Mark the original event as not shared
      await db.update(calendarEvents)
        .set({ isShared: false })
        .where(eq(calendarEvents.id, existing.originalEventId));
    }
    
    res.sendStatus(204);
  });

  // === Event Comments ===
  app.post(api.eventComments.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const input = insertEventCommentSchema.parse(req.body);
      
      // Verify the shared event exists and is active
      const [sharedEvent] = await db
        .select()
        .from(sharedEvents)
        .where(and(
          eq(sharedEvents.id, input.sharedEventId),
          eq(sharedEvents.isActive, true)
        ));
      
      if (!sharedEvent) {
        return res.status(404).json({ message: "Shared event not found" });
      }
      
      const [comment] = await db.insert(eventComments)
        .values({
          ...input,
          userId: (req.user as any).id
        })
        .returning();
      
      res.status(201).json(comment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.eventComments.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const [existing] = await db.select().from(eventComments).where(eq(eventComments.id, id));
    
    if (!existing) return res.status(404).json({ message: "Not found" });
    
    const user = req.user as any;
    if (user.role !== 'admin' && existing.userId !== user.id) {
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
