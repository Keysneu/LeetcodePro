import * as assert from "node:assert/strict";
import { test } from "node:test";

import { decryptAiConfigSecret, encryptAiConfigSecret } from "./ai-config-crypto";

const KEY = Buffer.from("12345678901234567890123456789012", "utf8");
const OTHER_KEY = Buffer.from("abcdefghijklmnopqrstuvwxzy123456", "utf8");

test("encryptAiConfigSecret + decryptAiConfigSecret roundtrip", () => {
  const ciphertext = encryptAiConfigSecret("sk-test-abc123", KEY);
  assert.ok(ciphertext.startsWith("v1:"));
  const plaintext = decryptAiConfigSecret(ciphertext, KEY);
  assert.equal(plaintext, "sk-test-abc123");
});

test("decryptAiConfigSecret fails with wrong key", () => {
  const ciphertext = encryptAiConfigSecret("sk-test-abc123", KEY);
  assert.throws(() => {
    decryptAiConfigSecret(ciphertext, OTHER_KEY);
  });
});

test("decryptAiConfigSecret fails when ciphertext is tampered", () => {
  const ciphertext = encryptAiConfigSecret("sk-test-abc123", KEY);
  const tampered = ciphertext.slice(0, -1) + (ciphertext.endsWith("A") ? "B" : "A");

  assert.throws(() => {
    decryptAiConfigSecret(tampered, KEY);
  });
});
