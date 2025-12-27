import { pgTable, text, serial, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "employee"] }).notNull().default("employee"),
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workLogs = pgTable("work_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const absences = pgTable("absences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const usersRelations = relations(users, ({ many }) => ({
  workLogs: many(workLogs),
  absences: many(absences),
}));

export const workLogsRelations = relations(workLogs, ({ one }) => ({
  user: one(users, {
    fields: [workLogs.userId],
    references: [users.id],
  }),
}));

export const absencesRelations = relations(absences, ({ one }) => ({
  user: one(users, {
    fields: [absences.userId],
    references: [users.id],
  }),
}));

// === BASE SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertWorkLogSchema = createInsertSchema(workLogs).omit({ id: true, createdAt: true });
export const insertAbsenceSchema = createInsertSchema(absences).omit({ id: true, createdAt: true });

// === TYPES ===
export type User = typeof users.$inferSelect;
export type WorkLog = typeof workLogs.$inferSelect;
export type Absence = typeof absences.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertWorkLog = z.infer<typeof insertWorkLogSchema>;
export type InsertAbsence = z.infer<typeof insertAbsenceSchema>;

// Request types
export type CreateUserRequest = InsertUser;
