import { z } from "zod";

export const deleteNotificationSchema = z.object({
  id: z.string().min(1, "Notification id is required"),
});
