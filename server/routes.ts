import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { storage } from "./storage.js";
import { setupAuth, authenticateToken } from "./auth-simple.js";
import { api } from "../shared/routes.js";
import { z } from "zod";
import { insertUserSchema } from "../shared/schema.js";
import { createClient } from '@supabase/supabase-js';

import { db } from "./db.js";
import { users } from "../shared/schema.js";
import { eq } from "drizzle-orm";

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
    console.log('User creation attempt');
    console.log('Is authenticated:', req.isAuthenticated());
    console.log('User from request:', req.user);
    
    // Only admins can create users, or if no users exist (initial setup)
    const { data: allUsers, error: fetchError } = await supabase
      .from('users')
      .select('id');
    
    if (fetchError) {
      console.log('Error fetching users:', fetchError);
      return res.status(500).json({ message: "Error checking users" });
    }
    
    const isAdmin = req.isAuthenticated() && (req.user as any).role === 'admin';
    console.log('Is admin:', isAdmin);
    console.log('All users count:', allUsers?.length);
    
    if (allUsers && allUsers.length > 0 && !isAdmin) {
       console.log('Unauthorized: users exist and user is not admin');
       return res.status(401).json({ message: "Unauthorized. Only admins can create users." });
    }

    try {
      const input = insertUserSchema.parse(req.body);
      const hashedPassword = await hashPassword(input.password);
      
      const { data: user, error: createError } = await supabase
        .from('users')
        .insert({
          username: input.username,
          password: hashedPassword,
          full_name: input.fullName,
          role: input.role || 'employee'
        })
        .select()
        .single();
      
      if (createError) {
        console.log('Error creating user:', createError);
        return res.status(500).json({ message: createError.message });
      }
      
      console.log('User created successfully:', user);
      res.status(201).json(user);
    } catch (err) {
      console.log('User creation error:', err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // === Calendar Events ===
  app.get('/api/calendar-events', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const user = req.user as any;
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true });
    
    if (error) return res.status(500).json({ message: error.message });
    res.json(data || []);
  });

  app.post('/api/calendar-events', async (req, res) => {
    console.log('=== Calendar Event Creation Start ===');
    console.log('Is authenticated:', req.isAuthenticated());
    console.log('User from request:', req.user);
    
    if (!req.isAuthenticated()) {
      console.log('ERROR: User not authenticated');
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const user = req.user as any;
      console.log('Creating calendar event for user:', user.id);
      console.log('Request body:', req.body);
      console.log('Request body keys:', Object.keys(req.body || {}));
      
      const eventData = {
        user_id: user.id,
        title: req.body.title,
        description: req.body.description || null,
        category: req.body.category,
        date: req.body.date,
        color: req.body.color || null,
        time: req.body.time || null,
        is_shared: req.body.isShared || false,
        shared_by: req.body.isShared ? user.id : null
      };
      
      console.log('Processed event data:', eventData);
      console.log('Event data keys:', Object.keys(eventData));
      
      const { data, error } = await supabase
        .from('calendar_events')
        .insert(eventData)
        .select()
        .single();
      
      if (error) {
        console.log('Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return res.status(500).json({ message: error.message });
      }
      
      console.log('Event created successfully:', data);
      res.status(201).json(data);
    } catch (err) {
      console.log('Calendar event creation error:', err);
      console.log('Error type:', typeof err);
      console.log('Error message:', err instanceof Error ? err.message : 'Unknown error');
      res.status(500).json({ message: "Failed to create event" });
    }
    console.log('=== Calendar Event Creation End ===');
  });

  app.put('/api/calendar-events/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const user = req.user as any;
    
    // First check if user owns this event
    const { data: existing, error: fetchError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    
    if (fetchError || !existing) return res.status(404).json({ message: "Event not found" });
    
    const eventData = {
      title: req.body.title,
      description: req.body.description || null,
      category: req.body.category,
      date: req.body.date,
      time: req.body.time || null
    };
    
    const { data, error } = await supabase
      .from('calendar_events')
      .update(eventData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
  });

  app.delete('/api/calendar-events/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const user = req.user as any;
    
    // First check if user owns this event
    const { data: existing, error: fetchError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    
    if (fetchError || !existing) return res.status(404).json({ message: "Event not found" });
    
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id);
    
    if (error) return res.status(500).json({ message: error.message });
    res.sendStatus(204);
  });

  // === Shared Events ===
  app.get('/api/shared-events', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const { data, error } = await supabase
      .from('calendar_events')
      .select(`
        *,
        users!calendar_events_user_id_fkey(id, username, full_name),
        event_comments(*, users!event_comments_user_id_fkey(id, username))
      `)
      .eq('is_shared', true)
      .order('date', { ascending: true });
    
    if (error) {
      console.log('Shared events error:', error);
      return res.status(500).json({ message: error.message });
    }
    res.json(data || []);
  });

  app.post('/api/shared-events', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const user = req.user as any;
      const originalEventId = req.body.originalEventId;
      
      if (!originalEventId) {
        return res.status(400).json({ message: "Original event ID is required" });
      }
      
      console.log('Sharing event:', originalEventId, 'for user:', user.id);
      
      // Update the original event to mark it as shared
      const { data, error } = await supabase
        .from('calendar_events')
        .update({ 
          is_shared: true, 
          shared_by: user.id 
        })
        .eq('id', originalEventId)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) {
        console.log('Error sharing event:', error);
        return res.status(500).json({ message: error.message });
      }
      
      console.log('Event shared successfully:', data);
      res.status(200).json(data);
    } catch (err) {
      console.log('Share event error:', err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete('/api/shared-events/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const user = req.user as any;
    
    // First check if user owns this shared event
    const { data: existing, error: fetchError } = await supabase
      .from('shared_events')
      .select('*')
      .eq('id', id)
      .eq('shared_by', user.id)
      .single();
    
    if (fetchError || !existing) return res.status(404).json({ message: "Shared event not found" });
    
    const { error } = await supabase
      .from('shared_events')
      .delete()
      .eq('id', id);
    
    if (error) return res.status(500).json({ message: error.message });
    res.sendStatus(204);
  });

  // === Event Comments ===
  app.post('/api/shared-events/:eventId/comments', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const eventId = Number(req.params.eventId);
    const user = req.user as any;
    const { comment } = req.body;
    
    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: "Comment is required" });
    }
    
    try {
      const commentData = {
        event_id: eventId,
        user_id: user.id,
        comment: comment.trim()
      };
      
      const { data, error } = await supabase
        .from('event_comments')
        .insert(commentData)
        .select(`
          *,
          user:users(id, username)
        `)
        .single();
      
      if (error) return res.status(500).json({ message: error.message });
      res.status(201).json(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
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
