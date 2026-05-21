import { z } from "zod";

export const createMessageSchema = z.object({
  groupId: z.string(),
  content: z.string().min(1),
  attachments: z.array(z.string()).optional(),
  mentionedUserIds: z.array(z.string()).optional(),
});

export const reactMessageSchema = z.object({
  messageId: z.string(),
  emoji: z.string().min(1).max(32),
});

export const messagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).optional().default(30),
});
