import express from "express";
import cors from "cors";
import path from "path";
import { createServer } from "http";
import { config } from "./config";
import apiRoutes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { initSocketServer } from "./sockets";

const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), config.uploadDir)));

app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.use("/api", apiRoutes);

app.use(errorHandler);

initSocketServer(httpServer);

httpServer.listen(config.port, "0.0.0.0", () => {
  console.log(`Tobedone API running on http://localhost:${config.port}`);
  console.log(`LAN access: use your machine IP, e.g. http://192.168.x.x:${config.port}`);
});
