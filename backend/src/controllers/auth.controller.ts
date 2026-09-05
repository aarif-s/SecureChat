import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middleware/auth.js";
import { UserModel } from "../models/User.js";
import {
  loginSchema,
  resendVerificationSchema,
  registerSchema,
} from "../schemas/auth.schema.js";
import {
  AuthenticationError,
  authenticateUser,
  EmailVerificationRequiredError,
  resendVerificationEmail,
  registerUser,
  verifyEmailToken,
} from "../services/auth.service.js";
import {
  completeGoogleAuthentication,
  GoogleAccountConflictError,
  GoogleAuthenticationError,
  startGoogleAuthentication,
} from "../services/google-auth.service.js";
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
      error: result.error.issues[0]?.message ?? "Invalid registration data.",
    });

    return;
  }

  try {
    const user = await registerUser(result.data);

    res.status(201).json({
      success: true,
      user,
      emailVerificationRequired: true,
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
    "_id email displayName emailVerified createdAt",
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
      emailVerified: user.emailVerified,
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
      error: result.error.issues[0]?.message ?? "Invalid login data.",
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
    if (error instanceof EmailVerificationRequiredError) {
      res.status(403).json({
        success: false,
        error: error.message,
      });

      return;
    }

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

export async function verifyEmail(
  req: Request,
  res: Response,
): Promise<void> {
  const token = typeof req.query.token === "string"
    ? req.query.token
    : "";
  const verified = token.length > 0 && await verifyEmailToken(token);
  const clientUrl = process.env.CLIENT_URL ?? "http://localhost:5173";
  const redirectUrl = new URL(clientUrl);
  redirectUrl.searchParams.set(
    verified ? "emailVerified" : "authError",
    verified ? "1" : "invalid-verification-link",
  );

  res.setHeader("Cache-Control", "no-store");
  res.redirect(303, redirectUrl.href);
}

export async function resendVerification(
  req: Request,
  res: Response,
): Promise<void> {
  const result = resendVerificationSchema.safeParse(req.body);

  if (result.success) {
    try {
      await resendVerificationEmail(result.data.email);
    } catch {
      console.error("Verification email delivery error.");
    }
  }

  res.status(202).json({
    success: true,
    message: "If the account can receive verification email, a new link will be sent.",
  });
}

const GOOGLE_STATE_COOKIE = "securechat_google_state";

export async function startGoogleLogin(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const { state, authorizationUrl } = await startGoogleAuthentication();
    res.cookie(GOOGLE_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth/google",
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(302, authorizationUrl.href);
  } catch {
    res.status(503).json({
      success: false,
      error: "Google sign-in is unavailable.",
    });
  }
}

export async function googleCallback(
  req: Request,
  res: Response,
): Promise<void> {
  const state = typeof req.query.state === "string"
    ? req.query.state
    : "";
  const cookieState = req.cookies?.[GOOGLE_STATE_COOKIE];
  const clientUrl = process.env.CLIENT_URL ?? "http://localhost:5173";

  res.clearCookie(GOOGLE_STATE_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
  });

  if (!state || state !== cookieState) {
    redirectGoogleError(res, clientUrl, "google-failed");
    return;
  }

  try {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!redirectUri) {
      throw new GoogleAuthenticationError();
    }

    const currentUrl = new URL(req.originalUrl, redirectUri);
    const user = await completeGoogleAuthentication(state, currentUrl);
    const sessionId = await createSession(user.id);
    setSessionCookie(res, sessionId);
    res.redirect(302, clientUrl);
  } catch (error: unknown) {
    if (error instanceof GoogleAccountConflictError) {
      redirectGoogleError(res, clientUrl, "google-account-conflict");
      return;
    }

    if (!(error instanceof GoogleAuthenticationError)) {
      console.error("Google authentication error.");
    }

    redirectGoogleError(res, clientUrl, "google-failed");
  }
}

function redirectGoogleError(
  response: Response,
  clientUrl: string,
  error: string,
): void {
  const redirectUrl = new URL(clientUrl);
  redirectUrl.searchParams.set("authError", error);
  response.redirect(303, redirectUrl.href);
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
