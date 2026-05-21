import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { config } from "../config";
import { createId } from "../utils/id";
import { omitPassword } from "../utils/user";
import { sendError, sendSuccess } from "../utils/response";

export async function register(req: Request, res: Response) {
  const { name, email, password } = req.body;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (existing) {
    return sendError(res, "Email already registered", 409);
  }

  const hashed = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({
      id: createId(),
      name,
      email: email.toLowerCase(),
      password: hashed,
    })
    .returning();

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return sendSuccess(res, { token, user: omitPassword(user) }, 201);
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (!user) {
    return sendError(res, "Invalid credentials", 401);
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return sendError(res, "Invalid credentials", 401);
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return sendSuccess(res, { token, user: omitPassword(user) });
}
