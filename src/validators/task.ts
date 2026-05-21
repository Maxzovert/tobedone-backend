import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "rejected"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedTo: z.string().optional(),
  taskGroupId: z.string(),
  dueDate: z.string().datetime().optional().nullable(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "rejected"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedTo: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

export const respondTaskSchema = z.object({
  action: z.enum(["accept", "reject"]),
});
