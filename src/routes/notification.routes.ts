import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { authMiddleware } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { validateBody } from "../middleware/validate";
import {
  registerPushTokenSchema,
  removePushTokenSchema,
} from "../validators/push";

const router = Router();

router.use(authMiddleware);
router.get("/", asyncHandler(notificationController.listNotifications));
router.patch("/read", asyncHandler(notificationController.markRead));
router.patch("/read-all", asyncHandler(notificationController.markAllRead));
router.post(
  "/push-token",
  validateBody(registerPushTokenSchema),
  asyncHandler(notificationController.registerPushToken)
);
router.post(
  "/push-token/remove",
  validateBody(removePushTokenSchema),
  asyncHandler(notificationController.removePushToken)
);

export default router;
