import { pgTable, text, serial, integer, boolean, timestamp, date, time } from "drizzle-orm/pg-core";
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
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category", { enum: ["examen", "entrega", "presentacion", "evento_trabajo", "evento_universidad"] }).notNull(),
  eventDate: date("event_date").notNull(),
  eventTime: time("event_time"),
  isShared: boolean("is_shared").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sharedEvents = pgTable("shared_events", {
  id: serial("id").primaryKey(),
  originalEventId: integer("original_event_id").references(() => calendarEvents.id).notNull(),
  sharedByUserId: integer("shared_by_user_id").references(() => users.id).notNull(),
  sharedAt: timestamp("shared_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

export const eventComments = pgTable("event_comments", {
  id: serial("id").primaryKey(),
  sharedEventId: integer("shared_event_id").references(() => sharedEvents.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const usersRelations = relations(users, ({ many }) => ({
  calendarEvents: many(calendarEvents),
  sharedEvents: many(sharedEvents),
  eventComments: many(eventComments),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one, many }) => ({
  user: one(users, {
    fields: [calendarEvents.userId],
    references: [users.id],
  }),
  sharedEvents: many(sharedEvents),
}));

export const sharedEventsRelations = relations(sharedEvents, ({ one, many }) => ({
  originalEvent: one(calendarEvents, {
    fields: [sharedEvents.originalEventId],
    references: [calendarEvents.id],
  }),
  sharedByUser: one(users, {
    fields: [sharedEvents.sharedByUserId],
    references: [users.id],
  }),
  comments: many(eventComments),
}));

export const eventCommentsRelations = relations(eventComments, ({ one }) => ({
  sharedEvent: one(sharedEvents, {
    fields: [eventComments.sharedEventId],
    references: [sharedEvents.id],
  }),
  user: one(users, {
    fields: [eventComments.userId],
    references: [users.id],
  }),
}));

// === BASE SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSharedEventSchema = createInsertSchema(sharedEvents).omit({ id: true, sharedAt: true });
export const insertEventCommentSchema = createInsertSchema(eventComments).omit({ id: true, createdAt: true });

// === TYPES ===
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type SharedEvent = typeof sharedEvents.$inferSelect;
export type InsertSharedEvent = z.infer<typeof insertSharedEventSchema>;
export type EventComment = typeof eventComments.$inferSelect;
export type InsertEventComment = z.infer<typeof insertEventCommentSchema>;

// Request types
export type CreateUserRequest = InsertUser;
export type CreateCalendarEventRequest = InsertCalendarEvent;
export type CreateSharedEventRequest = InsertSharedEvent;
export type CreateEventCommentRequest = InsertEventComment;

// API Response types (for complex queries)
export type CalendarEventWithUser = CalendarEvent & { user: User };
export type SharedEventWithDetails = SharedEvent & { 
  originalEvent: CalendarEvent & { user: User };
  sharedByUser: User;
  comments: (EventComment & { user: User })[];
};
