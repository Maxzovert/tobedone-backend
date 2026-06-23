import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { config } from "../config";
import { createId } from "../utils/id";
import { omitPassword } from "../utils/user";
import { encryptPassword, decryptPassword } from "../utils/passwordRecovery";
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
      passwordRecovery: encryptPassword(password),
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

  if (!user.passwordRecovery) {
    await db
      .update(users)
      .set({ passwordRecovery: encryptPassword(password) })
      .where(eq(users.id, user.id));
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return sendSuccess(res, { token, user: omitPassword(user) });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (!user) {
    return sendError(res, "No account found with this email", 404);
  }

  if (!user.passwordRecovery) {
    return sendError(
      res,
      "Password not on file for this account. Sign in once, then try again.",
      404
    );
  }

  const password = decryptPassword(user.passwordRecovery);
  if (!password) {
    return sendError(res, "Could not retrieve password. Sign in once, then try again.", 500);
  }

  return sendSuccess(res, {
    email: user.email,
    password,
    message: "Here is your password. Use it to sign in.",
  });
}
