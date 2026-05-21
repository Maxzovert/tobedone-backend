import { Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { AuthenticatedRequest } from "../types";
import { omitPassword } from "../utils/user";
import { sendError, sendSuccess } from "../utils/response";

export async function getProfile(req: AuthenticatedRequest, res: Response) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.user!.userId));

  if (!user) return sendError(res, "User not found", 404);
  return sendSuccess(res, omitPassword(user));
}

export async function updateProfile(req: AuthenticatedRequest, res: Response) {
  const [user] = await db
    .update(users)
    .set(req.body)
    .where(eq(users.id, req.user!.userId))
    .returning();

  return sendSuccess(res, omitPassword(user!));
}
