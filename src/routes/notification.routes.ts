import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { authMiddleware } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { validateBody } from "../middleware/validate";
import {
  registerPushTokenSchema,
  removePushTokenSchema,
} from "../validators/push";
import { deleteNotificationSchema } from "../validators/notification";

const router = Router();

router.use(authMiddleware);
router.get("/", asyncHandler(notificationController.listNotifications));
router.patch("/read", asyncHandler(notificationController.markRead));
router.patch("/read-all", asyncHandler(notificationController.markAllRead));
router.patch("/clear-all", asyncHandler(notificationController.deleteAllNotifications));
router.patch(
  "/delete",
  validateBody(deleteNotificationSchema),
  asyncHandler(notificationController.deleteNotificationByBody)
);
router.delete("/all", asyncHandler(notificationController.deleteAllNotifications));
router.post("/clear-all", asyncHandler(notificationController.deleteAllNotifications));
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
router.delete("/:id", asyncHandler(notificationController.deleteNotification));
router.post("/:id/remove", asyncHandler(notificationController.deleteNotification));

export default router;
