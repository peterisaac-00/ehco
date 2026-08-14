import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";

function isAllowedCorsOrigin(origin: string, requestHost: string | undefined) {
  if (ENV.corsAllowedOrigins.includes(origin)) return true;
  if (!ENV.isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  try {
    const originUrl = new URL(origin);
    const apiHost = (requestHost ?? "").split(":")[0];
    const previewHost = /^\d+-(.+\.manus\.computer)$/.exec(apiHost)?.[1];
    const originPreviewHost = /^\d+-(.+\.manus\.computer)$/.exec(originUrl.host)?.[1];
    return originUrl.protocol === "https:" && Boolean(previewHost && originPreviewHost && previewHost === originPreviewHost);
  } catch {
    return false;
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowed = typeof origin === "string" && isAllowedCorsOrigin(origin, req.headers.host);
    if (allowed && origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    if (req.method === "OPTIONS") {
      if (origin && !allowed) {
        res.sendStatus(403);
        return;
      }
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // The deployed mobile project also provides a web fallback. Serve the Expo
  // static export in production while keeping all API routes above intact.
  if (process.env.NODE_ENV === "production") {
    const webExportDir = path.resolve(process.cwd(), "dist", "client");
    const webEntry = path.join(webExportDir, "index.html");
    app.use(express.static(webExportDir));
    app.get("*", (_req, res) => {
      res.sendFile(webEntry);
    });
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
