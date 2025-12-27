import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { storage } from "./storage.js";
import { setupAuth } from "./auth-supabase.js";
import { api } from "../shared/routes.js";
import { z } from "zod";
import { insertUserSchema, insertCalendarEventSchema, insertEventCommentSchema } from "../shared/schema.js";
import { createClient } from '@supabase/supabase-js';

import { db } from "./db.js";
import { users, calendarEvents, eventComments } from "../shared/schema.js";
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

  // === CALENDAR EVENTS ROUTES ===

  // Get all events for a user (with optional date filtering)
  app.get("/api/calendar/events", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const user = req.user as any;
    const { startDate, endDate } = req.query;
    
    let events;
    if (startDate && endDate) {
      events = await db.select().from(calendarEvents)
        .where(and(
          eq(calendarEvents.userId, user.id),
          gte(calendarEvents.date, startDate as string),
          lte(calendarEvents.date, endDate as string)
        ))
        .orderBy(calendarEvents.date);
    } else {
      events = await db.select().from(calendarEvents)
        .where(eq(calendarEvents.userId, user.id))
        .orderBy(calendarEvents.date);
    }
    
    res.json(events);
  });

  // Get a single event
  app.get("/api/calendar/events/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const event = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).limit(1);
    
    if (!event.length) return res.status(404).json({ message: "Event not found" });
    
    const user = req.user as any;
    if (event[0].userId !== user.id && !event[0].isShared) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.json(event[0]);
  });

  // Create an event
  app.post("/api/calendar/events", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const eventData = insertCalendarEventSchema.parse(req.body);
      
      // Assign color based on category
      const categoryColors = {
        examen: "#EF4444",
        entrega: "#F59E0B", 
        presentacion: "#8B5CF6",
        evento_trabajo: "#FF3E40",
        evento_universidad: "#10B981"
      };
      
      const finalData = {
        ...eventData,
        color: categoryColors[eventData.category as keyof typeof categoryColors],
        userId: (req.user as any).id
      };
      
      const [event] = await db.insert(calendarEvents).values(finalData).returning();
      res.status(201).json(event);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Update an event
  app.patch("/api/calendar/events/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const existingEvent = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).limit(1);
    
    if (!existingEvent.length) return res.status(404).json({ message: "Event not found" });
    
    const user = req.user as any;
    if (existingEvent[0].userId !== user.id && existingEvent[0].sharedBy !== user.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const [updated] = await db.update(calendarEvents).set(req.body).where(eq(calendarEvents.id, id)).returning();
    res.json(updated);
  });

  // Delete an event
  app.delete("/api/calendar/events/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const existingEvent = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).limit(1);
    
    if (!existingEvent.length) return res.status(404).json({ message: "Event not found" });
    
    const user = req.user as any;
    if (existingEvent[0].userId !== user.id && existingEvent[0].sharedBy !== user.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
    res.sendStatus(204);
  });

  // === EVENT COMMENTS ROUTES ===

  // Get comments for an event
  app.get("/api/calendar/events/:eventId/comments", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const eventId = Number(req.params.eventId);
    const event = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1);
    
    if (!event.length) return res.status(404).json({ message: "Event not found" });
    
    const user = req.user as any;
    const calendarEvent = event[0];
    
    // Check if user can view comments (own event or shared event)
    if (calendarEvent.userId !== user.id && !calendarEvent.isShared) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const comments = await db.select().from(eventComments)
      .where(eq(eventComments.eventId, eventId))
      .orderBy(eventComments.createdAt);
    
    res.json(comments);
  });

  // Create a comment
  app.post("/api/calendar/events/:eventId/comments", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const eventId = Number(req.params.eventId);
    const event = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1);
    
    if (!event.length) return res.status(404).json({ message: "Event not found" });
    
    const user = req.user as any;
    const calendarEvent = event[0];
    
    // Check if user can comment (own event or shared event)
    if (calendarEvent.userId !== user.id && !calendarEvent.isShared) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    try {
      const commentData = insertEventCommentSchema.parse({
        ...req.body,
        eventId,
        userId: user.id
      });
      
      const [comment] = await db.insert(eventComments).values(commentData).returning();
      res.status(201).json(comment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Update a comment
  app.patch("/api/calendar/events/:eventId/comments/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const existingComment = await db.select().from(eventComments).where(eq(eventComments.id, id)).limit(1);
    
    if (!existingComment.length) return res.status(404).json({ message: "Comment not found" });
    
    const user = req.user as any;
    if (existingComment[0].userId !== user.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const [updated] = await db.update(eventComments).set(req.body).where(eq(eventComments.id, id)).returning();
    res.json(updated);
  });

  // Delete a comment
  app.delete("/api/calendar/events/:eventId/comments/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const existingComment = await db.select().from(eventComments).where(eq(eventComments.id, id)).limit(1);
    
    if (!existingComment.length) return res.status(404).json({ message: "Comment not found" });
    
    const user = req.user as any;
    if (existingComment[0].userId !== user.id) {
      return res.status(403).json({ message: "Access denied" });
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
