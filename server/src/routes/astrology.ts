import { Router } from "express";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/", (_req, res) => {
  const response: ApiResponse<null> = {
    success: false,
    error: "El módulo de astrología aún no está implementado.",
  };
  res.status(501).json(response);
});

export default router;
