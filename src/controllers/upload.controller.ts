import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { sendError, sendSuccess } from "../utils/response";

export async function uploadFile(req: AuthenticatedRequest, res: Response) {
  if (!req.file) {
    return sendError(res, "No file uploaded", 400);
  }

  const url = `/uploads/${req.file.filename}`;
  return sendSuccess(res, {
    url,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
}
