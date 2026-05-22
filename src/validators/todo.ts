import { z } from "zod";

export const createTodoSchema = z.object({
  title: z.string().min(1).max(500),
});

export const updateTodoSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
  taskStatus: z.enum(["in_progress", "completed"]).optional(),
});
