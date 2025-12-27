// server/vercel.js - Vercel serverless function entry point
import './env.js';
import { createApp } from './app.js';

// Create the app instance
const { app } = await createApp();

// Export as default handler for Vercel
export default async (req, res) => {
  // Add CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' ? process.env.VERCEL_URL || '*' : '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  return app(req, res);
};