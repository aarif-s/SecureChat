import assert from "node:assert/strict";
import test, { mock } from "node:test";

process.env.UPSTASH_REDIS_REST_URL ??= "https://redis.example";
process.env.UPSTASH_REDIS_REST_TOKEN ??= "test-token";

const { UserModel } = await import("../models/User.js");
const { findOrCreateGoogleUser } = await import("./google-auth.service.js");

function queryReturning<T>(value: T): {
  select: () => Promise<T>;
  then: (resolve: (result: T) => unknown) => Promise<unknown>;
} {
  return {
    select: async () => value,
    then: (resolve) => Promise.resolve(value).then(resolve),
  };
}

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "google-user-id",
    email: "person@example.com",
    displayName: "Person",
    emailVerified: true,
    ...overrides,
  };
}

test("existing Google sub authenticates the existing Google account", async () => {
  mock.method(UserModel, "findOne", () => queryReturning(user()));

  const result = await findOrCreateGoogleUser({
    sub: "google-sub",
    email: "person@example.com",
    displayName: "Person",
  });

  assert.equal(result.id, "google-user-id");
  assert.equal(result.emailVerified, true);
  mock.restoreAll();
});

test("new Google identity creates a verified account without a password", async () => {
  mock.method(UserModel, "findOne", () => queryReturning(null));
  let created: Record<string, unknown> | undefined;
  mock.method(UserModel, "create", async (data: unknown) => {
    created = data as Record<string, unknown>;
    return user({ id: "new-google-user" });
  });

  const result = await findOrCreateGoogleUser({
    sub: "new-google-sub",
    email: " PERSON@Example.com ",
    displayName: "Person",
  });

  assert.equal(result.id, "new-google-user");
  assert.equal(created?.googleSub, "new-google-sub");
  assert.equal(created?.email, "person@example.com");
  assert.equal(created?.emailVerified, true);
  assert.equal("passwordHash" in (created ?? {}), false);
  mock.restoreAll();
});

test("matching password-account email is rejected without linking Google", async () => {
  const existingPasswordUser = user({
    passwordHash: "argon2id-hash",
    emailVerified: true,
  });
  let lookupCount = 0;
  mock.method(UserModel, "findOne", () => {
    lookupCount += 1;
    return queryReturning(lookupCount === 1 ? null : existingPasswordUser);
  });
  const create = mock.method(UserModel, "create", async () => {
    throw new Error("must not create");
  });

  await assert.rejects(
    findOrCreateGoogleUser({
      sub: "unlinked-google-sub",
      email: "person@example.com",
      displayName: "Person",
    }),
    /password account/,
  );

  assert.equal(create.mock.callCount(), 0);
  mock.restoreAll();
});
