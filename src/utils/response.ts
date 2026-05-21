import { Response } from "express";
import { ApiResponse } from "../types";

export function sendSuccess<T>(res: Response, data: T, status = 200) {
  const body: ApiResponse<T> = { success: true, data };
  return res.status(status).json(body);
}

export function sendError(res: Response, error: string, status = 400) {
  const body: ApiResponse = { success: false, error };
  return res.status(status).json(body);
}
