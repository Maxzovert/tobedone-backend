import { Router } from "express";
import * as messageController from "../controllers/message.controller";
import { authMiddleware } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  createMessageSchema,
  reactMessageSchema,
  messagesQuerySchema,
} from "../validators/message";

const router = Router();

router.use(authMiddleware);
router.get(
  "/:groupId",
  validateQuery(messagesQuerySchema),
  messageController.getMessages
);
router.post("/", validateBody(createMessageSchema), messageController.createMessage);
router.post("/react", validateBody(reactMessageSchema), messageController.reactMessage);

export default router;
