import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import bcrypt from "bcrypt";
import MemoryStore from "memorystore";
import { storage } from "./storage.js";
import { User } from "../shared/schema.js";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  console.log('Comparing passwords, stored password format:', stored ? stored.substring(0, 20) + '...' : 'null');
  
  // Check if it's a bcrypt hash (starts with $2b$, $2a$, etc.)
  if (stored.startsWith('$2')) {
    console.log('Detected bcrypt format, using bcrypt comparison');
    try {
      const result = await bcrypt.compare(supplied, stored);
      console.log('Bcrypt comparison result:', result);
      return result;
    } catch (err) {
      console.log('Bcrypt comparison error:', err);
      return false;
    }
  }
  
  // Handle custom scrypt format (hash.salt)
  const [hashed, salt] = (stored || "").split(".");
  console.log('Hashed part length:', hashed?.length, 'Salt length:', salt?.length);
  
  if (!hashed || !salt) {
    console.log('Invalid password format - missing hash or salt');
    return false;
  }

  try {
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    const result = timingSafeEqual(hashedBuf, suppliedBuf);
    console.log('Scrypt comparison result:', result);
    return result;
  } catch (err) {
    console.log('Scrypt comparison error:', err);
    return false;
  }
}

export function setupAuth(app: Express) {
  // Simple in-memory session store for Vercel serverless
  const sessions = new Map();
  const eventListeners = new Map();
  
  app.use(session({
    store: {
      get: (sid: string, callback: (err: any, data?: any) => void) => {
        callback(null, sessions.get(sid) || null);
      },
      set: (sid: string, session: any, callback: (err?: any) => void) => {
        sessions.set(sid, session);
        callback();
      },
      destroy: (sid: string, callback: (err?: any) => void) => {
        sessions.delete(sid);
        callback();
      },
      regenerate: (sid: number, callback: (err?: any) => void) => {
        callback();
      },
      load: (sid: string, callback: (err: any, session?: any) => void) => {
        callback(null, sessions.get(sid) || null);
      },
      createSession: (req: any, callback: (err: any, session?: any) => void) => {
        const session = {
          cookie: {
            originalMaxAge: 24 * 60 * 60 * 1000,
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            path: '/',
            sameSite: "lax"
          }
        };
        callback(null, session);
      },
      touch: (sid: string, session: any, callback: (err?: any) => void) => {
        if (session.cookie) {
          session.cookie.expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }
        callback();
      },
      all: (callback: (err: any, obj?: any) => void) => {
        callback(null, Array.from(sessions.entries()));
      },
      length: (callback: (err: any, length?: number) => void) => {
        callback(null, sessions.size);
      },
      clear: (callback: (err?: any) => void) => {
        sessions.clear();
        callback();
      },
      ids: (callback: (err: any, ids?: string[]) => void) => {
        callback(null, Array.from(sessions.keys()));
      },
      on: (event: string, listener: Function) => {
        if (!eventListeners.has(event)) {
          eventListeners.set(event, []);
        }
        eventListeners.get(event).push(listener);
      },
      emit: (event: string, ...args: any[]) => {
        const listeners = eventListeners.get(event) || [];
        listeners.forEach(listener => listener(...args));
      },
      addListener: (event: string, listener: Function) => {
        if (!eventListeners.has(event)) {
          eventListeners.set(event, []);
        }
        eventListeners.get(event).push(listener);
      },
      removeListener: (event: string, listener: Function) => {
        const listeners = eventListeners.get(event) || [];
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      },
      listeners: (event?: string) => {
        if (event) {
          return eventListeners.get(event) || [];
        }
        return Array.from(eventListeners.values()).flat();
      },
      once: (event: string, listener: Function) => {
        const onceListener = (...args: any[]) => {
          listener(...args);
          const listeners = eventListeners.get(event) || [];
          const index = listeners.indexOf(onceListener);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        };
        if (!eventListeners.has(event)) {
          eventListeners.set(event, []);
        }
        eventListeners.get(event).push(onceListener);
      }
    } as any,
    secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    }
  }));

  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log('Auth attempt for username:', username);
        const user = await storage.getUserByUsername(username);
        console.log('User found:', !!user);
        
        if (!user || !(await comparePasswords(password, user.password))) {
          console.log('Auth failed');
          return done(null, false);
        } else {
          console.log('Auth successful for user:', user.username);
          return done(null, user);
        }
      } catch (err) {
        console.log('Auth error:', err);
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, (user as User).id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
    console.log('Login successful, user:', req.user);
    res.status(200).json(req.user);
  });

  app.post("/api/auth/logout", (req: any, res: any, next: any) => {
    req.logout((err: any) => {
      if (err) return next(err);
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    res.json(req.user);
  });

  // Helper to register new users (Admin creates them)
  return { hashPassword };
}
