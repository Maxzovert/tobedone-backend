import { Router } from "express";
import * as dashboardController from "../controllers/dashboard.controller";
import { authMiddleware } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.use(authMiddleware);
router.get("/home", asyncHandler(dashboardController.getHome));

export default router;
