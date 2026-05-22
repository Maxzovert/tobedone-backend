import { Router } from "express";
import * as todoController from "../controllers/todo.controller";
import { authMiddleware } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import { createTodoSchema, updateTodoSchema } from "../validators/todo";

const router = Router();

router.use(authMiddleware);
router.get("/", asyncHandler(todoController.listTodos));
router.post("/", validateBody(createTodoSchema), asyncHandler(todoController.createTodo));
router.patch("/:id", validateBody(updateTodoSchema), asyncHandler(todoController.updateTodo));
router.delete("/:id", asyncHandler(todoController.deleteTodo));

export default router;
