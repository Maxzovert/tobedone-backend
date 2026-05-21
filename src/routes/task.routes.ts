import { Router } from "express";
import * as taskController from "../controllers/task.controller";
import { authMiddleware } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import {
  createTaskSchema,
  updateTaskSchema,
  respondTaskSchema,
} from "../validators/task";

const router = Router();

router.use(authMiddleware);
router.post("/", validateBody(createTaskSchema), taskController.createTask);
router.patch("/:id", validateBody(updateTaskSchema), taskController.updateTask);
router.delete("/:id", taskController.deleteTask);
router.post(
  "/:id/respond",
  validateBody(respondTaskSchema),
  taskController.respondTask
);

export default router;
