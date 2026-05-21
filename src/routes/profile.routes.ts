import { Router } from "express";
import * as profileController from "../controllers/profile.controller";
import { authMiddleware } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { updateProfileSchema } from "../validators/profile";

const router = Router();

router.use(authMiddleware);
router.get("/", profileController.getProfile);
router.patch("/", validateBody(updateProfileSchema), profileController.updateProfile);

export default router;
