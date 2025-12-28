import { Express, Request, Response } from "express";
import crypto from 'crypto';
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import bcrypt from "bcrypt";
import { storage } from "./storage.js";
import { User } from "../shared/schema.js";
import './types.d.ts';

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

// Simple JWT-like token for Vercel
function generateToken(user: User): string {
  const tokenData = {
    id: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  return Buffer.from(JSON.stringify(tokenData)).toString('base64');
}

function verifyToken(token: string): User | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    if (decoded.exp < Date.now()) {
      return null;
    }
    return {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      fullName: '', // Will be filled from storage if needed
      createdAt: new Date()
    };
  } catch {
    return null;
  }
}

// Middleware to check authentication
export function authenticateToken(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.auth_token;
  
  if (!token) {
    req.user = null;
    req.isAuthenticated = () => false;
    return next();
  }
  
  const user = verifyToken(token);
  if (user) {
    req.user = user;
    req.isAuthenticated = () => true;
  } else {
    req.user = null;
    req.isAuthenticated = () => false;
  }
  
  next();
}

export function setupAuth(app: Express) {
  // Add authentication middleware
  app.use(authenticateToken);
  
  // Login endpoint
  app.post('/api/auth/login', async (req, res) => {
    try {
      console.log('Auth attempt for username:', req.body.username);
      const user = await storage.getUserByUsername(req.body.username);
      console.log('User found:', !!user);
      
      if (!user || !(await comparePasswords(req.body.password, user.password))) {
        console.log('Auth failed');
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      console.log('Auth successful for user:', user.username);
      const token = generateToken(user);
      
      // Set token in cookie and response
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      res.status(200).json({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      });
    } catch (err) {
      console.log('Auth error:', err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.status(200).json({ message: "Logged out successfully" });
  });

  // Get current user endpoint
  app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    res.json(req.user);
  });

  // Helper to register new users (Admin creates them)
  return { hashPassword };
}
