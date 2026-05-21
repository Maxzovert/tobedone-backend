import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);
router.get("/", notificationController.listNotifications);
router.patch("/read", notificationController.markRead);
router.patch("/read-all", notificationController.markAllRead);

export default router;
