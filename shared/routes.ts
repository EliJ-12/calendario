import { z } from 'zod';
import { insertUserSchema, insertCalendarEventSchema, insertSharedEventSchema, insertEventCommentSchema, users, calendarEvents, sharedEvents, eventComments } from './schema.js';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    user: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/users',
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  calendarEvents: {
    list: {
      method: 'GET' as const,
      path: '/api/calendar-events',
      input: z.object({
        userId: z.coerce.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        category: z.enum(['examen', 'entrega', 'presentacion', 'evento_trabajo', 'evento_universidad']).optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof calendarEvents.$inferSelect & { user?: typeof users.$inferSelect }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/calendar-events',
      input: insertCalendarEventSchema,
      responses: {
        201: z.custom<typeof calendarEvents.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/calendar-events/:id',
      input: insertCalendarEventSchema.partial(),
      responses: {
        200: z.custom<typeof calendarEvents.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/calendar-events/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  sharedEvents: {
    list: {
      method: 'GET' as const,
      path: '/api/shared-events',
      responses: {
        200: z.array(z.custom<typeof sharedEvents.$inferSelect & { 
          originalEvent: typeof calendarEvents.$inferSelect & { user: typeof users.$inferSelect };
          sharedByUser: typeof users.$inferSelect;
          comments: (typeof eventComments.$inferSelect & { user: typeof users.$inferSelect })[];
        }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/shared-events',
      input: z.object({ originalEventId: z.number() }),
      responses: {
        201: z.custom<typeof sharedEvents.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/shared-events/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  eventComments: {
    create: {
      method: 'POST' as const,
      path: '/api/event-comments',
      input: insertEventCommentSchema,
      responses: {
        201: z.custom<typeof eventComments.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/event-comments/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
