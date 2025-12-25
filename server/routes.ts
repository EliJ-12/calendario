import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertUserSchema, insertWorkLogSchema, insertAbsenceSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth
  const { hashPassword } = await setupAuth(app);

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
    if (user.role !== 'admin' && (existing.userId !== user.id || existing.status !== 'pending')) {
      return res.status(403).json({ message: "Cannot edit this log" });
    }

    const updated = await storage.updateWorkLog(id, req.body);
    res.json(updated);
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
