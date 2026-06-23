import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { notifications } from "../db/schema";
import { createId } from "../utils/id";
import { Server as SocketServer } from "socket.io";
import { sendPushToUser } from "./push.service";

let io: SocketServer | null = null;

export function setSocketServer(server: SocketServer) {
  io = server;
}

export async function createNotification(params: {
  userId: string;
  title: string;
  body?: string;
  type: string;
}) {
  const [notification] = await db
    .insert(notifications)
    .values({
      id: createId(),
      userId: params.userId,
      title: params.title,
      body: params.body,
      type: params.type,
    })
    .returning();

  if (io) {
    io.to(`user:${params.userId}`).emit("notification:new", notification);
  }

  void sendPushToUser(params.userId, {
    title: params.title,
    body: params.body,
    data: {
      notificationId: notification.id,
      type: params.type,
    },
    channelId:
      params.type === "task_urgent_reminder" ? "urgent" : "default",
  });

  return notification;
}

export async function getNotifications(userId: string) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt));
}

export async function markNotificationRead(userId: string, id: string) {
  const [updated] = await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, id))
    .returning();
  return updated;
}

export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, userId));
}
