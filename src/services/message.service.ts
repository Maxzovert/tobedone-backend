import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "../db";
import { messages, reactions, users } from "../db/schema";
import { createId } from "../utils/id";
import { createNotification } from "./notification.service";
import { Server as SocketServer } from "socket.io";

let io: SocketServer | null = null;

export function setMessageSocketServer(server: SocketServer) {
  io = server;
}

export async function getMessages(
  groupId: string,
  cursor?: string,
  limit = 30
) {
  const conditions = [eq(messages.groupId, groupId)];

  if (cursor) {
    const [cursorMsg] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, cursor));
    if (cursorMsg) {
      conditions.push(lt(messages.createdAt, cursorMsg.createdAt));
    }
  }

  const msgs = await db
    .select({
      id: messages.id,
      groupId: messages.groupId,
      content: messages.content,
      attachments: messages.attachments,
      mentionedUserIds: messages.mentionedUserIds,
      readBy: messages.readBy,
      createdAt: messages.createdAt,
      sender: {
        id: users.id,
        name: users.name,
        avatar: users.avatar,
        email: users.email,
      },
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  const messageIds = msgs.map((m) => m.id);
  const allReactions =
    messageIds.length > 0
      ? await db
          .select({
            id: reactions.id,
            messageId: reactions.messageId,
            emoji: reactions.emoji,
            userId: reactions.userId,
            userName: users.name,
          })
          .from(reactions)
          .innerJoin(users, eq(reactions.userId, users.id))
          .where(inArray(reactions.messageId, messageIds))
      : [];

  const reactionsByMessage = allReactions.reduce(
    (acc, r) => {
      if (!acc[r.messageId]) acc[r.messageId] = [];
      acc[r.messageId].push(r);
      return acc;
    },
    {} as Record<string, typeof allReactions>
  );

  return {
    messages: msgs.reverse(),
    nextCursor: msgs.length === limit ? msgs[0]?.id : undefined,
  };
}

export async function createMessage(
  senderId: string,
  data: {
    groupId: string;
    content: string;
    attachments?: string[];
    mentionedUserIds?: string[];
  }
) {
  const [message] = await db
    .insert(messages)
    .values({
      id: createId(),
      groupId: data.groupId,
      senderId,
      content: data.content,
      attachments: data.attachments || [],
      mentionedUserIds: data.mentionedUserIds || [],
      readBy: [senderId],
    })
    .returning();

  const [sender] = await db
    .select({
      id: users.id,
      name: users.name,
      avatar: users.avatar,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, senderId));

  const enriched = { ...message, sender, reactions: [] };

  if (io) {
    io.to(`discussion:${data.groupId}`).emit("message:new", enriched);
  }

  for (const mentionedId of data.mentionedUserIds || []) {
    if (mentionedId !== senderId) {
      await createNotification({
        userId: mentionedId,
        title: "You were mentioned",
        body: data.content.slice(0, 100),
        type: "mention",
      });
    }
  }

  return enriched;
}

export async function toggleReaction(
  userId: string,
  messageId: string,
  emoji: string
) {
  const [existing] = await db
    .select()
    .from(reactions)
    .where(
      and(
        eq(reactions.messageId, messageId),
        eq(reactions.userId, userId),
        eq(reactions.emoji, emoji)
      )
    );

  if (existing) {
    await db.delete(reactions).where(eq(reactions.id, existing.id));
    const payload = { messageId, emoji, userId, action: "remove" as const };
    if (io) io.to(`discussion:${messageId}`).emit("message:reaction", payload);
    return payload;
  }

  const [reaction] = await db
    .insert(reactions)
    .values({
      id: createId(),
      messageId,
      userId,
      emoji,
    })
    .returning();

  const [msg] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId));

  const payload = { ...reaction, action: "add" as const };
  if (io && msg) {
    io.to(`discussion:${msg.groupId}`).emit("message:reaction", payload);
  }

  return payload;
}

export async function markMessageRead(messageId: string, userId: string) {
  const [msg] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId));
  if (!msg) return null;

  const readBy = msg.readBy || [];
  if (!readBy.includes(userId)) {
    readBy.push(userId);
    await db
      .update(messages)
      .set({ readBy })
      .where(eq(messages.id, messageId));
  }
  return { messageId, readBy };
}
