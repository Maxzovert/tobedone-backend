import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { authMiddleware } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.use(authMiddleware);
router.get("/", asyncHandler(notificationController.listNotifications));
router.patch("/read", asyncHandler(notificationController.markRead));
router.patch("/read-all", asyncHandler(notificationController.markAllRead));

export default router;
