import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../server/app";

let appPromise: Promise<{ app: any }> | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!appPromise) {
    appPromise = createApp();
  }

  const { app } = await appPromise;
  return app(req, res);
}
