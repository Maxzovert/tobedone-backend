import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import * as projectService from "../services/project.service";
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
