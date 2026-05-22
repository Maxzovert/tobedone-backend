import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response";

export function errorHandler(
  err: Error & { code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(err);

  if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
    return sendError(
      res,
      "Database unreachable. Copy a fresh connection string from the Neon dashboard into backend/.env, or set USE_NEON_POOLER=true only if the direct host works.",
      503
    );
  }

  sendError(res, err.message || "Internal server error", 500);
}
