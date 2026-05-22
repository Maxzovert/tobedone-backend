import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import * as messageService from "../services/message.service";
import * as projectService from "../services/project.service";
import { sendError, sendSuccess } from "../utils/response";
import { paramId } from "../utils/params";

export async function getMessages(req: AuthenticatedRequest, res: Response) {
  const groupId = paramId(req, "groupId");
  const access = await projectService.assertGroupReadAccess(
    groupId,
    req.user!.userId
  );
  if (!access) return sendError(res, "Access denied", 403);

  const { cursor, limit } = req.query as { cursor?: string; limit?: number };
  const result = await messageService.getMessages(
    paramId(req, "groupId"),
    cursor,
    limit || 30
  );
  return sendSuccess(res, result);
}

export async function createMessage(req: AuthenticatedRequest, res: Response) {
  const access = await projectService.assertGroupPostAccess(
    req.body.groupId,
    req.user!.userId
  );
  if (!access) {
    return sendError(
      res,
      "Only the project owner can post in admin groups",
      403
    );
  }

  const message = await messageService.createMessage(req.user!.userId, req.body);
  if (!message) return sendError(res, "Failed to send message", 400);
  return sendSuccess(res, message, 201);
}

export async function reactMessage(req: AuthenticatedRequest, res: Response) {
  const result = await messageService.toggleReaction(
    req.user!.userId,
    req.body.messageId,
    req.body.emoji
  );
  return sendSuccess(res, result);
}
