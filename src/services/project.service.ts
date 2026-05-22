import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  projects,
  projectMembers,
  taskGroups,
  tasks,
  users,
} from "../db/schema";
import { createTodoForTask } from "./todo.service";
import { createId, createInviteCode } from "../utils/id";

export async function getUserProjects(userId: string) {
  const memberships = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));

  const projectIds = memberships.map((m) => m.projectId);
  if (projectIds.length === 0) return [];

  return db
    .select()
    .from(projects)
    .where(inArray(projects.id, projectIds))
    .orderBy(projects.createdAt);
}

export async function createProject(
  userId: string,
  data: { name: string; description?: string; color?: string; icon?: string }
) {
  const projectId = createId();
  const inviteCode = createInviteCode();

  const [project] = await db
    .insert(projects)
    .values({
      id: projectId,
      name: data.name,
      description: data.description,
      color: data.color || "#6366f1",
      icon: data.icon || "folder",
      inviteCode,
      ownerId: userId,
    })
    .returning();

  await db.insert(projectMembers).values({
    id: createId(),
    projectId,
    userId,
    role: "owner",
  });

  return project;
}

export async function joinProject(userId: string, inviteCode: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.inviteCode, inviteCode.toUpperCase()));

  if (!project) return null;

  const [existing] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, project.id),
        eq(projectMembers.userId, userId)
      )
    );

  if (!existing) {
    await db.insert(projectMembers).values({
      id: createId(),
      projectId: project.id,
      userId,
      role: "member",
    });

    const bucketId = await ensureProjectTaskBucket(project.id);
    const openTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.taskGroupId, bucketId),
          eq(tasks.scope, "project"),
          eq(tasks.status, "in_progress")
        )
      );
    for (const task of openTasks) {
      await createTodoForTask(userId, task.id, task.title);
    }
  }

  return project;
}

export async function getProjectDetail(projectId: string, userId: string) {
  const [member] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    );

  if (!member) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) return null;

  const members = await db
    .select({
      id: projectMembers.id,
      role: projectMembers.role,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        avatar: users.avatar,
        designation: users.designation,
      },
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId));

  const groups = await db
    .select()
    .from(taskGroups)
    .where(eq(taskGroups.projectId, projectId));

  const isOwner = project.ownerId === userId;
  const taskBucketId = await ensureProjectTaskBucket(projectId);

  return {
    project,
    members,
    taskGroups: groups.filter((g) => isDiscussionGroup(g)),
    taskBucketId,
    memberRole: member.role,
    isOwner,
  };
}

/** Hidden bucket used for all task records in this project. */
export async function ensureProjectTaskBucket(projectId: string) {
  const [existing] = await db
    .select({ id: taskGroups.id })
    .from(taskGroups)
    .where(
      and(eq(taskGroups.projectId, projectId), eq(taskGroups.kind, "task"))
    )
    .limit(1);

  if (existing) return existing.id;

  const bucketId = createId();
  await db.insert(taskGroups).values({
    id: bucketId,
    projectId,
    name: "Tasks",
    icon: "checkbox",
    kind: "task",
    groupType: "general",
  });
  return bucketId;
}

export async function isProjectOwner(projectId: string, userId: string) {
  const [project] = await db
    .select({ ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.id, projectId));
  return project?.ownerId === userId;
}

export async function getDiscussionGroup(groupId: string) {
  const [group] = await db
    .select()
    .from(taskGroups)
    .where(eq(taskGroups.id, groupId));
  if (!group || !isDiscussionGroup(group)) return null;
  return group;
}

/** Any project member can read messages in admin and normal groups. */
export async function assertGroupReadAccess(groupId: string, userId: string) {
  const group = await getDiscussionGroup(groupId);
  if (!group) return null;

  const member = await isProjectMember(group.projectId, userId);
  if (!member) return null;

  return group;
}

/** Normal group: all members. Admin group: project owner only. */
export async function assertGroupPostAccess(groupId: string, userId: string) {
  const group = await assertGroupReadAccess(groupId, userId);
  if (!group) return null;

  if (group.groupType === "admin" && !(await isProjectOwner(group.projectId, userId))) {
    return null;
  }

  return group;
}

/** @deprecated Use assertGroupReadAccess or assertGroupPostAccess */
export async function assertGroupAccess(groupId: string, userId: string) {
  return assertGroupReadAccess(groupId, userId);
}

export async function updateProject(
  projectId: string,
  userId: string,
  data: { name?: string; description?: string; icon?: string; color?: string }
) {
  if (!(await isProjectOwner(projectId, userId))) return null;

  const [updated] = await db
    .update(projects)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.color !== undefined && { color: data.color }),
    })
    .where(eq(projects.id, projectId))
    .returning();

  return updated ?? null;
}

export async function deleteProject(projectId: string, userId: string) {
  if (!(await isProjectOwner(projectId, userId))) return false;

  await db.delete(projects).where(eq(projects.id, projectId));
  return true;
}

export async function deleteGroup(
  projectId: string,
  groupId: string,
  userId: string
) {
  if (!(await isProjectOwner(projectId, userId))) return "forbidden" as const;

  const [group] = await db
    .select()
    .from(taskGroups)
    .where(
      and(eq(taskGroups.id, groupId), eq(taskGroups.projectId, projectId))
    );
  if (!group) return "not_found" as const;
  if (group.kind === "task") return "protected" as const;

  await db.delete(taskGroups).where(eq(taskGroups.id, groupId));
  return "ok" as const;
}

export async function isProjectMember(projectId: string, userId: string) {
  const [member] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    );
  return !!member;
}

export async function createTaskGroup(
  projectId: string,
  userId: string,
  data: { name: string; icon?: string }
) {
  const member = await isProjectMember(projectId, userId);
  if (!member) return null;

  const groupId = createId();
  const [group] = await db
    .insert(taskGroups)
    .values({
      id: groupId,
      projectId,
      name: data.name,
      icon: data.icon || "folder",
      kind: "task",
    })
    .returning();

  return group;
}

export async function createDiscussionGroup(
  projectId: string,
  userId: string,
  data: { name: string; icon?: string; groupType?: "general" | "admin" }
) {
  const member = await isProjectMember(projectId, userId);
  if (!member) return null;

  const groupType = data.groupType ?? "general";
  if (groupType === "admin" && !(await isProjectOwner(projectId, userId))) {
    return "forbidden" as const;
  }

  const groupId = `discussion-${projectId}-${createId()}`;
  const [group] = await db
    .insert(taskGroups)
    .values({
      id: groupId,
      projectId,
      name: data.name,
      icon: data.icon || "chatbubbles",
      kind: "discussion",
      groupType,
    })
    .returning();

  return group;
}

export function isDiscussionGroup(group: { id: string; kind?: string | null }) {
  return group.kind === "discussion" || group.id.startsWith("discussion-");
}
