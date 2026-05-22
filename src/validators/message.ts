import { z } from "zod";

const assignTaskSchema = z.object({
  title: z.string().min(1).max(500),
  assignedTo: z.string(),
  taskGroupId: z.string(),
});

export const createMessageSchema = z.object({
  groupId: z.string(),
  content: z.string().min(1),
  attachments: z.array(z.string()).optional(),
  mentionedUserIds: z.array(z.string()).optional(),
  linkedTaskId: z.string().optional(),
  assignTask: assignTaskSchema.optional(),
});

export const reactMessageSchema = z.object({
  messageId: z.string(),
  emoji: z.string().min(1).max(32),
});

export const messagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).optional().default(30),
});
