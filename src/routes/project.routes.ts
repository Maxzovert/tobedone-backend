import { Router } from "express";
import * as projectController from "../controllers/project.controller";
import { authMiddleware } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import {
  createProjectSchema,
  joinProjectSchema,
} from "../validators/project";

const router = Router();

router.use(authMiddleware);
router.get("/", projectController.listProjects);
router.post("/", validateBody(createProjectSchema), projectController.createProject);
router.post("/join", validateBody(joinProjectSchema), projectController.joinProject);
router.get("/:id", projectController.getProject);

export default router;
