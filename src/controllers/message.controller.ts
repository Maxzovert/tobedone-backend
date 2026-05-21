import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import * as messageService from "../services/message.service";
import { sendError, sendSuccess } from "../utils/response";
import { paramId } from "../utils/params";

export async function getMessages(req: AuthenticatedRequest, res: Response) {
  const { cursor, limit } = req.query as { cursor?: string; limit?: number };
  const result = await messageService.getMessages(
    paramId(req, "groupId"),
    cursor,
    limit || 30
  );
  return sendSuccess(res, result);
}

export async function createMessage(req: AuthenticatedRequest, res: Response) {
  const message = await messageService.createMessage(req.user!.userId, req.body);
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
