import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
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
    console.log('Password comparison result:', result);
    return result;
  } catch (err) {
    console.log('Password comparison error:', err);
    return false;
  }
}

export function setupAuth(app: Express) {
  // Simple memory session store for Vercel
  const sessionStore = new Map();
  
  app.use(session({
    store: new (session.Store as any)({
      get: (sid: any, callback: any) => {
        const sessionData = sessionStore.get(sid);
        callback(null, sessionData || null);
      },
      set: (sid: any, session: any, callback: any) => {
        sessionStore.set(sid, session);
        callback(null);
      },
      destroy: (sid: any, callback: any) => {
        sessionStore.delete(sid);
        callback(null);
      }
    }),
    secret: process.env.SESSION_SECRET || "your-secret-key",
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
