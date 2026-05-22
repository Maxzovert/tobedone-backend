import { Router } from "express";
import * as taskController from "../controllers/task.controller";
import { authMiddleware } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  createTaskSchema,
  updateTaskSchema,
  respondTaskSchema,
} from "../validators/task";

const router = Router();

router.use(authMiddleware);
router.post("/", validateBody(createTaskSchema), asyncHandler(taskController.createTask));
router.patch("/:id", validateBody(updateTaskSchema), asyncHandler(taskController.updateTask));
router.delete("/:id", asyncHandler(taskController.deleteTask));
router.post(
  "/:id/respond",
  validateBody(respondTaskSchema),
  asyncHandler(taskController.respondTask)
);

export default router;
