import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  todos,
  tasks,
  projectMembers,
  taskGroups,
  projects,
  users,
  messages,
} from "../db/schema";
import { createId } from "../utils/id";

export async function createTodoForTask(
  userId: string,
  taskId: string,
  title: string
) {
  const [existing] = await db
    .select()
    .from(todos)
    .where(and(eq(todos.taskId, taskId), eq(todos.userId, userId)));

  if (existing) return existing;

  const [todo] = await db
    .insert(todos)
    .values({
      id: createId(),
      userId,
      title,
      completed: false,
      taskId,
    })
    .returning();

  return todo;
}

export async function syncTodoWithTask(
  taskId: string,
  data: { title?: string; completed?: boolean }
) {
  const [linkedTask] = await db
    .select({ scope: tasks.scope })
    .from(tasks)
    .where(eq(tasks.id, taskId));

  const updates: { title?: string; completed?: boolean } = {};
  if (data.title !== undefined) updates.title = data.title;
  if (data.completed !== undefined && linkedTask?.scope !== "project") {
    updates.completed = data.completed;
  }

  if (Object.keys(updates).length === 0) return;

  await db.update(todos).set(updates).where(eq(todos.taskId, taskId));
}

export async function createTodosForProjectMembers(
  projectId: string,
  taskId: string,
  title: string
) {
  const members = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId));

  for (const { userId } of members) {
    await createTodoForTask(userId, taskId, title);
  }
}

export async function refreshProjectTaskAggregateStatus(taskId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task || task.scope !== "project") return;

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      done: sql<number>`sum(case when ${todos.completed} then 1 else 0 end)::int`,
    })
    .from(todos)
    .where(eq(todos.taskId, taskId));

  const total = stats?.total ?? 0;
  const done = stats?.done ?? 0;
  const status = total > 0 && done === total ? "completed" : "in_progress";

  if (task.status !== status) {
    await db.update(tasks).set({ status }).where(eq(tasks.id, taskId));
  }
}

export async function listTodosForUser(userId: string) {
  const rows = await db
    .select({
      id: todos.id,
      userId: todos.userId,
      title: todos.title,
      completed: todos.completed,
      taskId: todos.taskId,
      createdAt: todos.createdAt,
      task: {
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        assignedTo: tasks.assignedTo,
        taskGroupId: tasks.taskGroupId,
        dueDate: tasks.dueDate,
        createdBy: tasks.createdBy,
        responseNote: tasks.responseNote,
        scope: tasks.scope,
        createdAt: tasks.createdAt,
      },
    })
    .from(todos)
    .leftJoin(tasks, eq(todos.taskId, tasks.id))
    .where(eq(todos.userId, userId))
    .orderBy(desc(todos.createdAt));

  const base = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    title: row.title,
    completed: row.completed,
    taskId: row.taskId,
    createdAt: row.createdAt,
    task: row.taskId && row.task?.id ? row.task : null,
  }));

  return enrichTodosWithTaskContext(base);
}

async function enrichTodosWithTaskContext<
  T extends {
    taskId: string | null;
    task: {
      id: string;
      taskGroupId: string;
      createdBy: string;
      assignedTo: string | null;
      scope: string;
    } | null;
  },
>(items: T[]) {
  const taskIds = items
    .map((i) => i.task?.id)
    .filter((id): id is string => !!id);
  if (taskIds.length === 0) return items;

  const bucketGroupIds = [
    ...new Set(items.map((i) => i.task?.taskGroupId).filter(Boolean)),
  ] as string[];

  const groupsWithProjects =
    bucketGroupIds.length > 0
      ? await db
          .select({
            groupId: taskGroups.id,
            projectId: projects.id,
            projectName: projects.name,
            projectColor: projects.color,
          })
          .from(taskGroups)
          .innerJoin(projects, eq(taskGroups.projectId, projects.id))
          .where(inArray(taskGroups.id, bucketGroupIds))
      : [];

  const groupProjectMap = Object.fromEntries(
    groupsWithProjects.map((g) => [g.groupId, g])
  );

  const creatorIds = [...new Set(items.map((i) => i.task?.createdBy).filter(Boolean))];
  const assigneeIds = [
    ...new Set(items.map((i) => i.task?.assignedTo).filter((id): id is string => !!id)),
  ];
  const userIds = [...new Set([...creatorIds, ...assigneeIds])] as string[];

  const userRows =
    userIds.length > 0
      ? await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
  const userMap = Object.fromEntries(userRows.map((u) => [u.id, u.name]));

  const linkedMsgs = await db
    .select({
      linkedTaskId: messages.linkedTaskId,
      groupId: messages.groupId,
    })
    .from(messages)
    .where(inArray(messages.linkedTaskId, taskIds));

  const sourceGroupIds = [...new Set(linkedMsgs.map((m) => m.groupId))];
  const sourceGroups =
    sourceGroupIds.length > 0
      ? await db
          .select({
            id: taskGroups.id,
            name: taskGroups.name,
            groupType: taskGroups.groupType,
            kind: taskGroups.kind,
          })
          .from(taskGroups)
          .where(inArray(taskGroups.id, sourceGroupIds))
      : [];

  const sourceGroupMap = Object.fromEntries(sourceGroups.map((g) => [g.id, g]));
  const taskToSourceGroup = new Map<
    string,
    { id: string; name: string; groupType: string | null }
  >();
  for (const m of linkedMsgs) {
    if (!m.linkedTaskId || taskToSourceGroup.has(m.linkedTaskId)) continue;
    const g = sourceGroupMap[m.groupId];
    if (g && g.kind !== "task") {
      taskToSourceGroup.set(m.linkedTaskId, {
        id: g.id,
        name: g.name,
        groupType: g.groupType,
      });
    }
  }

  const projectTaskIds = items
    .filter((i) => i.task?.scope === "project")
    .map((i) => i.task!.id);
  const statsMap = new Map<string, { completedCount: number; memberCount: number }>();
  if (projectTaskIds.length > 0) {
    const stats = await db
      .select({ taskId: todos.taskId, completed: todos.completed })
      .from(todos)
      .where(inArray(todos.taskId, projectTaskIds));
    for (const tid of projectTaskIds) {
      const related = stats.filter((s) => s.taskId === tid);
      statsMap.set(tid, {
        memberCount: related.length,
        completedCount: related.filter((s) => s.completed).length,
      });
    }
  }

  return items.map((item) => {
    if (!item.task) return item;
    const gp = groupProjectMap[item.task.taskGroupId];
    const source = taskToSourceGroup.get(item.task.id);
    const stats = statsMap.get(item.task.id);

    let sourceGroupName: string | null = null;
    let sourceGroupId: string | null = null;
    let sourceGroupType: string | null = null;

    if (item.task.scope === "project") {
      sourceGroupName = "Project tasks";
    } else if (source) {
      sourceGroupName = source.name;
      sourceGroupId = source.id;
      sourceGroupType = source.groupType;
    }

    return {
      ...item,
      task: {
        ...item.task,
        projectId: gp?.projectId ?? null,
        projectName: gp?.projectName ?? null,
        projectColor: gp?.projectColor ?? null,
        sourceGroupId,
        sourceGroupName,
        sourceGroupType,
        creatorName: userMap[item.task.createdBy] ?? null,
        assigneeName: item.task.assignedTo
          ? (userMap[item.task.assignedTo] ?? null)
          : null,
        memberCount: stats?.memberCount ?? null,
        completedCount: stats?.completedCount ?? null,
      },
    };
  });
}

export async function updateUserTodo(
  userId: string,
  todoId: string,
  data: {
    title?: string;
    completed?: boolean;
    taskStatus?: "in_progress" | "completed";
  }
) {
  const [existing] = await db
    .select()
    .from(todos)
    .where(and(eq(todos.id, todoId), eq(todos.userId, userId)));

  if (!existing) return null;

  const todoUpdates: { title?: string; completed?: boolean } = {};
  if (data.title !== undefined) todoUpdates.title = data.title;

  if (existing.taskId) {
    const [linkedTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, existing.taskId));

    if (
      linkedTask?.status === "pending" &&
      (data.completed !== undefined || data.taskStatus)
    ) {
      return getTodoById(userId, todoId);
    }

    if (linkedTask?.scope === "project") {
      if (data.completed !== undefined) {
        todoUpdates.completed = data.completed;
      }
    } else if (data.taskStatus) {
      await db
        .update(tasks)
        .set({
          status: data.taskStatus,
        })
        .where(eq(tasks.id, existing.taskId));

      todoUpdates.completed = data.taskStatus === "completed";
    } else if (data.completed !== undefined) {
      const taskStatus = data.completed ? "completed" : "in_progress";
      await db
        .update(tasks)
        .set({ status: taskStatus })
        .where(eq(tasks.id, existing.taskId));
      todoUpdates.completed = data.completed;
    }
  } else if (data.completed !== undefined) {
    todoUpdates.completed = data.completed;
  }

  if (Object.keys(todoUpdates).length === 0 && !data.taskStatus) {
    return getTodoById(userId, todoId);
  }

  const [updated] = await db
    .update(todos)
    .set(todoUpdates)
    .where(eq(todos.id, todoId))
    .returning();

  if (existing.taskId) {
    const [linkedTask] = await db
      .select({ scope: tasks.scope })
      .from(tasks)
      .where(eq(tasks.id, existing.taskId));
    if (linkedTask?.scope === "project") {
      await refreshProjectTaskAggregateStatus(existing.taskId);
    }
  }

  return getTodoById(userId, updated.id);
}

async function getTodoById(userId: string, todoId: string) {
  const rows = await listTodosForUser(userId);
  return rows.find((t) => t.id === todoId) ?? null;
}

export async function deleteUserTodo(userId: string, todoId: string) {
  const [existing] = await db
    .select()
    .from(todos)
    .where(and(eq(todos.id, todoId), eq(todos.userId, userId)));

  if (!existing) return false;

  await db.delete(todos).where(eq(todos.id, todoId));
  return true;
}
