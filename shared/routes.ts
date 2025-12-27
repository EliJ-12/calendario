import { z } from 'zod';
import { insertUserSchema, insertWorkLogSchema, insertAbsenceSchema, users, workLogs, absences } from './schema.js';

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
  workLogs: {
    list: {
      method: 'GET' as const,
      path: '/api/work-logs',
      input: z.object({
        userId: z.coerce.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof workLogs.$inferSelect & { user?: typeof users.$inferSelect }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/work-logs',
      input: insertWorkLogSchema,
      responses: {
        201: z.custom<typeof workLogs.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/work-logs/:id',
      input: insertWorkLogSchema.partial(),
      responses: {
        200: z.custom<typeof workLogs.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  absences: {
    list: {
      method: 'GET' as const,
      path: '/api/absences',
      input: z.object({
        userId: z.coerce.number().optional(),
        status: z.enum(['pending', 'approved', 'rejected']).optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof absences.$inferSelect & { user?: typeof users.$inferSelect }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/absences',
      input: insertAbsenceSchema,
      responses: {
        201: z.custom<typeof absences.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/absences/:id/status',
      input: z.object({ status: z.enum(['approved', 'rejected']) }),
      responses: {
        200: z.custom<typeof absences.$inferSelect>(),
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
