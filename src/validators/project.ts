import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const joinProjectSchema = z.object({
  inviteCode: z.string().min(4).max(16),
});
