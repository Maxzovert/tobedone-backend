import { Router } from "express";
import * as uploadController from "../controllers/upload.controller";
import { authMiddleware } from "../middleware/auth";
import { upload } from "../utils/upload";

const router = Router();

router.use(authMiddleware);
router.post("/", upload.single("file"), uploadController.uploadFile);

export default router;
