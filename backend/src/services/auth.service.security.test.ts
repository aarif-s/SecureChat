import assert from "node:assert/strict";
import test, { mock } from "node:test";

import argon2 from "argon2";

import { UserModel } from "../models/User.js";
import {
  authenticateUser,
  EmailVerificationRequiredError,
  registerUser,
  verifyEmailToken,
} from "./auth.service.js";
import { hashVerificationToken } from "../utils/verification-token.js";

function queryReturning<T>(value: T): { select: () => Promise<T> } {
  return {
    select: async () => value,
  };
}

function fakeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-id",
    _id: "user-id",
    email: "person@example.com",
    displayName: "Person",
    emailVerified: true,
    ...overrides,
  };
}

test("registerUser creates an unverified account and sends a hashed-token email", async () => {
  let createdData: Record<string, unknown> | undefined;
  const previousProvider = process.env.EMAIL_PROVIDER;
  const previousApiKey = process.env.EMAIL_API_KEY;
  const previousFrom = process.env.EMAIL_FROM;
  process.env.EMAIL_PROVIDER = "resend";
  process.env.EMAIL_API_KEY = "test-api-key";
  process.env.EMAIL_FROM = "SecureChat <noreply@example.com>";
  const sendEmail = mock.method(globalThis, "fetch", async () =>
    new Response(null, { status: 200 }),
  );
  mock.method(UserModel, "create", async (data: unknown) => {
    createdData = data as Record<string, unknown>;
    return fakeUser({ emailVerified: false });
  });

  const result = await registerUser({
    email: "person@example.com",
    password: "correct horse battery staple",
    displayName: "Person",
  });

  assert.equal(result.emailVerified, false);
  assert.equal(createdData?.emailVerified, false);
  assert.match(String(createdData?.emailVerificationTokenHash), /^[a-f0-9]{64}$/);
  assert.notEqual(
    createdData?.emailVerificationTokenHash,
    createdData?.emailVerificationExpiresAt,
  );
  assert.ok(createdData?.emailVerificationExpiresAt instanceof Date);
  assert.equal(sendEmail.mock.callCount(), 1);
  process.env.EMAIL_PROVIDER = previousProvider;
  process.env.EMAIL_API_KEY = previousApiKey;
  process.env.EMAIL_FROM = previousFrom;
  mock.restoreAll();
});

test("verifyEmailToken marks a valid token verified and clears token data", async () => {
  const token = "valid-verification-token";
  const user = fakeUser({
    _id: "user-id",
    emailVerified: false,
  });
  let updateFilter: Record<string, unknown> | undefined;
  let updateData: Record<string, unknown> | undefined;

  mock.method(UserModel, "findOne", () => queryReturning(user));
  mock.method(UserModel, "updateOne", async (
    filter: unknown,
    update: unknown,
  ) => {
    updateFilter = filter as Record<string, unknown>;
    updateData = update as Record<string, unknown>;
    return { modifiedCount: 1 };
  });

  assert.equal(await verifyEmailToken(token), true);
  assert.equal(updateFilter?.emailVerificationTokenHash, hashVerificationToken(token));
  assert.deepEqual(updateData, {
    $set: { emailVerified: true },
    $unset: {
      emailVerificationTokenHash: 1,
      emailVerificationExpiresAt: 1,
    },
  });
  mock.restoreAll();
});

test("expired and replayed verification tokens are rejected", async () => {
  mock.method(UserModel, "findOne", () => queryReturning(null));

  assert.equal(await verifyEmailToken("expired-token"), false);
  assert.equal(await verifyEmailToken("already-used-token"), false);
  mock.restoreAll();
});

for (const [label, emailVerified] of [
  ["unverified", false],
  ["verified", true],
] as const) {
  test(`password login ${label} account behavior`, async () => {
    const passwordHash = await argon2.hash("correct password");
    mock.method(UserModel, "findOne", () => queryReturning(
      fakeUser({ passwordHash, emailVerified }),
    ));

    if (!emailVerified) {
      await assert.rejects(
        authenticateUser({
          email: "person@example.com",
          password: "correct password",
        }),
        EmailVerificationRequiredError,
      );
    } else {
      const user = await authenticateUser({
        email: "person@example.com",
        password: "correct password",
      });
      assert.equal(user.emailVerified, true);
    }

    mock.restoreAll();
  });
}

test("legacy password accounts without emailVerified remain compatible", async () => {
  const passwordHash = await argon2.hash("correct password");
  mock.method(UserModel, "findOne", () => queryReturning(
    fakeUser({ passwordHash, emailVerified: undefined }),
  ));

  const user = await authenticateUser({
    email: "person@example.com",
    password: "correct password",
  });

  assert.equal(user.id, "user-id");
  mock.restoreAll();
});
