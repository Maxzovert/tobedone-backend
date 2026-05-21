import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import * as notificationService from "../services/notification.service";
import { sendSuccess } from "../utils/response";

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
