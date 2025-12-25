import { users, workLogs, absences, type User, type InsertUser, type WorkLog, type InsertWorkLog, type Absence, type InsertAbsence } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;

  // Work Log operations
  createWorkLog(log: InsertWorkLog): Promise<WorkLog>;
  getWorkLogs(userId?: number, startDate?: string, endDate?: string): Promise<(WorkLog & { user: User })[]>;
  getWorkLog(id: number): Promise<WorkLog | undefined>;
  updateWorkLog(id: number, log: Partial<InsertWorkLog>): Promise<WorkLog>;

  // Absence operations
  createAbsence(absence: InsertAbsence): Promise<Absence>;
  getAbsences(userId?: number, status?: string): Promise<(Absence & { user: User })[]>;
  getAbsence(id: number): Promise<Absence | undefined>;
  updateAbsenceStatus(id: number, status: string): Promise<Absence>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.fullName);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createWorkLog(log: InsertWorkLog): Promise<WorkLog> {
    const [entry] = await db.insert(workLogs).values(log).returning();
    return entry;
  }

  async getWorkLogs(userId?: number, startDate?: string, endDate?: string): Promise<(WorkLog & { user: User })[]> {
    let query = db.select({
        id: workLogs.id,
        userId: workLogs.userId,
        date: workLogs.date,
        startTime: workLogs.startTime,
        endTime: workLogs.endTime,
        totalHours: workLogs.totalHours,
        type: workLogs.type,
        createdAt: workLogs.createdAt,
        user: users,
      })
      .from(workLogs)
      .innerJoin(users, eq(workLogs.userId, users.id));

    const conditions = [];
    if (userId) conditions.push(eq(workLogs.userId, userId));
    if (startDate) conditions.push(gte(workLogs.date, startDate));
    if (endDate) conditions.push(lte(workLogs.date, endDate));

    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(workLogs.date) as (WorkLog & { user: User })[];
    }
    
    return await query.orderBy(workLogs.date) as (WorkLog & { user: User })[];
  }

  async getWorkLog(id: number): Promise<WorkLog | undefined> {
    const [log] = await db.select().from(workLogs).where(eq(workLogs.id, id));
    return log;
  }

  async updateWorkLog(id: number, updates: Partial<InsertWorkLog>): Promise<WorkLog> {
    const [updated] = await db.update(workLogs).set(updates).where(eq(workLogs.id, id)).returning();
    return updated;
  }

  async createAbsence(absence: InsertAbsence): Promise<Absence> {
    const [entry] = await db.insert(absences).values(absence).returning();
    return entry;
  }

  async getAbsences(userId?: number, status?: string): Promise<(Absence & { user: User })[]> {
    let query = db.select({
        id: absences.id,
        userId: absences.userId,
        startDate: absences.startDate,
        endDate: absences.endDate,
        reason: absences.reason,
        status: absences.status,
        fileUrl: absences.fileUrl,
        isPartial: absences.isPartial,
        partialHours: absences.partialHours,
        createdAt: absences.createdAt,
        user: users
      })
      .from(absences)
      .innerJoin(users, eq(absences.userId, users.id));

    const conditions = [];
    if (userId) conditions.push(eq(absences.userId, userId));
    if (status) conditions.push(eq(absences.status, status));

    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(absences.startDate) as (Absence & { user: User })[];
    }

    return await query.orderBy(absences.startDate) as (Absence & { user: User })[];
  }

  async getAbsence(id: number): Promise<Absence | undefined> {
    const [absence] = await db.select().from(absences).where(eq(absences.id, id));
    return absence;
  }

  async updateAbsenceStatus(id: number, status: string): Promise<Absence> {
    // @ts-ignore
    const [updated] = await db.update(absences).set({ status }).where(eq(absences.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
