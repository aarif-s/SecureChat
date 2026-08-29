import { randomBytes } from "node:crypto";

import { redis } from "../config/redis.js";
import type { SessionData } from "../types/session.js";

const SESSION_PREFIX = "session:";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function getSessionKey(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}`;
}

function generateSessionId(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = generateSessionId();

  const now = Date.now();

  const session: SessionData = {
    userId,
    createdAt: now,
    lastActivityAt: now,
  };

  await redis.set(
    getSessionKey(sessionId),
    session,
    {
      ex: SESSION_TTL_SECONDS,
    },
  );

  return sessionId;
}

export async function getSession(
  sessionId: string,
): Promise<SessionData | null> {
  const session = await redis.get<unknown>(
    getSessionKey(sessionId),
  );

  if (!isSessionData(session)) {
    if (session) {
      await redis.del(getSessionKey(sessionId));
    }

    return null;
  }

  return session;
}

export async function deleteSession(
  sessionId: string,
): Promise<void> {
  await redis.del(getSessionKey(sessionId));
}

function isSessionData(value: unknown): value is SessionData {
  return (
    typeof value === "object" &&
    value !== null &&
    "userId" in value &&
    typeof value.userId === "string" &&
    "createdAt" in value &&
    typeof value.createdAt === "number" &&
    "lastActivityAt" in value &&
    typeof value.lastActivityAt === "number"
  );
}
