import { Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { todos } from "../db/schema";
import { AuthenticatedRequest } from "../types";
import { createId } from "../utils/id";
import { sendError, sendSuccess } from "../utils/response";
import { paramId } from "../utils/params";

export async function listTodos(req: AuthenticatedRequest, res: Response) {
  const items = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, req.user!.userId))
    .orderBy(desc(todos.createdAt));
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
  return sendSuccess(res, todo, 201);
}

export async function updateTodo(req: AuthenticatedRequest, res: Response) {
  const [existing] = await db
    .select()
    .from(todos)
    .where(eq(todos.id, paramId(req)));

  if (!existing || existing.userId !== req.user!.userId) {
    return sendError(res, "Todo not found", 404);
  }

  const [todo] = await db
    .update(todos)
    .set(req.body)
    .where(eq(todos.id, paramId(req)))
    .returning();

  return sendSuccess(res, todo);
}

export async function deleteTodo(req: AuthenticatedRequest, res: Response) {
  const [existing] = await db
    .select()
    .from(todos)
    .where(eq(todos.id, paramId(req)));

  if (!existing || existing.userId !== req.user!.userId) {
    return sendError(res, "Todo not found", 404);
  }

  await db.delete(todos).where(eq(todos.id, paramId(req)));
  return sendSuccess(res, { deleted: true });
}
