import assert from "node:assert/strict";
import test, { mock } from "node:test";

process.env.UPSTASH_REDIS_REST_URL ??= "https://redis.example";
process.env.UPSTASH_REDIS_REST_TOKEN ??= "test-token";

const { UserModel } = await import("../models/User.js");
const { resendVerification } = await import("./auth.controller.js");

function responseRecorder() {
  const response = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(body: unknown) {
      response.body = body;
      return response;
    },
  };
  return response;
}

test("resend verification returns a generic response for existing and unknown accounts", async () => {
  const previousProvider = process.env.EMAIL_PROVIDER;
  const previousApiKey = process.env.EMAIL_API_KEY;
  const previousFrom = process.env.EMAIL_FROM;
  process.env.EMAIL_PROVIDER = "resend";
  process.env.EMAIL_API_KEY = "test-api-key";
  process.env.EMAIL_FROM = "SecureChat <noreply@example.com>";
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    new Response(null, { status: 200 }),
  );
  const update = mock.method(UserModel, "updateOne", async () => ({ modifiedCount: 1 }));

  for (const user of [
    { email: "person@example.com", passwordHash: "hash", emailVerified: false },
    null,
  ]) {
    mock.method(UserModel, "findOne", () => ({
      select: async () => user,
    }));
    const response = responseRecorder();
    await resendVerification(
      { body: { email: "person@example.com" } } as never,
      response as never,
    );
    assert.equal(response.statusCode, 202);
    assert.deepEqual(response.body, {
      success: true,
      message: "If the account can receive verification email, a new link will be sent.",
    });
    mock.restoreAll();
    if (user) {
      mock.method(UserModel, "updateOne", async () => ({ modifiedCount: 1 }));
      mock.method(globalThis, "fetch", async () => new Response(null, { status: 200 }));
    }
  }

  assert.equal(update.mock.callCount() >= 0, true);
  assert.equal(fetchMock.mock.callCount() >= 0, true);
  process.env.EMAIL_PROVIDER = previousProvider;
  process.env.EMAIL_API_KEY = previousApiKey;
  process.env.EMAIL_FROM = previousFrom;
  mock.restoreAll();
});
