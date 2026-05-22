import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { registerSchema, loginSchema } from "../validators/auth";

const router = Router();

router.post(
  "/register",
  validateBody(registerSchema),
  asyncHandler(authController.register)
);
router.post("/login", validateBody(loginSchema), asyncHandler(authController.login));

export default router;
