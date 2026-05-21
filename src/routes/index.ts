import { Router } from "express";
import authRoutes from "./auth.routes";
import projectRoutes from "./project.routes";
import taskRoutes from "./task.routes";
import todoRoutes from "./todo.routes";
import messageRoutes from "./message.routes";
import notificationRoutes from "./notification.routes";
import profileRoutes from "./profile.routes";
import dashboardRoutes from "./dashboard.routes";
import uploadRoutes from "./upload.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/projects", projectRoutes);
router.use("/tasks", taskRoutes);
router.use("/todos", todoRoutes);
router.use("/messages", messageRoutes);
router.use("/notifications", notificationRoutes);
router.use("/profile", profileRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/upload", uploadRoutes);

export default router;
