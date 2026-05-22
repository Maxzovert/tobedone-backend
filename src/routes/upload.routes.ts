import { Router } from "express";
import * as uploadController from "../controllers/upload.controller";
import { authMiddleware } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { upload } from "../utils/upload";

const router = Router();

router.use(authMiddleware);
router.post("/", upload.single("file"), asyncHandler(uploadController.uploadFile));

export default router;
