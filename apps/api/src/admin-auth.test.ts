import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_ADMIN_API_KEY,
  ensureAdminAuthorized,
  isAdminKeyAuthorized,
  resolveAdminApiKey
} from "./admin-auth";

test("resolveAdminApiKey returns default key when env key is missing", () => {
  assert.equal(resolveAdminApiKey(undefined), DEFAULT_ADMIN_API_KEY);
  assert.equal(resolveAdminApiKey("   "), DEFAULT_ADMIN_API_KEY);
});

test("resolveAdminApiKey returns trimmed key when env key exists", () => {
  assert.equal(resolveAdminApiKey("  custom-key  "), "custom-key");
});

test("isAdminKeyAuthorized validates exact key match", () => {
  assert.equal(isAdminKeyAuthorized("k1", "k1"), true);
  assert.equal(isAdminKeyAuthorized("k1", " k1 "), true);
  assert.equal(isAdminKeyAuthorized("k1", "k2"), false);
  assert.equal(isAdminKeyAuthorized("k1", undefined), false);
  assert.equal(isAdminKeyAuthorized("k1", "  "), false);
});

test("ensureAdminAuthorized throws when key is missing or invalid", () => {
  assert.throws(() => ensureAdminAuthorized(undefined, "secure-key"), /Missing or invalid x-admin-key/);
  assert.throws(() => ensureAdminAuthorized("wrong", "secure-key"), /Missing or invalid x-admin-key/);
});

test("ensureAdminAuthorized passes when key is valid", () => {
  assert.doesNotThrow(() => ensureAdminAuthorized("secure-key", "secure-key"));
  assert.doesNotThrow(() => ensureAdminAuthorized(DEFAULT_ADMIN_API_KEY, undefined));
});
