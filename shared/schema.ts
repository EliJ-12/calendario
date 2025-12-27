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

export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  date: date("date").notNull(),
  time: text("time"), // HH:mm format
  category: text("category", { enum: ["examen", "entrega", "presentacion", "evento_trabajo", "evento_universidad"] }).notNull(),
  color: text("color").notNull().default("#FF3E40"), // Default red color
  isShared: boolean("is_shared").default(false), // For shared calendar
  sharedBy: integer("shared_by").references(() => users.id), // Who shared the event
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eventComments = pgTable("event_comments", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => calendarEvents.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const usersRelations = relations(users, ({ many }) => ({
  calendarEvents: many(calendarEvents),
  eventComments: many(eventComments),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one, many }) => ({
  user: one(users, {
    fields: [calendarEvents.userId],
    references: [users.id],
  }),
  sharedByUser: one(users, {
    fields: [calendarEvents.sharedBy],
    references: [users.id],
  }),
  comments: many(eventComments),
}));

export const eventCommentsRelations = relations(eventComments, ({ one }) => ({
  event: one(calendarEvents, {
    fields: [eventComments.eventId],
    references: [calendarEvents.id],
  }),
  user: one(users, {
    fields: [eventComments.userId],
    references: [users.id],
  }),
}));

// === BASE SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEventCommentSchema = createInsertSchema(eventComments).omit({ id: true, createdAt: true });

// === TYPES ===
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type EventComment = typeof eventComments.$inferSelect;
export type InsertEventComment = z.infer<typeof insertEventCommentSchema>;

// Request types
export type CreateUserRequest = InsertUser;
export type CreateCalendarEventRequest = InsertCalendarEvent;
export type CreateEventCommentRequest = InsertEventComment;

// API Response types (for complex queries)
export type CalendarEventWithUser = CalendarEvent & { user: User; sharedByUser?: User };
export type EventCommentWithUser = EventComment & { user: User };
