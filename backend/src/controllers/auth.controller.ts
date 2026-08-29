import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middleware/auth.js";
import { UserModel } from "../models/User.js";
import {
  loginSchema,
  registerSchema,
} from "../schemas/auth.schema.js";
import {
  AuthenticationError,
  authenticateUser,
  registerUser,
} from "../services/auth.service.js";
import {
  createSession,
  deleteSession,
} from "../services/session.service.js";
import {
  clearSessionCookie,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from "../utils/session-cookie.js";

export async function register(
  req: Request,
  res: Response,
): Promise<void> {
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      error: "Invalid registration data.",
    });

    return;
  }

  try {
    const user = await registerUser(result.data);

    const sessionId = await createSession(user.id);

    setSessionCookie(res, sessionId);

    res.status(201).json({
      success: true,
      user,
    });
  } catch (error: unknown) {
    if (error instanceof AuthenticationError) {
      res.status(400).json({
        success: false,
        error: "Unable to create account.",
      });

      return;
    }

    console.error("Registration error.");

    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
}

export async function getCurrentUser(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({
      success: false,
      error: "Authentication required.",
    });

    return;
  }

  const user = await UserModel.findById(req.userId).select(
    "_id email displayName createdAt",
  );

  if (!user) {
    res.status(401).json({
      success: false,
      error: "Authentication required.",
    });

    return;
  }

  res.status(200).json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    },
  });
}

export async function login(
  req: Request,
  res: Response,
): Promise<void> {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      error: "Invalid login data.",
    });

    return;
  }

  try {
    const user = await authenticateUser(result.data);
    const sessionId = await createSession(user.id);

    setSessionCookie(res, sessionId);

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error: unknown) {
    if (error instanceof AuthenticationError) {
      res.status(401).json({
        success: false,
        error: "Invalid email or password.",
      });

      return;
    }

    console.error("Login error.");

    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
}

export async function logout(
  req: Request,
  res: Response,
): Promise<void> {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

  try {
    if (sessionId) {
      await deleteSession(sessionId);
    }

    clearSessionCookie(res);
    res.status(204).end();
  } catch {
    console.error("Logout error.");
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
}
