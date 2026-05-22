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

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  icon: z.string().max(64).optional(),
  color: z.string().optional(),
});

export const createDiscussionGroupSchema = z.object({
  name: z.string().min(1).max(255),
  icon: z.string().max(64).optional(),
  groupType: z.enum(["general", "admin"]).default("general"),
});

export const createTaskGroupSchema = z.object({
  name: z.string().min(1).max(255),
  icon: z.string().max(64).optional(),
});

export const createProjectTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});
