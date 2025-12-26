import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { storage } from "./storage.js";
import { setupAuth } from "./auth.js";
import { api } from "../shared/routes.js";
import { z } from "zod";
import { insertUserSchema, insertWorkLogSchema, insertAbsenceSchema } from "../shared/schema.js";

import { db } from "./db.js";
import { users, workLogs } from "../shared/schema.js";
import { eq, and, gte, lte } from "drizzle-orm";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth
  const { hashPassword } = await setupAuth(app);

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

  // File upload endpoint
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    try {
      // For now, return a mock URL. In production, you'd upload to a cloud storage service
      const fileUrl = `/uploads/${req.file.originalname}`;
      res.json({ fileUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to upload file" });
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

  // === Work Logs ===
  app.get(api.workLogs.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    // Admins see all or filter. Employees see only theirs.
    const user = req.user as any;
    let userId = user.id;
    
    if (user.role === 'admin') {
      // If admin passed a userId query param, use it. Otherwise get all.
      if (req.query.userId) {
        userId = Number(req.query.userId);
      } else {
        userId = undefined; // Get all
      }
    }

    const logs = await storage.getWorkLogs(
      userId,
      req.query.startDate as string,
      req.query.endDate as string
    );
    res.json(logs);
  });

  app.post(api.workLogs.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const input = insertWorkLogSchema.parse(req.body);
      
      // Check for duplicate work log on same date for same user and type
      const existingLogs = await storage.getWorkLogs(input.userId, input.date, input.date);
      const duplicate = existingLogs.find(log => 
        log.date === input.date && 
        log.type === input.type &&
        log.userId === input.userId
      );
      
      if (duplicate) {
        return res.status(409).json({ 
          message: `Ya existe un registro de ${input.type === 'work' ? 'trabajo' : 'ausencia'} para esta fecha.` 
        });
      }
      
      const log = await storage.createWorkLog({
        ...input,
        userId: (req.user as any).id // Enforce current user
      });
      res.status(201).json(log);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch(api.workLogs.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const existing = await storage.getWorkLog(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    
    // Only owner (if pending) or admin can update
    const user = req.user as any;
    if (user.role !== 'admin' && existing.userId !== user.id) {
      return res.status(403).json({ message: "Cannot edit this log" });
    }

    const updated = await storage.updateWorkLog(id, req.body);
    res.json(updated);
  });

  app.delete(api.workLogs.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const existing = await storage.getWorkLog(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    
    const user = req.user as any;
    if (user.role !== 'admin' && existing.userId !== user.id) {
      return res.status(403).json({ message: "Cannot delete this log" });
    }

    await storage.deleteWorkLog(id);
    res.sendStatus(204);
  });

  // === Absences ===
  app.get(api.absences.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });

    const user = req.user as any;
    let userId = user.id;

    if (user.role === 'admin') {
      if (req.query.userId) {
         userId = Number(req.query.userId);
      } else {
        userId = undefined;
      }
    }

    const list = await storage.getAbsences(userId, req.query.status as string);
    res.json(list);
  });

  app.post(api.absences.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });

    try {
      const input = insertAbsenceSchema.parse(req.body);
      
      // Check for overlapping absence requests
      const existingAbsences = await storage.getAbsences(input.userId);
      const overlap = existingAbsences.find(absence => {
        const existingStart = new Date(absence.startDate);
        const existingEnd = new Date(absence.endDate);
        const newStart = new Date(input.startDate);
        const newEnd = new Date(input.endDate);
        
        return (
          (newStart >= existingStart && newStart <= existingEnd) ||
          (newEnd >= existingStart && newEnd <= existingEnd) ||
          (newStart <= existingStart && newEnd >= existingEnd)
        );
      });
      
      if (overlap) {
        return res.status(409).json({ 
          message: "Ya existe una solicitud de ausencia para este período." 
        });
      }
      
      const absence = await storage.createAbsence({
        ...input,
        userId: (req.user as any).id
      });
      res.status(201).json(absence);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch(api.absences.updateStatus.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const id = Number(req.params.id);
    const updated = await storage.updateAbsenceStatus(id, req.body.status);
    res.json(updated);
  });

  // Allow employees to delete their own absence requests (only if pending)
  app.delete("/api/absences/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const absence = await storage.getAbsence(id);
    if (!absence) return res.status(404).json({ message: "Not found" });
    
    const user = req.user as any;
    // Only owner (if pending) or admin can delete
    if (user.role !== 'admin' && (absence.userId !== user.id || absence.status !== 'pending')) {
      return res.status(403).json({ message: "Cannot delete this absence request" });
    }

    await storage.deleteAbsence(id);
    res.sendStatus(204);
  });

  // Allow employees to update their own absence requests (only if pending)
  app.patch("/api/absences/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const id = Number(req.params.id);
    const absence = await storage.getAbsence(id);
    if (!absence) return res.status(404).json({ message: "Not found" });
    
    const user = req.user as any;
    // Only owner (if pending) or admin can update
    if (user.role !== 'admin' && (absence.userId !== user.id || absence.status !== 'pending')) {
      return res.status(403).json({ message: "Cannot edit this absence request" });
    }

    const updated = await storage.updateAbsence(id, req.body);
    res.json(updated);
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
