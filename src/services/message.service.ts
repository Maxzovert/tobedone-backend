import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "../db";
import { messages, projectMembers, reactions, tasks, users } from "../db/schema";
import { createId } from "../utils/id";
import { createNotification } from "./notification.service";
import { createTask } from "./task.service";
import { assertGroupPostAccess } from "./project.service";
import { Server as SocketServer } from "socket.io";

let io: SocketServer | null = null;

export function setMessageSocketServer(server: SocketServer) {
  io = server;
}

function getDiscussionViewerIds(groupId: string): Set<string> {
  if (!io) return new Set();
  const room = io.sockets.adapter.rooms.get(`discussion:${groupId}`);
  if (!room) return new Set();

  const viewerIds = new Set<string>();
  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId) as
      | { user?: { userId: string } }
      | undefined;
    const id = socket?.user?.userId;
    if (id) viewerIds.add(id);
  }
  return viewerIds;
}

function messagePreview(content: string, attachments?: string[]) {
  const text = content.trim();
  if (text) return text.slice(0, 100);
  if (attachments?.length) return "Sent an attachment";
  return "New message";
}

async function notifyMessageRecipients(params: {
  group: { id: string; name: string; projectId: string };
  senderId: string;
  senderName: string;
  content: string;
  attachments?: string[];
  mentionedUserIds: string[];
  assigneeId?: string;
}) {
  const members = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, params.group.projectId));

  const preview = messagePreview(params.content, params.attachments);
  const mentioned = new Set(params.mentionedUserIds);
  const viewers = getDiscussionViewerIds(params.group.id);
  const chatData = {
    groupId: params.group.id,
    projectId: params.group.projectId,
    groupName: params.group.name,
  };

  for (const { userId } of members) {
    if (userId === params.senderId) continue;
    if (viewers.has(userId)) continue;
    if (mentioned.has(userId)) continue;
    if (params.assigneeId && userId === params.assigneeId) continue;

    await createNotification({
      userId,
      title: `${params.senderName} · ${params.group.name}`,
      body: preview,
      type: "message",
      data: chatData,
    });
  }
}

export async function broadcastTaskUpdate(
  taskId: string,
  patch: { status: string; title?: string }
) {
  if (!io) return;
  const rows = await db
    .select({ groupId: messages.groupId })
    .from(messages)
    .where(eq(messages.linkedTaskId, taskId));
  const groupIds = [...new Set(rows.map((r) => r.groupId))];
  for (const groupId of groupIds) {
    io.to(`discussion:${groupId}`).emit("task:updated", { taskId, ...patch });
  }
}

async function fetchLinkedTasks(taskIds: string[]) {
  if (taskIds.length === 0) return {} as Record<string, typeof taskRows[0]>;
  const taskRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      assignedTo: tasks.assignedTo,
      taskGroupId: tasks.taskGroupId,
      assigneeName: users.name,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assignedTo, users.id))
    .where(inArray(tasks.id, taskIds));

  return taskRows.reduce(
    (acc, t) => {
      acc[t.id] = {
        ...t,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      };
      return acc;
    },
    {} as Record<string, (typeof taskRows)[0]>
  );
}

function enrichMessage(
  message: typeof messages.$inferSelect & { sender: { id: string; name: string; avatar: string | null; email: string } },
  reactionsList: unknown[] = [],
  linkedTask?: Awaited<ReturnType<typeof fetchLinkedTasks>>[string]
) {
  return {
    ...message,
    reactions: reactionsList,
    linkedTask: linkedTask ?? null,
  };
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
      linkedTaskId: messages.linkedTaskId,
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
  const linkedTaskIds = msgs
    .map((m) => m.linkedTaskId)
    .filter((id): id is string => !!id);
  const tasksById = await fetchLinkedTasks(linkedTaskIds);

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
    messages: msgs
      .reverse()
      .map((m) =>
        enrichMessage(
          m as Parameters<typeof enrichMessage>[0],
          reactionsByMessage[m.id] || [],
          m.linkedTaskId ? tasksById[m.linkedTaskId] : undefined
        )
      ),
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
    linkedTaskId?: string;
    assignTask?: {
      title: string;
      assignedTo: string;
      taskGroupId: string;
      priority?: string;
      dueDate?: string | null;
    };
  }
) {
  const group = await assertGroupPostAccess(data.groupId, senderId);
  if (!group) return null;

  let linkedTaskId = data.linkedTaskId;
  const mentioned = new Set(data.mentionedUserIds || []);

  if (data.assignTask) {
    const task = await createTask(senderId, {
      title: data.assignTask.title,
      assignedTo: data.assignTask.assignedTo,
      taskGroupId: data.assignTask.taskGroupId,
      priority: data.assignTask.priority,
      dueDate: data.assignTask.dueDate,
    });
    if (!task) return null;
    linkedTaskId = task.id;
    mentioned.add(data.assignTask.assignedTo);
  }

  const mentionedUserIds = [...mentioned];

  const [message] = await db
    .insert(messages)
    .values({
      id: createId(),
      groupId: data.groupId,
      senderId,
      content: data.content,
      attachments: data.attachments || [],
      mentionedUserIds,
      linkedTaskId: linkedTaskId ?? null,
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

  const tasksById = linkedTaskId
    ? await fetchLinkedTasks([linkedTaskId])
    : {};
  const enriched = enrichMessage(
    { ...message, sender: sender! },
    [],
    linkedTaskId ? tasksById[linkedTaskId] : undefined
  );

  if (io) {
    io.to(`discussion:${data.groupId}`).emit("message:new", enriched);
  }

  const assigneeId = data.assignTask?.assignedTo;
  const chatData = {
    groupId: data.groupId,
    projectId: group.projectId,
    groupName: group.name,
  };
  const preview = messagePreview(data.content, data.attachments);

  for (const mentionedId of mentionedUserIds) {
    if (mentionedId === senderId) continue;
    if (linkedTaskId && mentionedId === assigneeId) continue;

    await createNotification({
      userId: mentionedId,
      title: "You were mentioned",
      body: preview,
      type: "mention",
      data: chatData,
    });
  }

  await notifyMessageRecipients({
    group,
    senderId,
    senderName: sender!.name,
    content: data.content,
    attachments: data.attachments,
    mentionedUserIds,
    assigneeId,
  });

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
