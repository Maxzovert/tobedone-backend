import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import * as notificationService from "../services/notification.service";
import { sendError, sendSuccess } from "../utils/response";
import * as pushService from "../services/push.service";

export async function listNotifications(
  req: AuthenticatedRequest,
  res: Response
) {
  const items = await notificationService.getNotifications(req.user!.userId);
  const unreadCount = items.filter((n) => !n.read).length;
  return sendSuccess(res, { notifications: items, unreadCount });
}

export async function markRead(req: AuthenticatedRequest, res: Response) {
  const { id } = req.body;
  const updated = await notificationService.markNotificationRead(
    req.user!.userId,
    id
  );
  return sendSuccess(res, updated);
}

export async function markAllRead(req: AuthenticatedRequest, res: Response) {
  await notificationService.markAllNotificationsRead(req.user!.userId);
  return sendSuccess(res, { success: true });
}

export async function registerPushToken(req: AuthenticatedRequest, res: Response) {
  const { token, platform } = req.body;
  if (!token?.startsWith("ExponentPushToken[")) {
    return sendError(res, "Invalid Expo push token", 400);
  }
  const row = await pushService.registerPushToken(
    req.user!.userId,
    token,
    platform
  );
  return sendSuccess(res, { registered: true, id: row?.id });
}

export async function removePushToken(req: AuthenticatedRequest, res: Response) {
  const { token } = req.body;
  if (token) {
    await pushService.removePushToken(req.user!.userId, token);
  }
  return sendSuccess(res, { removed: true });
}
