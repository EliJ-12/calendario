import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { serveStatic } from "./static.js";
import { setupAuth } from "./auth-supabase.js";
import { createApp } from "./app.js";
import express from 'express';

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// Crear la aplicación Express
const app = express();
const httpServer = createServer(app);

// Configurar autenticación
setupAuth(app);

// Configuración común
app.use(express.json());

// Rutas de la API
app.use('/api', (req, res, next) => {
  // Tu lógica de rutas aquí
});

// Configuración para Vite en desarrollo
if (process.env.NODE_ENV === "production") {
  serveStatic(app);
} else {
  const { setupVite } = await import("./vite.js");
  await setupVite(httpServer, app);
}

// Exportar para Vercel
export default async (req: any, res: any) => {
  return app(req, res);
};

// Iniciar servidor solo si no estamos en Vercel
if (process.env.VERCEL !== '1') {
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
}