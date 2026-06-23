import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { pushTokens } from "../db/schema";
import { config } from "../config";
import { createId } from "../utils/id";

type ExpoPushMessage = {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, string>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  channelId?: string;
};

type ExpoPushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

export async function registerPushToken(
  userId: string,
  token: string,
  platform?: string
) {
  const [existing] = await db
    .select()
    .from(pushTokens)
    .where(eq(pushTokens.token, token));

  if (existing) {
    if (existing.userId !== userId) {
      await db
        .update(pushTokens)
        .set({ userId, platform, updatedAt: new Date() })
        .where(eq(pushTokens.token, token));
    }
    return existing;
  }

  const [row] = await db
    .insert(pushTokens)
    .values({
      id: createId(),
      userId,
      token,
      platform,
    })
    .returning();
  return row;
}

export async function removePushToken(userId: string, token: string) {
  await db
    .delete(pushTokens)
    .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
}

export async function removeAllPushTokensForUser(userId: string) {
  await db.delete(pushTokens).where(eq(pushTokens.userId, userId));
}

export async function sendPushToUser(
  userId: string,
  payload: {
    title: string;
    body?: string;
    data?: Record<string, string>;
    channelId?: string;
  }
) {
  const tokens = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(eq(pushTokens.userId, userId));

  if (!tokens.length) return;

  const channelId =
    payload.channelId ||
    (payload.data?.type === "task_urgent_reminder" ? "urgent" : "default");

  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: "default",
    priority: channelId === "urgent" ? "high" : "high",
    channelId,
  }));

  await sendExpoPushBatch(messages);
}

async function sendExpoPushBatch(messages: ExpoPushMessage[]) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  if (config.expoAccessToken) {
    headers.Authorization = `Bearer ${config.expoAccessToken}`;
  }

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("Expo push HTTP error:", res.status, text);
      return;
    }

    const tickets = (await res.json()) as ExpoPushTicket | ExpoPushTicket[];
    const list = Array.isArray(tickets) ? tickets : [tickets];
    const stale: string[] = [];

    list.forEach((ticket, i) => {
      if (ticket.status === "error") {
        const err = ticket.details?.error || ticket.message;
        if (err === "DeviceNotRegistered" && messages[i]) {
          stale.push(messages[i].to);
        } else {
          console.warn("Expo push ticket error:", err);
        }
      }
    });

    if (stale.length) {
      await db.delete(pushTokens).where(inArray(pushTokens.token, stale));
    }
  } catch (err) {
    console.warn("Expo push send failed:", err);
  }
}
