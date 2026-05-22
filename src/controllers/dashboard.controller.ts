import { Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { messages, users } from "../db/schema";
import { AuthenticatedRequest } from "../types";
import * as projectService from "../services/project.service";
import * as taskService from "../services/task.service";
import * as todoService from "../services/todo.service";
import { sendSuccess } from "../utils/response";

export async function getHome(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.userId;

  const userProjects = await projectService.getUserProjects(userId);
  const allTodos = await todoService.listTodosForUser(userId);
  const pendingTodos = allTodos
    .filter((t) => !t.completed && t.task?.status !== "rejected")
    .slice(0, 10);

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

  const completedTodos = allTodos.filter((t) => t.completed).length;
  const totalTodos = allTodos.length;
  const completedTasks = assignedTasks.filter(
    (t) => t.status === "completed"
  ).length;

  return sendSuccess(res, {
    projects: userProjects.slice(0, 6),
    pendingTodos,
    assignedTasks: pendingTasks.filter(
      (t) => t.status === "pending" && !allTodos.some((todo) => todo.taskId === t.id)
    ),
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
