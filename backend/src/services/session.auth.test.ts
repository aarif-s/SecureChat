import assert from "node:assert/strict";
import test, { mock } from "node:test";

process.env.UPSTASH_REDIS_REST_URL ??= "https://redis.example";
process.env.UPSTASH_REDIS_REST_TOKEN ??= "test-token";

const { createSession } = await import("./session.service.js");
const { SESSION_COOKIE_NAME, setSessionCookie } = await import("../utils/session-cookie.js");

test("Google-auth session path remains compatible with Redis sessions and cookies", async () => {
  const requests: Request[] = [];
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    requests.push(new Request(input, init));
    return new Response(JSON.stringify(["OK"]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const sessionId = await createSession("google-user-id");
  const response = {
    cookie(name: string, value: string, options: Record<string, unknown>) {
      this.cookieValue = { name, value, options };
    },
    cookieValue: undefined as unknown,
  };
  setSessionCookie(response as never, sessionId);

  assert.match(sessionId, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(requests.length, 1);
  assert.equal((response.cookieValue as { name: string }).name, SESSION_COOKIE_NAME);
  assert.equal((response.cookieValue as { value: string }).value, sessionId);
  assert.equal((response.cookieValue as { options: { httpOnly: boolean; sameSite: string } }).options.httpOnly, true);
  assert.equal((response.cookieValue as { options: { httpOnly: boolean; sameSite: string } }).options.sameSite, "lax");
  mock.restoreAll();
});
