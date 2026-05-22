import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import * as projectService from "../services/project.service";
import * as taskService from "../services/task.service";
import { sendError, sendSuccess } from "../utils/response";
import { paramId } from "../utils/params";

export async function listProjects(req: AuthenticatedRequest, res: Response) {
  const projects = await projectService.getUserProjects(req.user!.userId);
  return sendSuccess(res, projects);
}

export async function createProject(req: AuthenticatedRequest, res: Response) {
  const project = await projectService.createProject(req.user!.userId, req.body);
  return sendSuccess(res, project, 201);
}

export async function getProject(req: AuthenticatedRequest, res: Response) {
  const detail = await projectService.getProjectDetail(
    paramId(req),
    req.user!.userId
  );
  if (!detail) return sendError(res, "Project not found", 404);
  return sendSuccess(res, detail);
}

export async function joinProject(req: AuthenticatedRequest, res: Response) {
  const project = await projectService.joinProject(
    req.user!.userId,
    req.body.inviteCode
  );
  if (!project) return sendError(res, "Invalid invite code", 404);
  return sendSuccess(res, project);
}

export async function createDiscussionGroup(req: AuthenticatedRequest, res: Response) {
  const result = await projectService.createDiscussionGroup(
    paramId(req),
    req.user!.userId,
    req.body
  );
  if (result === "forbidden") {
    return sendError(res, "Only the project owner can create admin groups", 403);
  }
  if (!result) return sendError(res, "Project not found or access denied", 404);
  return sendSuccess(res, result, 201);
}

export async function updateProject(req: AuthenticatedRequest, res: Response) {
  const project = await projectService.updateProject(
    paramId(req),
    req.user!.userId,
    req.body
  );
  if (!project) return sendError(res, "Only the project owner can update settings", 403);
  return sendSuccess(res, project);
}

export async function deleteProject(req: AuthenticatedRequest, res: Response) {
  const ok = await projectService.deleteProject(paramId(req), req.user!.userId);
  if (!ok) return sendError(res, "Only the project owner can delete this project", 403);
  return sendSuccess(res, { deleted: true });
}

export async function deleteGroup(req: AuthenticatedRequest, res: Response) {
  const result = await projectService.deleteGroup(
    paramId(req),
    paramId(req, "groupId"),
    req.user!.userId
  );
  if (result === "forbidden") {
    return sendError(res, "Only the project owner can delete groups", 403);
  }
  if (result === "protected") {
    return sendError(res, "Task storage cannot be deleted", 400);
  }
  if (result === "not_found") return sendError(res, "Group not found", 404);
  return sendSuccess(res, { deleted: true });
}

export async function createTaskGroup(req: AuthenticatedRequest, res: Response) {
  const group = await projectService.createTaskGroup(
    paramId(req),
    req.user!.userId,
    req.body
  );
  if (!group) return sendError(res, "Project not found or access denied", 404);
  return sendSuccess(res, group, 201);
}

export async function listProjectTasks(req: AuthenticatedRequest, res: Response) {
  const tasks = await taskService.listProjectTasks(
    paramId(req),
    req.user!.userId
  );
  if (tasks === null) return sendError(res, "Project not found or access denied", 404);
  return sendSuccess(res, tasks);
}

export async function createProjectTask(req: AuthenticatedRequest, res: Response) {
  const task = await taskService.createProjectTask(
    paramId(req),
    req.user!.userId,
    req.body
  );
  if (!task) return sendError(res, "Project not found or access denied", 404);
  return sendSuccess(res, task, 201);
}
