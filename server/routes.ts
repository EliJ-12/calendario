import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { storage } from "./storage.js";
import { setupAuth } from "./auth.js";
import { api } from "../shared/routes.js";
import { z } from "zod";
import { insertUserSchema, insertPersonalEventSchema, insertSharedEventSchema, insertSharedEventCommentSchema } from "../shared/schema.js";
import { createClient } from '@supabase/supabase-js';

import { db } from "./db.js";
import { users, personalEvents, sharedEvents, sharedEventComments, eventCategories } from "../shared/schema.js";
import { eq, and, gte, lte } from "drizzle-orm";

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

  // === Event Categories ===
  app.get(api.eventCategories.list.path, async (req, res) => {
    try {
      const categories = await db.select().from(eventCategories);
      res.json(categories);
    } catch (error) {
      console.error('Error fetching event categories:', error);
      res.status(500).json({ message: "Failed to fetch event categories" });
    }
  });

  // === Personal Events ===
  app.get(api.personalEvents.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const user = req.user as any;
    let userId = user.id;
    
    if (user.role === 'admin' && req.query.userId) {
      userId = Number(req.query.userId);
    }

    try {
      const baseQuery = db.select({
        id: personalEvents.id,
        userId: personalEvents.userId,
        categoryId: personalEvents.categoryId,
        title: personalEvents.title,
        description: personalEvents.description,
        date: personalEvents.date,
        time: personalEvents.time,
        isAllDay: personalEvents.isAllDay,
        createdAt: personalEvents.createdAt,
        updatedAt: personalEvents.updatedAt,
        user: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          role: users.role,
          createdAt: users.createdAt
        },
        category: {
          id: eventCategories.id,
          name: eventCategories.name,
          color: eventCategories.color,
          createdAt: eventCategories.createdAt
        }
      })
      .from(personalEvents)
      .leftJoin(users, eq(personalEvents.userId, users.id))
      .leftJoin(eventCategories, eq(personalEvents.categoryId, eventCategories.id));

      let events;
      if (req.query.startDate && req.query.endDate) {
        events = await baseQuery.where(
          and(
            eq(personalEvents.userId, userId),
            gte(personalEvents.date, req.query.startDate as string),
            lte(personalEvents.date, req.query.endDate as string)
          )
        );
      } else {
        events = await baseQuery.where(eq(personalEvents.userId, userId));
      }

      res.json(events);
    } catch (error) {
      console.error('Error fetching personal events:', error);
      res.status(500).json({ message: "Failed to fetch personal events" });
    }
  });

  app.post(api.personalEvents.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const input = insertPersonalEventSchema.parse(req.body);
      const event = await db.insert(personalEvents).values({
        ...input,
        userId: (req.user as any).id
      }).returning();
      res.status(201).json(event[0]);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Error creating personal event:', err);
      res.status(500).json({ message: "Failed to create personal event" });
    }
  });

  app.patch(api.personalEvents.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const existing = await db.select().from(personalEvents).where(eq(personalEvents.id, id)).limit(1);
    
    if (!existing.length) return res.status(404).json({ message: "Event not found" });
    
    const user = req.user as any;
    if (user.role !== 'admin' && existing[0].userId !== user.id) {
      return res.status(403).json({ message: "Cannot edit this event" });
    }

    try {
      const updated = await db.update(personalEvents)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(personalEvents.id, id))
        .returning();
      res.json(updated[0]);
    } catch (error) {
      console.error('Error updating personal event:', error);
      res.status(500).json({ message: "Failed to update personal event" });
    }
  });

  app.delete(api.personalEvents.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const existing = await db.select().from(personalEvents).where(eq(personalEvents.id, id)).limit(1);
    
    if (!existing.length) return res.status(404).json({ message: "Event not found" });
    
    const user = req.user as any;
    if (user.role !== 'admin' && existing[0].userId !== user.id) {
      return res.status(403).json({ message: "Cannot delete this event" });
    }

    try {
      await db.delete(personalEvents).where(eq(personalEvents.id, id));
      res.sendStatus(204);
    } catch (error) {
      console.error('Error deleting personal event:', error);
      res.status(500).json({ message: "Failed to delete personal event" });
    }
  });

  // === Shared Events ===
  app.get(api.sharedEvents.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });

    try {
      const events = await db.select({
        id: sharedEvents.id,
        originalEventId: sharedEvents.originalEventId,
        sharedByUserId: sharedEvents.sharedByUserId,
        title: sharedEvents.title,
        description: sharedEvents.description,
        date: sharedEvents.date,
        time: sharedEvents.time,
        isAllDay: sharedEvents.isAllDay,
        categoryId: sharedEvents.categoryId,
        createdAt: sharedEvents.createdAt,
        updatedAt: sharedEvents.updatedAt,
        sharedByUser: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          role: users.role,
          createdAt: users.createdAt
        },
        category: {
          id: eventCategories.id,
          name: eventCategories.name,
          color: eventCategories.color,
          createdAt: eventCategories.createdAt
        }
      })
      .from(sharedEvents)
      .leftJoin(users, eq(sharedEvents.sharedByUserId, users.id))
      .leftJoin(eventCategories, eq(sharedEvents.categoryId, eventCategories.id));

      res.json(events);
    } catch (error) {
      console.error('Error fetching shared events:', error);
      res.status(500).json({ message: "Failed to fetch shared events" });
    }
  });

  app.post(api.sharedEvents.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const input = insertSharedEventSchema.parse(req.body);
      const event = await db.insert(sharedEvents).values({
        ...input,
        sharedByUserId: (req.user as any).id
      }).returning();
      res.status(201).json(event[0]);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Error creating shared event:', err);
      res.status(500).json({ message: "Failed to create shared event" });
    }
  });

  app.patch(api.sharedEvents.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const existing = await db.select().from(sharedEvents).where(eq(sharedEvents.id, id)).limit(1);
    
    if (!existing.length) return res.status(404).json({ message: "Event not found" });
    
    const user = req.user as any;
    if (existing[0].sharedByUserId !== user.id) {
      return res.status(403).json({ message: "Cannot edit this event" });
    }

    try {
      const updated = await db.update(sharedEvents)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(sharedEvents.id, id))
        .returning();
      res.json(updated[0]);
    } catch (error) {
      console.error('Error updating shared event:', error);
      res.status(500).json({ message: "Failed to update shared event" });
    }
  });

  app.delete(api.sharedEvents.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const existing = await db.select().from(sharedEvents).where(eq(sharedEvents.id, id)).limit(1);
    
    if (!existing.length) return res.status(404).json({ message: "Event not found" });
    
    const user = req.user as any;
    if (existing[0].sharedByUserId !== user.id) {
      return res.status(403).json({ message: "Cannot delete this event" });
    }

    try {
      await db.delete(sharedEvents).where(eq(sharedEvents.id, id));
      res.sendStatus(204);
    } catch (error) {
      console.error('Error deleting shared event:', error);
      res.status(500).json({ message: "Failed to delete shared event" });
    }
  });

  // === Shared Event Comments ===
  app.post(api.sharedEventComments.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const eventId = Number(req.params.eventId);
      const input = insertSharedEventCommentSchema.parse(req.body);
      const comment = await db.insert(sharedEventComments).values({
        ...input,
        sharedEventId: eventId,
        userId: (req.user as any).id
      }).returning();
      res.status(201).json(comment[0]);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Error creating comment:', err);
      res.status(500).json({ message: "Failed to create comment" });
    }
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
