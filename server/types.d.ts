import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      isAuthenticated(): boolean;
      user?: {
        id: number;
        username: string;
        role: string;
        fullName: string;
        createdAt: Date;
      };
    }
  }
}

export {};
