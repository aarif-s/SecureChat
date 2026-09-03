import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  decryptMessage,
  encryptMessage,
  MessageEncryptionConfigurationError,
  MessageDecryptionError,
  validateMessageEncryptionConfig,
} from "./message-encryption.service.js";

process.env.MESSAGE_ENCRYPTION_ACTIVE_KEY_VERSION = "1";
process.env.MESSAGE_ENCRYPTION_KEY_V1 = randomBytes(32).toString("base64");

const context = {
  conversationId: "507f1f77bcf86cd799439011",
  senderId: "507f1f77bcf86cd799439012",
};

test("encrypts and decrypts message content", () => {
  const plaintext = "Hello, SecureChat! こんにちは";
  const encrypted = encryptMessage(plaintext, context);

  assert.equal(decryptMessage(encrypted, context), plaintext);
  assert.equal(encrypted.algorithm, "aes-256-gcm");
  assert.equal(encrypted.keyVersion, 1);
});

test("uses a fresh IV for identical plaintext", () => {
  const first = encryptMessage("same", context);
  const second = encryptMessage("same", context);

  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test("supports empty and maximum-length plaintext", () => {
  const empty = encryptMessage("", context);
  const maximum = encryptMessage("x".repeat(5000), context);

  assert.equal(decryptMessage(empty, context), "");
  assert.equal(decryptMessage(maximum, context), "x".repeat(5000));
});

test("rejects tampered ciphertext, tag, and AAD", () => {
  const encrypted = encryptMessage("protected", context);

  assert.throws(
    () => decryptMessage({ ...encrypted, ciphertext: `${encrypted.ciphertext}A` }, context),
    MessageDecryptionError,
  );
  assert.throws(
    () => decryptMessage({ ...encrypted, authTag: `${encrypted.authTag}A` }, context),
    MessageDecryptionError,
  );
  assert.throws(
    () => decryptMessage(encrypted, { ...context, senderId: "507f1f77bcf86cd799439013" }),
    MessageDecryptionError,
  );
});

test("rejects invalid payloads and unsupported key versions", () => {
  const encrypted = encryptMessage("protected", context);

  assert.throws(
    () => decryptMessage({ ...encrypted, iv: "invalid" }, context),
    MessageDecryptionError,
  );
  assert.throws(
    () => decryptMessage({ ...encrypted, keyVersion: 2 }, context),
    MessageDecryptionError,
  );
  assert.throws(
    () => decryptMessage({ ...encrypted, authTag: undefined } as never, context),
    MessageDecryptionError,
  );
});

test("rejects a wrong key with the same key version", () => {
  const encrypted = encryptMessage("protected", context);
  const originalKey = process.env.MESSAGE_ENCRYPTION_KEY_V1;
  process.env.MESSAGE_ENCRYPTION_KEY_V1 = randomBytes(32).toString("base64");

  try {
    assert.throws(() => decryptMessage(encrypted, context), MessageDecryptionError);
  } finally {
    process.env.MESSAGE_ENCRYPTION_KEY_V1 = originalKey;
  }
});

test("validates encryption key configuration", () => {
  const originalKey = process.env.MESSAGE_ENCRYPTION_KEY_V1;
  process.env.MESSAGE_ENCRYPTION_KEY_V1 = randomBytes(31).toString("base64");

  try {
    assert.throws(validateMessageEncryptionConfig, MessageEncryptionConfigurationError);
  } finally {
    process.env.MESSAGE_ENCRYPTION_KEY_V1 = originalKey;
  }
});