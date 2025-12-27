import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage.js";
import { User } from "../shared/schema.js";
import { supabase } from "./supabase-secure.js";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = (stored || "").split(".");
  if (!hashed || !salt) return false;

  try {
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch {
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionStore = session({
    store: new (session.Store as any)({
      // Use Supabase for session storage
      async: true,
      async get(sid: any, callback: any) {
        try {
          const { data } = await supabase
            .from('sessions')
            .select('*')
            .eq('session_id', sid)
            .single();
          
          if (data && new Date(data.expires_at) > new Date()) {
            callback(null, data);
          } else {
            callback(null, null);
          }
        } catch (error) {
          callback(error);
        }
      },
      async set(sid: any, session: any, callback: any) {
        try {
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
          await supabase
            .from('sessions')
            .upsert({
              session_id: sid,
              user_id: session.passport?.user,
              created_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
              ip_address: session.ip,
              user_agent: session.userAgent
            });
          callback(null);
        } catch (error) {
          callback(error);
        }
      },
      async destroy(sid: any, callback: any) {
        try {
          await supabase
            .from('sessions')
            .delete()
            .eq('session_id', sid);
          callback(null);
        } catch (error) {
          callback(error);
        }
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
  });

  app.use(sessionStore);

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    }),
  );

  app.use(passport.session());
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
