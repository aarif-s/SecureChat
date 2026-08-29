import type { Response } from "express";

const isProduction = process.env.NODE_ENV === "production";

export const SESSION_COOKIE_NAME = isProduction
  ? "__Host-securechat_session"
  : "securechat_session";

export function setSessionCookie(
  response: Response,
  sessionId: string,
): void {
  response.cookie(
    SESSION_COOKIE_NAME,
    sessionId,
    {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  );
}

export function clearSessionCookie(
  response: Response,
): void {
  response.clearCookie(
    SESSION_COOKIE_NAME,
    {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
    },
  );
}