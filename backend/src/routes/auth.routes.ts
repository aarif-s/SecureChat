import { Router } from "express";

import {
  getCurrentUser,
  googleCallback,
  login,
  logout,
  resendVerification,
  register,
  startGoogleLogin,
  verifyEmail,
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

router.get(
  "/verify-email",
  verifyEmail,
);

router.post(
  "/resend-verification",
  authRateLimiter,
  resendVerification,
);

router.get(
  "/google/start",
  authRateLimiter,
  startGoogleLogin,
);

router.get(
  "/google/callback",
  googleCallback,
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
