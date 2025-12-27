import { z } from 'zod';
import { 
  insertUserSchema, 
  insertPersonalEventSchema, 
  insertSharedEventSchema, 
  insertSharedEventCommentSchema,
  users, 
  personalEvents, 
  sharedEvents, 
  sharedEventComments,
  eventCategories
} from './schema.js';

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
  eventCategories: {
    list: {
      method: 'GET' as const,
      path: '/api/event-categories',
      responses: {
        200: z.array(z.custom<typeof eventCategories.$inferSelect>()),
      },
    },
  },
  personalEvents: {
    list: {
      method: 'GET' as const,
      path: '/api/personal-events',
      input: z.object({
        userId: z.coerce.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof personalEvents.$inferSelect & { user?: typeof users.$inferSelect; category?: typeof eventCategories.$inferSelect }>()),
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/personal-events',
      input: insertPersonalEventSchema,
      responses: {
        201: z.custom<typeof personalEvents.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/personal-events/:id',
      input: insertPersonalEventSchema.partial(),
      responses: {
        200: z.custom<typeof personalEvents.$inferSelect>(),
        404: errorSchemas.notFound,
        403: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/personal-events/:id',
      responses: {
        204: z.null(),
        404: errorSchemas.notFound,
        403: errorSchemas.unauthorized,
      },
    },
  },
  sharedEvents: {
    list: {
      method: 'GET' as const,
      path: '/api/shared-events',
      responses: {
        200: z.array(z.custom<typeof sharedEvents.$inferSelect & { 
          sharedByUser: typeof users.$inferSelect; 
          category?: typeof eventCategories.$inferSelect;
          comments?: (typeof sharedEventComments.$inferSelect & { user: typeof users.$inferSelect })[];
        }>()),
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/shared-events',
      input: insertSharedEventSchema,
      responses: {
        201: z.custom<typeof sharedEvents.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/shared-events/:id',
      input: insertSharedEventSchema.partial(),
      responses: {
        200: z.custom<typeof sharedEvents.$inferSelect>(),
        404: errorSchemas.notFound,
        403: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/shared-events/:id',
      responses: {
        204: z.null(),
        404: errorSchemas.notFound,
        403: errorSchemas.unauthorized,
      },
    },
  },
  sharedEventComments: {
    create: {
      method: 'POST' as const,
      path: '/api/shared-events/:eventId/comments',
      input: insertSharedEventCommentSchema,
      responses: {
        201: z.custom<typeof sharedEventComments.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/shared-event-comments/:id',
      input: insertSharedEventCommentSchema.partial(),
      responses: {
        200: z.custom<typeof sharedEventComments.$inferSelect>(),
        404: errorSchemas.notFound,
        403: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/shared-event-comments/:id',
      responses: {
        204: z.null(),
        404: errorSchemas.notFound,
        403: errorSchemas.unauthorized,
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
