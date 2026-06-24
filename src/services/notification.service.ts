import { eq, desc, and, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { notifications, tasks, todos } from "../db/schema";
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
  data?: Record<string, string>;
}) {
  const extra = params.data ?? null;

  const [notification] = await db
    .insert(notifications)
    .values({
      id: createId(),
      userId: params.userId,
      title: params.title,
      body: params.body,
      type: params.type,
      data: extra,
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
      ...(extra ?? {}),
    },
    channelId:
      params.type === "task_urgent_reminder" ? "urgent" : "default",
  });

  return notification;
}

const TASK_REMINDER_TYPES = [
  "task_urgent_reminder",
  "task_due_reminder",
  "task_priority_reminder",
] as const;

const TASK_TODO_TYPES = [
  ...TASK_REMINDER_TYPES,
  "task_assigned",
  "project_task",
] as const;

async function isTaskNotificationStale(
  userId: string,
  taskId: string,
  type: string
): Promise<boolean> {
  const [task] = await db
    .select({ status: tasks.status })
    .from(tasks)
    .where(eq(tasks.id, taskId));

  if (!task) return true;

  const [todo] = await db
    .select({ completed: todos.completed })
    .from(todos)
    .where(and(eq(todos.taskId, taskId), eq(todos.userId, userId)));

  if (TASK_REMINDER_TYPES.includes(type as (typeof TASK_REMINDER_TYPES)[number])) {
    if (task.status === "completed" || task.status === "rejected") return true;
    if (!todo || todo.completed) return true;
    return false;
  }

  if (
    type === "task_assigned" ||
    type === "project_task"
  ) {
    return !todo;
  }

  return false;
}

/** Remove alerts for deleted/completed tasks so they do not reappear on refresh. */
export async function purgeStaleNotificationsForUser(userId: string) {
  const items = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId));

  const staleIds: string[] = [];

  for (const item of items) {
    const taskId = item.data?.taskId;

    if (
      !taskId &&
      TASK_REMINDER_TYPES.includes(item.type as (typeof TASK_REMINDER_TYPES)[number])
    ) {
      staleIds.push(item.id);
      continue;
    }

    if (!taskId || !TASK_TODO_TYPES.includes(item.type as (typeof TASK_TODO_TYPES)[number])) {
      continue;
    }
    if (await isTaskNotificationStale(userId, taskId, item.type)) {
      staleIds.push(item.id);
    }
  }

  if (staleIds.length > 0) {
    await db.delete(notifications).where(inArray(notifications.id, staleIds));
  }
}

export async function deleteNotificationsForTask(taskId: string) {
  await db
    .delete(notifications)
    .where(sql`${notifications.data}->>'taskId' = ${taskId}`);
}

export async function deleteNotificationsForUserTask(
  userId: string,
  taskId: string
) {
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        sql`${notifications.data}->>'taskId' = ${taskId}`
      )
    );
}

export async function getNotifications(userId: string) {
  try {
    await purgeStaleNotificationsForUser(userId);
  } catch (err) {
    console.warn("purgeStaleNotificationsForUser failed:", err);
  }

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
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();
  return updated;
}

export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, userId));
}

export async function deleteNotification(userId: string, id: string) {
  const [deleted] = await db
    .delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();
  return deleted ?? null;
}

export async function deleteAllNotifications(userId: string) {
  await db.delete(notifications).where(eq(notifications.userId, userId));
}
