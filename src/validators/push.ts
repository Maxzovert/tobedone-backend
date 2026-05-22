import { z } from "zod";

export const registerPushTokenSchema = z.object({
  token: z.string().min(10).max(512),
  platform: z.enum(["ios", "android", "web", "unknown"]).optional(),
});

export const removePushTokenSchema = z.object({
  token: z.string().min(10).max(512),
});
