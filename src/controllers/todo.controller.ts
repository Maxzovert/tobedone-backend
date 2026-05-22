import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { createId } from "../utils/id";
import { sendError, sendSuccess } from "../utils/response";
import { paramId } from "../utils/params";
import * as todoService from "../services/todo.service";
import { db } from "../db";
import { todos } from "../db/schema";

export async function listTodos(req: AuthenticatedRequest, res: Response) {
  const items = await todoService.listTodosForUser(req.user!.userId);
  return sendSuccess(res, items);
}

export async function createTodo(req: AuthenticatedRequest, res: Response) {
  const [todo] = await db
    .insert(todos)
    .values({
      id: createId(),
      userId: req.user!.userId,
      title: req.body.title,
    })
    .returning();
  return sendSuccess(res, { ...todo, task: null }, 201);
}

export async function updateTodo(req: AuthenticatedRequest, res: Response) {
  const todo = await todoService.updateUserTodo(req.user!.userId, paramId(req), {
    title: req.body.title,
    completed: req.body.completed,
    taskStatus: req.body.taskStatus,
  });
  if (!todo) return sendError(res, "Todo not found", 404);
  return sendSuccess(res, todo);
}

export async function deleteTodo(req: AuthenticatedRequest, res: Response) {
  const ok = await todoService.deleteUserTodo(req.user!.userId, paramId(req));
  if (!ok) return sendError(res, "Todo not found", 404);
  return sendSuccess(res, { deleted: true });
}
