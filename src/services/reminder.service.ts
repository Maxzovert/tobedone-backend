import { and, eq, inArray, lt, isNotNull, or } from "drizzle-orm";
import { db } from "../db";
import { tasks, todos, taskGroups } from "../db/schema";
import { createNotification } from "./notification.service";

const URGENT_MS = 60 * 60 * 1000;
/** How often the server checks for reminders */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
/** Do not send the same reminder again within this window */
const REMINDER_COOLDOWN_MS = 60 * 60 * 1000;
const DUE_SOON_MS = 60 * 60 * 1000;

const sentKeys = new Set<string>();

function reminderKey(userId: string, taskId: string, kind: string) {
  return `${userId}:${taskId}:${kind}`;
}

function markSent(userId: string, taskId: string, kind: string) {
  const key = reminderKey(userId, taskId, kind);
  sentKeys.add(key);
  setTimeout(() => sentKeys.delete(key), REMINDER_COOLDOWN_MS);
}

function wasSent(userId: string, taskId: string, kind: string) {
  return sentKeys.has(reminderKey(userId, taskId, kind));
}

async function checkUrgentReminders() {
  const now = Date.now();
  const cutoff = new Date(now - URGENT_MS);

  const urgentTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      priority: tasks.priority,
      createdAt: tasks.createdAt,
      scope: tasks.scope,
      assignedTo: tasks.assignedTo,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.priority, "urgent"),
        or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress")),
        lt(tasks.createdAt, cutoff)
      )
    );

  for (const task of urgentTasks) {
    if (task.scope === "assigned" && task.assignedTo) {
      const [todo] = await db
        .select()
        .from(todos)
        .where(
          and(eq(todos.taskId, task.id), eq(todos.userId, task.assignedTo))
        );
      if (!todo || todo.completed) continue;
      if (wasSent(task.assignedTo, task.id, "urgent")) continue;
      markSent(task.assignedTo, task.id, "urgent");
      await createNotification({
        userId: task.assignedTo,
        title: "Urgent task overdue",
        body: `"${task.title}" was due 1 hour ago. Complete it now.`,
        type: "task_urgent_reminder",
        data: { taskId: task.id },
      });
      continue;
    }

    if (task.scope === "project") {
      const openTodos = await db
        .select()
        .from(todos)
        .where(and(eq(todos.taskId, task.id), eq(todos.completed, false)));

      for (const todo of openTodos) {
        if (wasSent(todo.userId, task.id, "urgent")) continue;
        markSent(todo.userId, task.id, "urgent");
        await createNotification({
          userId: todo.userId,
          title: "Urgent team task overdue",
          body: `"${task.title}" was due 1 hour ago.`,
          type: "task_urgent_reminder",
          data: { taskId: task.id },
        });
      }
    }
  }
}

async function checkDueDateReminders() {
  const now = Date.now();
  const soon = new Date(now + DUE_SOON_MS);

  const dueTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      scope: tasks.scope,
      assignedTo: tasks.assignedTo,
      status: tasks.status,
    })
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.dueDate),
        or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress")),
        lt(tasks.dueDate, soon)
      )
    );

  for (const task of dueTasks) {
    if (task.priority === "urgent") continue;

    const notifyUser = async (userId: string) => {
      if (wasSent(userId, task.id, "due")) return;
      markSent(userId, task.id, "due");
      const overdue = task.dueDate && task.dueDate.getTime() < now;
      await createNotification({
        userId,
        title: overdue ? "Task overdue" : "Task due soon",
        body: `"${task.title}" ${overdue ? "is past due" : "is due within an hour"}.`,
        type: "task_due_reminder",
        data: { taskId: task.id },
      });
    };

    if (task.scope === "assigned" && task.assignedTo) {
      const [todo] = await db
        .select()
        .from(todos)
        .where(
          and(eq(todos.taskId, task.id), eq(todos.userId, task.assignedTo))
        );
      if (todo && !todo.completed) await notifyUser(task.assignedTo);
    } else if (task.scope === "project") {
      const openTodos = await db
        .select()
        .from(todos)
        .where(and(eq(todos.taskId, task.id), eq(todos.completed, false)));
      for (const todo of openTodos) {
        await notifyUser(todo.userId);
      }
    }
  }
}

async function checkPriorityNudges() {
  const now = Date.now();
  const nudgeAfter = new Date(now - REMINDER_COOLDOWN_MS);

  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      priority: tasks.priority,
      scope: tasks.scope,
      assignedTo: tasks.assignedTo,
    })
    .from(tasks)
    .where(
      and(
        inArray(tasks.priority, ["low", "medium", "high"]),
        or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress")),
        lt(tasks.createdAt, nudgeAfter)
      )
    );

  for (const task of rows) {
    const label =
      task.priority === "high"
        ? "High priority"
        : task.priority === "medium"
          ? "Reminder"
          : "Low priority";

    const notifyUser = async (userId: string) => {
      if (wasSent(userId, task.id, "nudge")) return;
      markSent(userId, task.id, "nudge");
      await createNotification({
        userId,
        title: `${label} task pending`,
        body: `Still open: "${task.title}"`,
        type: "task_priority_reminder",
        data: { taskId: task.id },
      });
    };

    if (task.scope === "assigned" && task.assignedTo) {
      const [todo] = await db
        .select()
        .from(todos)
        .where(
          and(eq(todos.taskId, task.id), eq(todos.userId, task.assignedTo))
        );
      if (todo && !todo.completed) await notifyUser(task.assignedTo);
    } else if (task.scope === "project") {
      const openTodos = await db
        .select()
        .from(todos)
        .where(and(eq(todos.taskId, task.id), eq(todos.completed, false)));
      for (const todo of openTodos) {
        await notifyUser(todo.userId);
      }
    }
  }
}

async function runReminderCycle() {
  try {
    await checkUrgentReminders();
    await checkDueDateReminders();
    await checkPriorityNudges();
  } catch (err) {
    console.warn("Reminder cycle failed:", err);
  }
}

export function startReminderScheduler() {
  void runReminderCycle();
  setInterval(() => void runReminderCycle(), CHECK_INTERVAL_MS);
}
