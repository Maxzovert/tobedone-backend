import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  projects,
  projectMembers,
  taskGroups,
  users,
} from "../db/schema";
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

  const generalGroupId = createId();
  await db.insert(taskGroups).values({
    id: generalGroupId,
    projectId,
    name: "General",
  });

  const discussionGroupId = `discussion-${projectId}`;
  await db.insert(taskGroups).values({
    id: discussionGroupId,
    projectId,
    name: "Discussions",
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

  return { project, members, taskGroups: groups, memberRole: member.role };
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

export async function getDiscussionGroupId(projectId: string) {
  return `discussion-${projectId}`;
}
