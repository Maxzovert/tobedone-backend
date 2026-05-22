import { Router } from "express";
import * as projectController from "../controllers/project.controller";
import { authMiddleware } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  createProjectSchema,
  joinProjectSchema,
  createDiscussionGroupSchema,
  createTaskGroupSchema,
  createProjectTaskSchema,
  updateProjectSchema,
} from "../validators/project";

const router = Router();

router.use(authMiddleware);
router.get("/", asyncHandler(projectController.listProjects));
router.post(
  "/",
  validateBody(createProjectSchema),
  asyncHandler(projectController.createProject)
);
router.post(
  "/join",
  validateBody(joinProjectSchema),
  asyncHandler(projectController.joinProject)
);
router.get("/:id", asyncHandler(projectController.getProject));
router.patch(
  "/:id",
  validateBody(updateProjectSchema),
  asyncHandler(projectController.updateProject)
);
router.delete("/:id", asyncHandler(projectController.deleteProject));
router.delete(
  "/:id/groups/:groupId",
  asyncHandler(projectController.deleteGroup)
);
router.post(
  "/:id/discussion-groups",
  validateBody(createDiscussionGroupSchema),
  asyncHandler(projectController.createDiscussionGroup)
);
router.post(
  "/:id/task-groups",
  validateBody(createTaskGroupSchema),
  asyncHandler(projectController.createTaskGroup)
);
router.get("/:id/tasks", asyncHandler(projectController.listProjectTasks));
router.post(
  "/:id/tasks",
  validateBody(createProjectTaskSchema),
  asyncHandler(projectController.createProjectTask)
);

export default router;
