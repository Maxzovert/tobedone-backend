import { Response } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import { db } from "../db";
import { messages, users, taskGroups } from "../db/schema";
import { AuthenticatedRequest } from "../types";
import * as projectService from "../services/project.service";
import * as todoService from "../services/todo.service";
import { sendSuccess } from "../utils/response";

export async function getHome(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.userId;

  const userProjects = await projectService.getUserProjects(userId);
  const allTodos = await todoService.listTodosForUser(userId);

  const isActiveTodo = (t: (typeof allTodos)[number]) =>
    !t.completed &&
    t.task?.status !== "rejected" &&
    t.task?.status !== "completed";

  const pendingTodos = allTodos.filter(isActiveTodo).slice(0, 10);

  const pendingTasksCount = allTodos.filter(isActiveTodo).length;
  const completedCount = allTodos.filter(
    (t) => t.completed || t.task?.status === "completed"
  ).length;
  const totalTodos = allTodos.length;

  const assignedTasks = allTodos
    .filter(
      (t) =>
        t.task?.status === "pending" &&
        t.task.assignedTo === userId &&
        t.task.scope === "assigned"
    )
    .map((t) => t.task!)
    .filter((task, i, arr) => arr.findIndex((x) => x.id === task.id) === i);

  const projectIds = userProjects.map((p) => p.id);
  let recentMessages: {
    id: string;
    content: string;
    groupId: string;
    createdAt: Date;
    senderName: string;
  }[] = [];

  if (projectIds.length > 0) {
    const groups = await db
      .select({ id: taskGroups.id })
      .from(taskGroups)
      .where(inArray(taskGroups.projectId, projectIds));
    const groupIds = groups.map((g) => g.id);

    if (groupIds.length > 0) {
      recentMessages = await db
        .select({
          id: messages.id,
          content: messages.content,
          groupId: messages.groupId,
          createdAt: messages.createdAt,
          senderName: users.name,
        })
        .from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(inArray(messages.groupId, groupIds))
        .orderBy(desc(messages.createdAt))
        .limit(5);
    }
  }

  return sendSuccess(res, {
    projects: userProjects.slice(0, 6),
    pendingTodos,
    assignedTasks,
    teamActivity: recentMessages,
    stats: {
      projects: userProjects.length,
      pendingTasks: pendingTasksCount,
      completedTasks: completedCount,
      todosCompleted: completedCount,
      todosTotal: totalTodos,
      productivity:
        totalTodos > 0 ? Math.round((completedCount / totalTodos) * 100) : 0,
    },
  });
}
