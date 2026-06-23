import express from "express";
import cors from "cors";
import path from "path";
import { createServer } from "http";
import { config } from "./config";
import { isCloudinaryConfigured } from "./services/cloudinary.service";
import apiRoutes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { sendError } from "./utils/response";
import { initSocketServer } from "./sockets";
import { pool, checkDatabase } from "./db";
import { startReminderScheduler } from "./services/reminder.service";

const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), config.uploadDir)));

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ success: true, data: { status: "ok", database: "connected" } });
  } catch (err) {
    console.error("Database health check failed:", err);
    res.status(503).json({
      success: false,
      error:
        "Database unreachable. Check DATABASE_URL and your internet connection.",
    });
  }
});

app.use("/api", apiRoutes);

app.use("/api", (_req, res) => {
  sendError(res, "Not found", 404);
});

app.use(errorHandler);

initSocketServer(httpServer);

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${config.port} is already in use. Stop the other process:\n` +
        `  netstat -ano | findstr :${config.port}\n` +
        `  taskkill /PID <pid> /F`
    );
  } else {
    console.error("Server error:", err);
  }
  process.exit(1);
});

httpServer.listen(config.port, "0.0.0.0", async () => {
  console.log(`Tobedone API running on http://localhost:${config.port}`);
  console.log(`LAN access: use your machine IP, e.g. http://192.168.x.x:${config.port}`);
  if (isCloudinaryConfigured()) {
    console.log(`Cloudinary: enabled (folder: ${config.cloudinary.folder})`);
  } else {
    console.warn(
      "Cloudinary: not configured — images saved locally. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET on Render."
    );
  }

  const ok = await checkDatabase();
  if (ok) {
    console.log("Database: connected");
    startReminderScheduler();
  } else {
    console.error(
      "Database: NOT reachable (ENOTFOUND / offline).\n" +
        "  1. Check internet connection\n" +
        "  2. Open Neon console → copy a fresh connection string into backend/.env\n" +
        "  3. Restart: npm run dev"
    );
  }
});
