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
});

export const eventCategories = pgTable("event_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull(), // Hex color code
  createdAt: timestamp("created_at").defaultNow(),
});

export const personalEvents = pgTable("personal_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  categoryId: integer("category_id").references(() => eventCategories.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  date: date("date").notNull(),
  time: time("time"),
  isAllDay: boolean("is_all_day").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sharedEvents = pgTable("shared_events", {
  id: serial("id").primaryKey(),
  originalEventId: integer("original_event_id").references(() => personalEvents.id, { onDelete: "cascade" }),
  sharedByUserId: integer("shared_by_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  date: date("date").notNull(),
  time: time("time"),
  isAllDay: boolean("is_all_day").default(false),
  categoryId: integer("category_id").references(() => eventCategories.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sharedEventComments = pgTable("shared_event_comments", {
  id: serial("id").primaryKey(),
  sharedEventId: integer("shared_event_id").references(() => sharedEvents.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === RELATIONS ===
export const usersRelations = relations(users, ({ many }) => ({
  personalEvents: many(personalEvents),
  sharedEvents: many(sharedEvents),
  comments: many(sharedEventComments),
}));

export const eventCategoriesRelations = relations(eventCategories, ({ many }) => ({
  personalEvents: many(personalEvents),
  sharedEvents: many(sharedEvents),
}));

export const personalEventsRelations = relations(personalEvents, ({ one, many }) => ({
  user: one(users, {
    fields: [personalEvents.userId],
    references: [users.id],
  }),
  category: one(eventCategories, {
    fields: [personalEvents.categoryId],
    references: [eventCategories.id],
  }),
  sharedEvents: many(sharedEvents),
}));

export const sharedEventsRelations = relations(sharedEvents, ({ one, many }) => ({
  originalEvent: one(personalEvents, {
    fields: [sharedEvents.originalEventId],
    references: [personalEvents.id],
  }),
  sharedByUser: one(users, {
    fields: [sharedEvents.sharedByUserId],
    references: [users.id],
  }),
  category: one(eventCategories, {
    fields: [sharedEvents.categoryId],
    references: [eventCategories.id],
  }),
  comments: many(sharedEventComments),
}));

export const sharedEventCommentsRelations = relations(sharedEventComments, ({ one }) => ({
  sharedEvent: one(sharedEvents, {
    fields: [sharedEventComments.sharedEventId],
    references: [sharedEvents.id],
  }),
  user: one(users, {
    fields: [sharedEventComments.userId],
    references: [users.id],
  }),
}));

// === BASE SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertEventCategorySchema = createInsertSchema(eventCategories).omit({ id: true, createdAt: true });
export const insertPersonalEventSchema = createInsertSchema(personalEvents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSharedEventSchema = createInsertSchema(sharedEvents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSharedEventCommentSchema = createInsertSchema(sharedEventComments).omit({ id: true, createdAt: true, updatedAt: true });

// === TYPES ===
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type EventCategory = typeof eventCategories.$inferSelect;
export type InsertEventCategory = z.infer<typeof insertEventCategorySchema>;
export type PersonalEvent = typeof personalEvents.$inferSelect;
export type InsertPersonalEvent = z.infer<typeof insertPersonalEventSchema>;
export type SharedEvent = typeof sharedEvents.$inferSelect;
export type InsertSharedEvent = z.infer<typeof insertSharedEventSchema>;
export type SharedEventComment = typeof sharedEventComments.$inferSelect;
export type InsertSharedEventComment = z.infer<typeof insertSharedEventCommentSchema>;

// Request types
export type CreateUserRequest = InsertUser;
export type CreatePersonalEventRequest = InsertPersonalEvent;
export type CreateSharedEventRequest = InsertSharedEvent;
export type CreateSharedEventCommentRequest = InsertSharedEventComment;

// API Response types (for complex queries)
export type PersonalEventWithUser = PersonalEvent & { user: User; category?: EventCategory };
export type SharedEventWithDetails = SharedEvent & { 
  sharedByUser: User; 
  category?: EventCategory;
  comments?: (SharedEventComment & { user: User })[];
};
export type SharedEventCommentWithUser = SharedEventComment & { user: User };
