import { Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { tasks } from "../db/schema";
import { AuthenticatedRequest } from "../types";
import * as taskService from "../services/task.service";
import { sendError, sendSuccess } from "../utils/response";
import { paramId } from "../utils/params";

export async function createTask(req: AuthenticatedRequest, res: Response) {
  const task = await taskService.createTask(req.user!.userId, req.body);
  if (!task) return sendError(res, "Invalid task group", 400);
  return sendSuccess(res, task, 201);
}

export async function updateTask(req: AuthenticatedRequest, res: Response) {
  const [existing] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, paramId(req)));
  if (!existing) return sendError(res, "Task not found", 404);

  const task = await taskService.updateTask(paramId(req), req.body);
  return sendSuccess(res, task);
}

export async function deleteTask(req: AuthenticatedRequest, res: Response) {
  const [existing] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, paramId(req)));
  if (!existing) return sendError(res, "Task not found", 404);

  await taskService.deleteTask(paramId(req));
  return sendSuccess(res, { deleted: true });
}

export async function respondTask(req: AuthenticatedRequest, res: Response) {
  const task = await taskService.respondToTask(
    paramId(req),
    req.user!.userId,
    req.body.action
  );
  if (!task) return sendError(res, "Cannot respond to this task", 403);
  return sendSuccess(res, task);
}
