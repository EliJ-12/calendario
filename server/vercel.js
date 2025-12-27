// server/vercel.js
import './env.js';
import app from './index.js';

export default async (req, res) => {
  return app(req, res);
};