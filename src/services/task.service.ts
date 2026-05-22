import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { tasks, taskGroups, todos, users, projectMembers } from "../db/schema";
import { createId } from "../utils/id";
import { createNotification } from "./notification.service";
import {
  createTodoForTask,
  createTodosForProjectMembers,
  syncTodoWithTask,
} from "./todo.service";
import { ensureProjectTaskBucket, isProjectMember } from "./project.service";

export async function createTask(
  userId: string,
  data: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    assignedTo?: string;
    taskGroupId: string;
    dueDate?: string | null;
  }
) {
  const [group] = await db
    .select()
    .from(taskGroups)
    .where(eq(taskGroups.id, data.taskGroupId));

  if (!group) return null;

  const status =
    data.assignedTo && data.assignedTo !== userId ? "pending" : data.status || "pending";

  const [task] = await db
    .insert(tasks)
    .values({
      id: createId(),
      title: data.title,
      description: data.description,
      status,
      priority: data.priority || "medium",
      assignedTo: data.assignedTo,
      taskGroupId: data.taskGroupId,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      scope: "assigned",
      createdBy: userId,
    })
    .returning();

  if (data.assignedTo && data.assignedTo !== userId) {
    await createTodoForTask(data.assignedTo, task.id, data.title);
    await createNotification({
      userId: data.assignedTo,
      title: "New task assigned",
      body: `Added to your todos: ${data.title}`,
      type: "task_assigned",
    });
  }

  return task;
}

export async function updateTask(
  taskId: string,
  data: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    assignedTo: string | null;
    dueDate: string | null;
  }>
) {
  const updates: Record<string, unknown> = { ...data };
  if (data.dueDate !== undefined) {
    updates.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  }

  const [task] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, taskId))
    .returning();

  if (task) {
    await syncTodoWithTask(taskId, {
      title: task.title,
      completed: task.status === "completed",
    });
  }

  return task;
}

export async function deleteTask(taskId: string) {
  await db.delete(tasks).where(eq(tasks.id, taskId));
}

export async function respondToTask(
  taskId: string,
  userId: string,
  action: "accept" | "reject",
  note?: string
) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task || task.assignedTo !== userId) return null;
  if (task.status !== "pending") return null;

  const status = action === "accept" ? "in_progress" : "rejected";
  const [updated] = await db
    .update(tasks)
    .set({
      status,
      responseNote: note?.trim() || null,
    })
    .where(eq(tasks.id, taskId))
    .returning();

  await syncTodoWithTask(taskId, {
    title: task.title,
    completed: action === "reject",
  });

  if (task.createdBy !== userId) {
    const notePart = note?.trim() ? ` Note: ${note.trim()}` : "";
    await createNotification({
      userId: task.createdBy,
      title: action === "accept" ? "Task accepted" : "Task declined",
      body: `${task.title} was ${action === "accept" ? "accepted" : "declined"}.${notePart}`,
      type: "task_response",
    });
  }

  return updated;
}

export async function createProjectTask(
  projectId: string,
  userId: string,
  data: {
    title: string;
    description?: string;
    priority?: string;
  }
) {
  const member = await isProjectMember(projectId, userId);
  if (!member) return null;

  const taskGroupId = await ensureProjectTaskBucket(projectId);

  const [task] = await db
    .insert(tasks)
    .values({
      id: createId(),
      title: data.title,
      description: data.description,
      status: "in_progress",
      priority: data.priority || "medium",
      assignedTo: null,
      taskGroupId,
      scope: "project",
      createdBy: userId,
    })
    .returning();

  await createTodosForProjectMembers(projectId, task.id, data.title);

  const members = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId));

  for (const { userId: memberId } of members) {
    if (memberId === userId) continue;
    await createNotification({
      userId: memberId,
      title: "New project task",
      body: `Added to your todos: ${data.title}`,
      type: "project_task",
    });
  }

  return task;
}

export async function listProjectTasks(projectId: string, userId: string) {
  const member = await isProjectMember(projectId, userId);
  if (!member) return null;

  const bucketId = await ensureProjectTaskBucket(projectId);

  const projectTasks = await db
    .select()
    .from(tasks)
    .where(
      and(eq(tasks.taskGroupId, bucketId), eq(tasks.scope, "project"))
    )
    .orderBy(desc(tasks.createdAt));

  if (projectTasks.length === 0) return [];

  const taskIds = projectTasks.map((t) => t.id);
  const todoRows = await db
    .select({
      id: todos.id,
      taskId: todos.taskId,
      userId: todos.userId,
      completed: todos.completed,
    })
    .from(todos)
    .where(inArray(todos.taskId, taskIds));

  const creatorIds = [...new Set(projectTasks.map((t) => t.createdBy))];
  const creators =
    creatorIds.length > 0
      ? await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, creatorIds))
      : [];

  const creatorById = Object.fromEntries(creators.map((c) => [c.id, c.name]));

  return projectTasks.map((task) => {
    const related = todoRows.filter((r) => r.taskId === task.id);
    const completedCount = related.filter((r) => r.completed).length;
    const myRow = related.find((r) => r.userId === userId);
    return {
      ...task,
      creatorName: creatorById[task.createdBy] ?? null,
      memberCount: related.length,
      completedCount,
      myCompleted: myRow?.completed ?? false,
      myTodoId: myRow?.id ?? null,
    };
  });
}

export async function getTasksByProject(projectId: string) {
  const groups = await db
    .select()
    .from(taskGroups)
    .where(eq(taskGroups.projectId, projectId));

  const groupIds = groups.map((g) => g.id);
  if (groupIds.length === 0) return [];

  const allTasks = await db.select().from(tasks);
  return allTasks.filter((t) => groupIds.includes(t.taskGroupId));
}

export async function getAssignedTasks(userId: string) {
  return db
    .select()
    .from(tasks)
    .where(
      and(eq(tasks.assignedTo, userId))
    );
}
