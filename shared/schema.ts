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

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category", { enum: ["examen", "entrega", "presentacion", "evento_trabajo", "evento_universidad"] }).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  time: text("time").notNull(), // HH:mm
  isShared: boolean("is_shared").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sharedEvents = pgTable("shared_events", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  sharedBy: integer("shared_by").references(() => users.id).notNull(),
  sharedAt: timestamp("shared_at").defaultNow(),
});

export const eventComments = pgTable("event_comments", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const usersRelations = relations(users, ({ many }) => ({
  events: many(events),
  sharedEvents: many(sharedEvents),
  eventComments: many(eventComments),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  user: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
  sharedEvents: many(sharedEvents),
  comments: many(eventComments),
}));

export const sharedEventsRelations = relations(sharedEvents, ({ one }) => ({
  event: one(events, {
    fields: [sharedEvents.eventId],
    references: [events.id],
  }),
  sharedBy: one(users, {
    fields: [sharedEvents.sharedBy],
    references: [users.id],
  }),
}));

export const eventCommentsRelations = relations(eventComments, ({ one }) => ({
  event: one(events, {
    fields: [eventComments.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventComments.userId],
    references: [users.id],
  }),
}));

// === BASE SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSharedEventSchema = createInsertSchema(sharedEvents).omit({ id: true, sharedAt: true });
export const insertEventCommentSchema = createInsertSchema(eventComments).omit({ id: true, createdAt: true });

// === TYPES ===
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type SharedEvent = typeof sharedEvents.$inferSelect;
export type InsertSharedEvent = z.infer<typeof insertSharedEventSchema>;
export type EventComment = typeof eventComments.$inferSelect;
export type InsertEventComment = z.infer<typeof insertEventCommentSchema>;

// Request types
export type CreateEventRequest = InsertEvent;
export type CreateSharedEventRequest = InsertSharedEvent;
export type CreateEventCommentRequest = InsertEventComment;

// API Response types (for complex queries)
export type EventWithUser = Event & { user: User };
export type SharedEventWithDetails = SharedEvent & { event: EventWithUser; sharedBy: User };
export type EventCommentWithUser = EventComment & { user: User };
