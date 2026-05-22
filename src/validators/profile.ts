import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  avatar: z.string().max(2048).optional().nullable(),
  designation: z.string().max(255).optional().nullable(),
});
