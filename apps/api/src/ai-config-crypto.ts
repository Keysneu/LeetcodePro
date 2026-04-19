import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PAYLOAD_VERSION = "v1";
const IV_BYTE_LENGTH = 12;
const AUTH_TAG_BYTE_LENGTH = 16;
const KEY_BYTE_LENGTH = 32;

function parseBase64(value: string): Buffer {
  return Buffer.from(value, "base64");
}

function toBase64(value: Buffer): string {
  return value.toString("base64");
}

function parseEncryptionKey(rawKey: string): Buffer {
  const trimmed = rawKey.trim();
  if (trimmed.length === 0) {
    throw new Error("AI_CONFIG_ENCRYPTION_KEY is missing");
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const parsed = Buffer.from(trimmed, "hex");
    if (parsed.length === KEY_BYTE_LENGTH) {
      return parsed;
    }
  }

  try {
    const parsed = parseBase64(trimmed);
    if (parsed.length === KEY_BYTE_LENGTH) {
      return parsed;
    }
  } catch {
    // Fallback to UTF-8 path.
  }

  const utf8 = Buffer.from(trimmed, "utf8");
  if (utf8.length === KEY_BYTE_LENGTH) {
    return utf8;
  }

  throw new Error("AI_CONFIG_ENCRYPTION_KEY must be exactly 32 bytes (utf8/base64/hex)");
}

export function resolveAiConfigEncryptionKey(): Buffer {
  return parseEncryptionKey(process.env.AI_CONFIG_ENCRYPTION_KEY ?? "");
}

export function encryptAiConfigSecret(plaintext: string, key: Buffer): string {
  if (!plaintext || plaintext.trim().length === 0) {
    throw new Error("secret cannot be empty");
  }

  if (key.length !== KEY_BYTE_LENGTH) {
    throw new Error("invalid encryption key length");
  }

  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [PAYLOAD_VERSION, toBase64(iv), toBase64(authTag), toBase64(encrypted)].join(":");
}

export function decryptAiConfigSecret(payload: string, key: Buffer): string {
  if (key.length !== KEY_BYTE_LENGTH) {
    throw new Error("invalid encryption key length");
  }

  const [version, ivEncoded, authTagEncoded, encryptedEncoded] = payload.split(":");
  if (version !== PAYLOAD_VERSION || !ivEncoded || !authTagEncoded || !encryptedEncoded) {
    throw new Error("invalid ciphertext payload format");
  }

  const iv = parseBase64(ivEncoded);
  const authTag = parseBase64(authTagEncoded);
  const encrypted = parseBase64(encryptedEncoded);

  if (iv.length !== IV_BYTE_LENGTH) {
    throw new Error("invalid ciphertext iv");
  }
  if (authTag.length !== AUTH_TAG_BYTE_LENGTH) {
    throw new Error("invalid ciphertext auth tag");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
