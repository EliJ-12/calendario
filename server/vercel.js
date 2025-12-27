// server/vercel.js
import './env.js';
import { createApp } from './app.js';

let appInstance;

export default async function handler(req, res) {
  if (!appInstance) {
    const { app } = await createApp();
    appInstance = app;
  }
  return appInstance(req, res);
}