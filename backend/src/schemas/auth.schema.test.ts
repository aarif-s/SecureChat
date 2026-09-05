import assert from "node:assert/strict";
import test from "node:test";

import {
  loginSchema,
  registerSchema,
} from "./auth.schema.js";

test("auth schemas normalize valid email addresses", () => {
  const result = registerSchema.parse({
    email: "  Person@Example.COM ",
    password: "correct horse battery staple",
    displayName: " Person ",
  });

  assert.equal(result.email, "person@example.com");
  assert.equal(result.displayName, "Person");
});

test("registration rejects malformed emails and short passwords", () => {
  const result = registerSchema.safeParse({
    email: "not-an-email",
    password: "short",
    displayName: "Person",
  });

  assert.equal(result.success, false);
});

test("login applies the same email normalization", () => {
  const result = loginSchema.parse({
    email: " USER@Example.com ",
    password: "password",
  });

  assert.equal(result.email, "user@example.com");
});
