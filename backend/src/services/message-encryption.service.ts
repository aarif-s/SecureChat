import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export interface MessageEncryptionContext {
  conversationId: string;
  senderId: string;
}

export interface EncryptedMessagePayload {
  algorithm: typeof ALGORITHM;
  keyVersion: number;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export class MessageEncryptionConfigurationError extends Error {
  constructor() {
    super("Message encryption configuration is invalid.");
    this.name = "MessageEncryptionConfigurationError";
  }
}

export class MessageDecryptionError extends Error {
  constructor() {
    super("Unable to decrypt message content.");
    this.name = "MessageDecryptionError";
  }
}

function getActiveKeyVersion(): number {
  const value = process.env.MESSAGE_ENCRYPTION_ACTIVE_KEY_VERSION;
  const version = Number(value);

  if (!value || !Number.isSafeInteger(version) || version < 1) {
    throw new MessageEncryptionConfigurationError();
  }

  return version;
}

function getKey(version: number): Buffer {
  const encodedKey = process.env[`MESSAGE_ENCRYPTION_KEY_V${version}`];
  if (!encodedKey || !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedKey)) {
    throw new MessageEncryptionConfigurationError();
  }

  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== KEY_BYTES || key.toString("base64") !== encodedKey) {
    throw new MessageEncryptionConfigurationError();
  }

  return key;
}

export function validateMessageEncryptionConfig(): void {
  getKey(getActiveKeyVersion());
}

function createAdditionalAuthenticatedData(
  context: MessageEncryptionContext,
  keyVersion: number,
): Buffer {
  return Buffer.from(JSON.stringify({
    conversationId: context.conversationId,
    senderId: context.senderId,
    keyVersion,
  }), "utf8");
}

export function encryptMessage(
  plaintext: string,
  context: MessageEncryptionContext,
): EncryptedMessagePayload {
  const keyVersion = getActiveKeyVersion();
  const key = getKey(keyVersion);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(createAdditionalAuthenticatedData(context, keyVersion));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    algorithm: ALGORITHM,
    keyVersion,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decodeBase64(value: unknown): Buffer {
  if (
    typeof value !== "string" ||
    (value !== "" && !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
  ) {
    throw new MessageDecryptionError();
  }

  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) {
    throw new MessageDecryptionError();
  }

  return decoded;
}

export function decryptMessage(
  payload: EncryptedMessagePayload,
  context: MessageEncryptionContext,
): string {
  if (
    !payload ||
    payload.algorithm !== ALGORITHM ||
    !Number.isSafeInteger(payload.keyVersion) ||
    payload.keyVersion < 1
  ) {
    throw new MessageDecryptionError();
  }

  let key: Buffer;
  try {
    key = getKey(payload.keyVersion);
  } catch {
    throw new MessageDecryptionError();
  }

  const iv = decodeBase64(payload.iv);
  const authTag = decodeBase64(payload.authTag);
  const ciphertext = decodeBase64(payload.ciphertext);
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new MessageDecryptionError();
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(
      createAdditionalAuthenticatedData(context, payload.keyVersion),
    );
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new MessageDecryptionError();
  }
}