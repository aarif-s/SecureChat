import assert from "node:assert/strict";
import test from "node:test";

import {
  createVerificationToken,
  hashVerificationToken,
} from "./verification-token.js";

test("verification tokens are high entropy and only hashes are persisted", () => {
  const token = createVerificationToken();
  const tokenHash = hashVerificationToken(token);

  assert.equal(token.length >= 43, true);
  assert.match(tokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(tokenHash, token);
  assert.notEqual(hashVerificationToken(createVerificationToken()), tokenHash);
});
