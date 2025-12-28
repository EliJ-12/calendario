import type { Express } from "express";
import { createServer, type Server } from "http";
import express from 'express';
import multer from "multer";
import path from "path";
import { storage } from "./storage.js";
import { setupAuth, authenticateToken } from "./auth-simple.js";
import { api } from "../shared/routes.js";
import { z } from "zod";
import { insertUserSchema } from "../shared/schema.js";
import { createClient } from '@supabase/supabase-js';
import './types.d.ts';

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

  // Create event_comments table
  app.post('/api/create-comments-table', async (req, res) => {
    try {
      console.log('Creating event_comments table...');
      
      const { error } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS event_comments (
            id SERIAL PRIMARY KEY,
            event_id INTEGER REFERENCES calendar_events(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            comment TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `
      });
      
      if (error) {
        console.log('Error creating comments table:', error);
        return res.status(500).json({ message: error.message });
      }
      
      console.log('Event comments table created successfully');
      res.status(200).json({ message: "Event comments table created successfully" });
    } catch (err) {
      console.log('Create comments table error:', err);
      res.status(500).json({ message: "Failed to create comments table" });
    }
  });

  // Public debug endpoint for shared calendar
  app.get('/api/debug-shared', async (req, res) => {
    try {
      console.log('Debug: Testing shared events query...');
      
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('is_shared', true)
        .limit(5);
      
      if (error) {
        console.log('Debug: Shared events error:', error);
        return res.status(500).json({ 
          message: "Query failed", 
          error: error.message,
          details: error.details 
        });
      }
      
      console.log('Debug: Shared events data:', data);
      res.status(200).json({ 
        message: "Query successful", 
        count: data?.length || 0,
        data: data || []
      });
    } catch (err) {
      console.log('Debug: Shared events error:', err);
      res.status(500).json({ message: "Debug failed", error: String(err) });
    }
  });

  // Update category constraint to include Comida
  app.post('/api/update-category-constraint', async (req, res) => {
    try {
      console.log('Updating category constraint to include Comida...');
      
      // Drop existing constraint
      const { error: dropError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_category_check;'
      });
      
      if (dropError) {
        console.log('Error dropping constraint:', dropError);
      }
      
      // Add new constraint with Comida
      const { error: addError } = await supabase.rpc('exec_sql', {
        sql: "ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_category_check CHECK (category IN ('Examen', 'Entrega', 'Presentación', 'Evento trabajo', 'Evento universidad', 'Comida'));"
      });
      
      if (addError) {
        console.log('Error adding constraint:', addError);
        return res.status(500).json({ message: addError.message });
      }
      
      console.log('Category constraint updated successfully');
      res.status(200).json({ message: "Category constraint updated successfully" });
    } catch (err) {
      console.log('Update constraint error:', err);
      res.status(500).json({ message: "Failed to update constraint" });
    }
  });

  // Add sharing fields to calendar_events table
  app.post('/api/add-sharing-fields', async (req, res) => {
    try {
      console.log('Adding sharing fields to calendar_events...');
      
      // Add is_shared column
      const { error: sharedError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE;'
      });
      
      if (sharedError) {
        console.log('Error adding is_shared column:', sharedError);
      }
      
      // Add shared_by column
      const { error: sharedByError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS shared_by INTEGER REFERENCES users(id) ON DELETE SET NULL;'
      });
      
      if (sharedByError) {
        console.log('Error adding shared_by column:', sharedByError);
      }
      
      console.log('Sharing fields added successfully');
      res.status(200).json({ message: "Sharing fields added successfully" });
    } catch (err) {
      console.log('Add sharing fields error:', err);
      res.status(500).json({ message: "Failed to add sharing fields" });
    }
  });

  // Public endpoint to drop constraint (temporary for debugging)
  app.post('/api/public-drop-constraint', async (req, res) => {
    try {
      console.log('Attempting to drop category constraint...');
      
      // Drop the constraint
      const { error } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_category_check;'
      });
      
      if (error) {
        console.log('Error dropping constraint:', error);
        return res.status(500).json({ message: error.message });
      }
      
      console.log('Category constraint dropped successfully');
      res.status(200).json({ message: "Category constraint dropped successfully" });
    } catch (err) {
      console.log('Drop constraint error:', err);
      res.status(500).json({ message: "Failed to drop constraint" });
    }
  });

  // Drop category constraint temporarily
  app.post('/api/drop-category-constraint', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      // Drop the constraint
      const { error } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_category_check;'
      });
      
      if (error) {
        console.log('Error dropping constraint:', error);
        return res.status(500).json({ message: error.message });
      }
      
      res.status(200).json({ message: "Category constraint dropped successfully" });
    } catch (err) {
      console.log('Drop constraint error:', err);
      res.status(500).json({ message: "Failed to drop constraint" });
    }
  });

  // Simple table structure check
  app.get('/api/simple-table-check', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      // Try to get table info using a different approach
      const { data, error } = await supabase
        .rpc('get_table_info', { table_name: 'calendar_events' });
      
      if (error) {
        // Fallback: try a simple select to see what columns exist
        const { data: testData, error: testError } = await supabase
          .from('calendar_events')
          .select('*')
          .limit(1);
        
        if (testError) {
          return res.status(500).json({ 
            message: "Cannot access table",
            error: testError.message 
          });
        }
        
        return res.status(200).json({
          columns: testData.length > 0 ? Object.keys(testData[0]) : [],
          sample: testData,
          message: "Table structure from sample data"
        });
      }
      
      res.status(200).json({ data });
    } catch (err) {
      console.log('Simple table check error:', err);
      res.status(500).json({ message: "Failed to check table" });
    }
  });

  // Check category constraint values
  app.get('/api/check-category-constraint', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      // Get the exact check constraint for category
      const { data, error } = await supabase
        .from('information_schema.check_constraints')
        .select('constraint_name, check_clause')
        .eq('constraint_schema', 'public')
        .like('constraint_name', '%category%');
      
      if (error) {
        console.log('Constraint check error:', error);
        return res.status(500).json({ message: error.message });
      }
      
      res.status(200).json({ 
        constraints: data || [],
        message: "Check constraint details for category field"
      });
    } catch (err) {
      console.log('Category constraint check error:', err);
      res.status(500).json({ message: "Failed to check category constraint" });
    }
  });

  // Check table structure and constraints
  app.get('/api/check-table-structure', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      // Get table structure
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', 'calendar_events')
        .eq('table_schema', 'public');
      
      // Get check constraints
      const { data: constraints, error: constraintsError } = await supabase
        .from('information_schema.check_constraints')
        .select('constraint_name, check_clause')
        .eq('constraint_schema', 'public');
      
      // Get constraint columns usage
      const { data: usage, error: usageError } = await supabase
        .from('information_schema.constraint_column_usage')
        .select('constraint_name, column_name')
        .eq('table_name', 'calendar_events')
        .eq('table_schema', 'public');
      
      res.status(200).json({
        columns: columns || [],
        constraints: constraints || [],
        usage: usage || [],
        errors: {
          columns: columnsError?.message,
          constraints: constraintsError?.message,
          usage: usageError?.message
        }
      });
    } catch (err) {
      console.log('Table structure check error:', err);
      res.status(500).json({ message: "Failed to check table structure" });
    }
  });

  // Update calendar_events table structure
  app.post('/api/update-calendar-table', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      // Add missing columns to calendar_events table
      const { error: colorError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS color VARCHAR(7);'
      });
      
      if (colorError) {
        console.log('Error adding color column:', colorError);
      }
      
      const { error: sharedError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE;'
      });
      
      if (sharedError) {
        console.log('Error adding is_shared column:', sharedError);
      }
      
      const { error: sharedByError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS shared_by INTEGER REFERENCES users(id) ON DELETE SET NULL;'
      });
      
      if (sharedByError) {
        console.log('Error adding shared_by column:', sharedByError);
      }
      
      res.status(200).json({ message: "Table updated successfully" });
    } catch (err) {
      console.log('Table update error:', err);
      res.status(500).json({ message: "Failed to update table" });
    }
  });

  // Temporarily disable RLS for calendar_events (for development)
  app.post('/api/disable-rls', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE calendar_events DISABLE ROW LEVEL SECURITY;'
      });
      
      if (error) {
        console.log('Error disabling RLS:', error);
        return res.status(500).json({ message: error.message });
      }
      
      res.status(200).json({ message: "RLS disabled successfully" });
    } catch (err) {
      console.log('RLS disable error:', err);
      res.status(500).json({ message: "Failed to disable RLS" });
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
      time: req.body.time || null,
      is_shared: req.body.isShared || false,
      shared_by: req.body.isShared ? user.id : null
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

  // === Event Comments ===
  app.post('/api/events/:eventId/comments', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const eventId = Number(req.params.eventId);
    const user = req.user as any;
    const { comment } = req.body;
    
    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }
    
    try {
      // First check if event exists and is shared
      const { data: event, error: eventError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', eventId)
        .eq('is_shared', true)
        .single();
      
      if (eventError || !event) {
        return res.status(404).json({ message: "Shared event not found" });
      }
      
      // Add comment
      const { data, error } = await supabase
        .from('event_comments')
        .insert({
          event_id: eventId,
          user_id: user.id,
          comment: comment.trim()
        })
        .select(`
          *,
          users!event_comments_user_id_fkey(id, username, full_name)
        `)
        .single();
      
      if (error) {
        console.log('Comment creation error:', error);
        return res.status(500).json({ message: error.message });
      }
      
      res.status(201).json(data);
    } catch (err) {
      console.log('Comment creation error:', err);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  app.get('/api/events/:eventId/comments', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const eventId = Number(req.params.eventId);
    
    try {
      const { data, error } = await supabase
        .from('event_comments')
        .select(`
          *,
          users!event_comments_user_id_fkey(id, username, full_name)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.log('Comments fetch error:', error);
        return res.status(500).json({ message: error.message });
      }
      
      res.json(data || []);
    } catch (err) {
      console.log('Comments fetch error:', err);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.delete('/api/events/:eventId/comments/:commentId', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const eventId = Number(req.params.eventId);
    const commentId = Number(req.params.commentId);
    const user = req.user as any;
    
    try {
      // Check if comment belongs to user
      const { data: comment, error: fetchError } = await supabase
        .from('event_comments')
        .select('*')
        .eq('id', commentId)
        .eq('user_id', user.id)
        .eq('event_id', eventId)
        .single();
      
      if (fetchError || !comment) {
        return res.status(404).json({ message: "Comment not found or unauthorized" });
      }
      
      const { error } = await supabase
        .from('event_comments')
        .delete()
        .eq('id', commentId);
      
      if (error) {
        console.log('Comment deletion error:', error);
        return res.status(500).json({ message: error.message });
      }
      
      res.sendStatus(204);
    } catch (err) {
      console.log('Comment deletion error:', err);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Debug endpoint for comments
  app.get('/api/debug-comments/:eventId', async (req, res) => {
    try {
      const eventId = Number(req.params.eventId);
      console.log('Debug: Testing comments query for event:', eventId);
      
      const { data, error } = await supabase
        .from('event_comments')
        .select(`
          *,
          users!event_comments_user_id_fkey(id, username, full_name)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.log('Debug: Comments error:', error);
        return res.status(500).json({ 
          message: "Query failed", 
          error: error.message,
          details: error.details 
        });
      }
      
      console.log('Debug: Comments data:', data);
      res.status(200).json({ 
        message: "Query successful", 
        count: data?.length || 0,
        data: data || []
      });
    } catch (err) {
      console.log('Debug: Comments error:', err);
      res.status(500).json({ message: "Debug failed", error: String(err) });
    }
  });

  // === Shared Events ===
  app.get('/api/shared-events', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const { data, error } = await supabase
      .from('calendar_events')
      .select(`
        *,
        users!calendar_events_user_id_fkey(id, username, full_name),
        event_comments(
          *,
          users!event_comments_user_id_fkey(id, username, full_name)
        )
      `)
      .eq('is_shared', true)
      .order('date', { ascending: true });
    
    console.log('Shared events with comments:', data?.map(e => ({
      id: e.id,
      title: e.title,
      commentsCount: e.event_comments?.length || 0,
      comments: e.event_comments
    })));
    
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
