import { Router } from "express";
import * as todoController from "../controllers/todo.controller";
import { authMiddleware } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { createTodoSchema, updateTodoSchema } from "../validators/todo";

const router = Router();

router.use(authMiddleware);
router.get("/", todoController.listTodos);
router.post("/", validateBody(createTodoSchema), todoController.createTodo);
router.patch("/:id", validateBody(updateTodoSchema), todoController.updateTodo);
router.delete("/:id", todoController.deleteTodo);

export default router;
