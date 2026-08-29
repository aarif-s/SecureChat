import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { getSession } from "../services/session.service.js";
import { SESSION_COOKIE_NAME } from "../utils/session-cookie.js";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export async function requireAuthentication(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sessionId =
    req.cookies?.[SESSION_COOKIE_NAME];

  if (!sessionId) {
    res.status(401).json({
      success: false,
      error: "Authentication required.",
    });

    return;
  }

  const session = await getSession(sessionId);

  if (!session) {
    res.status(401).json({
      success: false,
      error: "Authentication required.",
    });

    return;
  }

  req.userId = session.userId;

  next();
}
