import { Router } from "express";
import * as profileController from "../controllers/profile.controller";
import { authMiddleware } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { updateProfileSchema } from "../validators/profile";

const router = Router();

router.use(authMiddleware);
router.get("/", asyncHandler(profileController.getProfile));
router.patch(
  "/",
  validateBody(updateProfileSchema),
  asyncHandler(profileController.updateProfile)
);

export default router;
