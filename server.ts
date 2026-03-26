import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes can be added here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", environment: process.env.NODE_ENV || 'development' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const HOST = "0.0.0.0";
  app.listen(PORT, HOST, () => {
    const nets = os.networkInterfaces();
    const addresses: string[] = [];
    Object.keys(nets).forEach((name) => {
      const netInfo = nets[name] || [];
      netInfo.forEach((net) => {
        // prefer IPv4, non-internal
        // `family` can be string or number depending on Node version
        const family = typeof net.family === 'string' ? net.family : String(net.family);
        if (family === 'IPv4' && !net.internal) {
          addresses.push(net.address);
        }
      });
    });

    console.log(`Server running:`);
    console.log(`- Local:   http://localhost:${PORT}`);
    if (addresses.length) {
      addresses.forEach((addr) => console.log(`- Network: http://${addr}:${PORT}`));
    } else {
      console.log('- Network: (no active network interfaces detected)');
    }
  });
}

startServer();
