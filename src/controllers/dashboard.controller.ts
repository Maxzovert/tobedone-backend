import { Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { todos, messages, users } from "../db/schema";
import { AuthenticatedRequest } from "../types";
import * as projectService from "../services/project.service";
import * as taskService from "../services/task.service";
import { sendSuccess } from "../utils/response";

export async function getHome(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.userId;

  const userProjects = await projectService.getUserProjects(userId);
  const pendingTodos = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, userId))
    .orderBy(desc(todos.createdAt))
    .limit(10);

  const assignedTasks = await taskService.getAssignedTasks(userId);
  const pendingTasks = assignedTasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress"
  );

  const recentMessages = await db
    .select({
      id: messages.id,
      content: messages.content,
      groupId: messages.groupId,
      createdAt: messages.createdAt,
      senderName: users.name,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .orderBy(desc(messages.createdAt))
    .limit(5);

  const completedTodos = pendingTodos.filter((t) => t.completed).length;
  const totalTodos = pendingTodos.length;
  const completedTasks = assignedTasks.filter(
    (t) => t.status === "completed"
  ).length;

  return sendSuccess(res, {
    projects: userProjects.slice(0, 6),
    pendingTodos: pendingTodos.filter((t) => !t.completed),
    assignedTasks: pendingTasks,
    teamActivity: recentMessages,
    stats: {
      projects: userProjects.length,
      pendingTasks: pendingTasks.length,
      completedTasks,
      todosCompleted: completedTodos,
      todosTotal: totalTodos,
      productivity:
        totalTodos + assignedTasks.length > 0
          ? Math.round(
              ((completedTodos + completedTasks) /
                (totalTodos + assignedTasks.length)) *
                100
            )
          : 0,
    },
  });
}
