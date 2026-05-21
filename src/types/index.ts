import { Request } from "express";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  designation: string | null;
  createdAt: Date;
};
