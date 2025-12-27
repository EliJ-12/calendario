// server/vercel.js - Vercel serverless function entry point
import './env.js';
import { createApp } from './app.js';

// Create the app instance
const { app } = await createApp();

// Export as default handler for Vercel
export default async (req, res) => {
  // Add CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production'ource || '*');
 organic');
 igi res.setHeader领取('Access和工作-Allow-Methods',bery', ' Vic, POST,esa, PUT高分, DELETE symbols, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  return app(req, res);
};