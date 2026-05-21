import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { tasks, taskGroups } from "../db/schema";
import { createId } from "../utils/id";
import { createNotification } from "./notification.service";

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

  const [task] = await db
    .insert(tasks)
    .values({
      id: createId(),
      title: data.title,
      description: data.description,
      status: data.status || "pending",
      priority: data.priority || "medium",
      assignedTo: data.assignedTo,
      taskGroupId: data.taskGroupId,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      createdBy: userId,
    })
    .returning();

  if (data.assignedTo && data.assignedTo !== userId) {
    await createNotification({
      userId: data.assignedTo,
      title: "New task assigned",
      body: `You were assigned: ${data.title}`,
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

  return task;
}

export async function deleteTask(taskId: string) {
  await db.delete(tasks).where(eq(tasks.id, taskId));
}

export async function respondToTask(
  taskId: string,
  userId: string,
  action: "accept" | "reject"
) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task || task.assignedTo !== userId) return null;

  const status = action === "accept" ? "in_progress" : "rejected";
  const [updated] = await db
    .update(tasks)
    .set({ status })
    .where(eq(tasks.id, taskId))
    .returning();

  if (task.createdBy !== userId) {
    await createNotification({
      userId: task.createdBy,
      title: action === "accept" ? "Task accepted" : "Task rejected",
      body: `${task.title} was ${action}ed`,
      type: "task_response",
    });
  }

  return updated;
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
  return db.select().from(tasks).where(eq(tasks.assignedTo, userId));
}
