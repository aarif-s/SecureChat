import { Router } from "express";

import {
  getCurrentUser,
  login,
  logout,
  register,
} from "../controllers/auth.controller.js";

import { requireAuthentication } from "../middleware/auth.js";

import { authRateLimiter } from "../middleware/auth-rate-limit.js";

const router = Router();

router.post(
  "/register",
  authRateLimiter,
  register,
);

router.post(
  "/login",
  authRateLimiter,
  login,
);

router.post(
  "/logout",
  logout,
);

router.get(
  "/me",
  requireAuthentication,
  getCurrentUser,
);

export default router;
