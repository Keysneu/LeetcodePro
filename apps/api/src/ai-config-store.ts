import { query } from "./db";
import { decryptAiConfigSecret, encryptAiConfigSecret, resolveAiConfigEncryptionKey } from "./ai-config-crypto";

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@leetcodepro.local";
const NAME_MAX_LENGTH = 64;
const URL_MAX_LENGTH = 512;
const MODEL_MAX_LENGTH = 128;
const API_KEY_MAX_LENGTH = 4096;

export type AiRequestType = "review" | "solution";
export type ProviderKind = "openai_compatible";

export type RuntimeAiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type PublicAiConfig = {
  id: string;
  name: string;
  providerKind: ProviderKind;
  baseUrl: string;
  model: string;
  apiKeyMasked: string;
  apiKeyLast4: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicAiDefaults = {
  reviewConfigId: string | null;
  solutionConfigId: string | null;
};

export type CreateAiConfigInput = {
  name: string;
  providerKind?: string;
  baseUrl: string;
  model: string;
  apiKey: string;
};

export type UpdateAiConfigInput = {
  name?: string;
  providerKind?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
};

export type UpdateDefaultsInput = {
  reviewConfigId?: string | null;
  solutionConfigId?: string | null;
};

export type ResolveAiRuntimeConfigResult =
  | {
      kind: "none";
    }
  | {
      kind: "configured";
      configId: string;
      runtimeConfig: RuntimeAiConfig;
    }
  | {
      kind: "invalid";
      message: string;
    };

type UserRow = {
  id: string;
};

type AiConfigRow = {
  id: string;
  userId: string;
  name: string;
  providerKind: ProviderKind;
  baseUrl: string;
  model: string;
  apiKeyCiphertext: string;
  apiKeyLast4: string;
  createdAt: string;
  updatedAt: string;
};

type AiDefaultsRow = {
  userId: string;
  reviewConfigId: string | null;
  solutionConfigId: string | null;
  updatedAt: string;
};

function normalizeProviderKind(raw: string | undefined): ProviderKind {
  const normalized = (raw ?? "openai_compatible").trim().toLowerCase();
  if (normalized === "openai_compatible") {
    return "openai_compatible";
  }
  throw new Error("providerKind 仅支持 openai_compatible");
}

function normalizeName(raw: string): string {
  const normalized = raw.trim();
  if (!normalized) {
    throw new Error("配置名称不能为空");
  }
  if (normalized.length > NAME_MAX_LENGTH) {
    throw new Error(`配置名称不能超过 ${NAME_MAX_LENGTH} 个字符`);
  }
  return normalized;
}

function normalizeModel(raw: string): string {
  const normalized = raw.trim();
  if (!normalized) {
    throw new Error("模型名称不能为空");
  }
  if (normalized.length > MODEL_MAX_LENGTH) {
    throw new Error(`模型名称不能超过 ${MODEL_MAX_LENGTH} 个字符`);
  }
  return normalized;
}

function normalizeBaseUrl(raw: string): string {
  const normalized = raw.trim();
  if (!normalized) {
    throw new Error("Base URL 不能为空");
  }
  if (normalized.length > URL_MAX_LENGTH) {
    throw new Error(`Base URL 不能超过 ${URL_MAX_LENGTH} 个字符`);
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Base URL 格式不正确");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Base URL 仅支持 http/https");
  }

  return parsed.toString().replace(/\/+$/, "");
}

function normalizeApiKey(raw: string): string {
  const normalized = raw.trim();
  if (!normalized) {
    throw new Error("API Key 不能为空");
  }
  if (normalized.length > API_KEY_MAX_LENGTH) {
    throw new Error(`API Key 长度不能超过 ${API_KEY_MAX_LENGTH}`);
  }
  return normalized;
}

function maskApiKey(last4: string): string {
  if (!last4) {
    return "••••";
  }
  return `••••${last4}`;
}

function toPublicAiConfig(row: AiConfigRow): PublicAiConfig {
  return {
    id: row.id,
    name: row.name,
    providerKind: row.providerKind,
    baseUrl: row.baseUrl,
    model: row.model,
    apiKeyMasked: maskApiKey(row.apiKeyLast4),
    apiKeyLast4: row.apiKeyLast4,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const pgError = error as { code?: unknown };
  return pgError.code === "23505";
}

async function loadAiConfigById(userId: string, configId: string): Promise<AiConfigRow | null> {
  const result = await query<AiConfigRow>(
    `
      SELECT
        id,
        user_id AS "userId",
        name,
        provider_kind AS "providerKind",
        base_url AS "baseUrl",
        model,
        api_key_ciphertext AS "apiKeyCiphertext",
        api_key_last4 AS "apiKeyLast4",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM user_ai_configs
      WHERE user_id = $1
        AND id = $2
      LIMIT 1;
    `,
    [userId, configId]
  );

  return result.rows[0] ?? null;
}

async function loadAiDefaults(userId: string): Promise<PublicAiDefaults> {
  const result = await query<AiDefaultsRow>(
    `
      SELECT
        user_id AS "userId",
        review_config_id AS "reviewConfigId",
        solution_config_id AS "solutionConfigId",
        updated_at::text AS "updatedAt"
      FROM user_ai_preferences
      WHERE user_id = $1
      LIMIT 1;
    `,
    [userId]
  );

  const row = result.rows[0];
  if (!row) {
    return {
      reviewConfigId: null,
      solutionConfigId: null
    };
  }

  return {
    reviewConfigId: row.reviewConfigId,
    solutionConfigId: row.solutionConfigId
  };
}

async function assertConfigOwnedByUser(userId: string, configId: string): Promise<void> {
  const row = await loadAiConfigById(userId, configId);
  if (!row) {
    throw new Error("默认配置必须是当前用户已保存的 AI 配置");
  }
}

function decodeRuntimeConfig(row: AiConfigRow): RuntimeAiConfig {
  const key = resolveAiConfigEncryptionKey();
  const apiKey = decryptAiConfigSecret(row.apiKeyCiphertext, key);

  return {
    baseUrl: row.baseUrl,
    model: row.model,
    apiKey
  };
}

export async function getOrCreateDemoUserId(): Promise<string> {
  const userResult = await query<UserRow>(
    `
      INSERT INTO users(email, password_hash, nickname)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE
        SET updated_at = NOW()
      RETURNING id;
    `,
    [DEMO_USER_EMAIL, "demo-password-not-used", "Demo User"]
  );

  return userResult.rows[0].id;
}

export async function listUserAiConfigState(userId: string): Promise<{
  items: PublicAiConfig[];
  defaults: PublicAiDefaults;
}> {
  const [configsResult, defaults] = await Promise.all([
    query<AiConfigRow>(
      `
        SELECT
          id,
          user_id AS "userId",
          name,
          provider_kind AS "providerKind",
          base_url AS "baseUrl",
          model,
          api_key_ciphertext AS "apiKeyCiphertext",
          api_key_last4 AS "apiKeyLast4",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM user_ai_configs
        WHERE user_id = $1
        ORDER BY updated_at DESC, created_at DESC;
      `,
      [userId]
    ),
    loadAiDefaults(userId)
  ]);

  return {
    items: configsResult.rows.map(toPublicAiConfig),
    defaults
  };
}

export async function createUserAiConfig(userId: string, input: CreateAiConfigInput): Promise<PublicAiConfig> {
  const providerKind = normalizeProviderKind(input.providerKind);
  const name = normalizeName(input.name);
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const model = normalizeModel(input.model);
  const apiKey = normalizeApiKey(input.apiKey);
  const apiKeyLast4 = apiKey.slice(-4);
  const encryptionKey = resolveAiConfigEncryptionKey();
  const apiKeyCiphertext = encryptAiConfigSecret(apiKey, encryptionKey);

  try {
    const result = await query<AiConfigRow>(
      `
        INSERT INTO user_ai_configs(
          user_id,
          name,
          provider_kind,
          base_url,
          model,
          api_key_ciphertext,
          api_key_last4
        )
        VALUES($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          user_id AS "userId",
          name,
          provider_kind AS "providerKind",
          base_url AS "baseUrl",
          model,
          api_key_ciphertext AS "apiKeyCiphertext",
          api_key_last4 AS "apiKeyLast4",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt";
      `,
      [userId, name, providerKind, baseUrl, model, apiKeyCiphertext, apiKeyLast4]
    );

    return toPublicAiConfig(result.rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("配置名称已存在，请换一个名称");
    }
    throw error;
  }
}

export async function updateUserAiConfig(
  userId: string,
  configId: string,
  input: UpdateAiConfigInput
): Promise<PublicAiConfig | null> {
  const current = await loadAiConfigById(userId, configId);
  if (!current) {
    return null;
  }

  const providerKind = input.providerKind ? normalizeProviderKind(input.providerKind) : current.providerKind;
  const name = input.name !== undefined ? normalizeName(input.name) : current.name;
  const baseUrl = input.baseUrl !== undefined ? normalizeBaseUrl(input.baseUrl) : current.baseUrl;
  const model = input.model !== undefined ? normalizeModel(input.model) : current.model;

  let apiKeyCiphertext = current.apiKeyCiphertext;
  let apiKeyLast4 = current.apiKeyLast4;

  if (input.apiKey !== undefined) {
    const normalizedApiKey = normalizeApiKey(input.apiKey);
    const encryptionKey = resolveAiConfigEncryptionKey();
    apiKeyCiphertext = encryptAiConfigSecret(normalizedApiKey, encryptionKey);
    apiKeyLast4 = normalizedApiKey.slice(-4);
  }

  try {
    const result = await query<AiConfigRow>(
      `
        UPDATE user_ai_configs
        SET
          name = $3,
          provider_kind = $4,
          base_url = $5,
          model = $6,
          api_key_ciphertext = $7,
          api_key_last4 = $8,
          updated_at = NOW()
        WHERE user_id = $1
          AND id = $2
        RETURNING
          id,
          user_id AS "userId",
          name,
          provider_kind AS "providerKind",
          base_url AS "baseUrl",
          model,
          api_key_ciphertext AS "apiKeyCiphertext",
          api_key_last4 AS "apiKeyLast4",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt";
      `,
      [userId, configId, name, providerKind, baseUrl, model, apiKeyCiphertext, apiKeyLast4]
    );

    return result.rows[0] ? toPublicAiConfig(result.rows[0]) : null;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("配置名称已存在，请换一个名称");
    }
    throw error;
  }
}

export async function deleteUserAiConfig(userId: string, configId: string): Promise<boolean> {
  const result = await query<{ id: string }>(
    `
      DELETE FROM user_ai_configs
      WHERE user_id = $1
        AND id = $2
      RETURNING id;
    `,
    [userId, configId]
  );

  return Boolean(result.rows[0]?.id);
}

export async function updateUserAiDefaults(userId: string, input: UpdateDefaultsInput): Promise<PublicAiDefaults> {
  const existing = await loadAiDefaults(userId);
  const nextReviewConfigId = input.reviewConfigId === undefined ? existing.reviewConfigId : input.reviewConfigId;
  const nextSolutionConfigId =
    input.solutionConfigId === undefined ? existing.solutionConfigId : input.solutionConfigId;

  if (nextReviewConfigId) {
    await assertConfigOwnedByUser(userId, nextReviewConfigId);
  }
  if (nextSolutionConfigId) {
    await assertConfigOwnedByUser(userId, nextSolutionConfigId);
  }

  const result = await query<AiDefaultsRow>(
    `
      INSERT INTO user_ai_preferences(
        user_id,
        review_config_id,
        solution_config_id,
        updated_at
      )
      VALUES($1, $2, $3, NOW())
      ON CONFLICT(user_id)
      DO UPDATE SET
        review_config_id = EXCLUDED.review_config_id,
        solution_config_id = EXCLUDED.solution_config_id,
        updated_at = NOW()
      RETURNING
        user_id AS "userId",
        review_config_id AS "reviewConfigId",
        solution_config_id AS "solutionConfigId",
        updated_at::text AS "updatedAt";
    `,
    [userId, nextReviewConfigId, nextSolutionConfigId]
  );

  const row = result.rows[0];
  return {
    reviewConfigId: row.reviewConfigId,
    solutionConfigId: row.solutionConfigId
  };
}

export async function resolveAiRuntimeConfigForRequest(
  userId: string,
  requestType: AiRequestType,
  aiConfigId?: string | null
): Promise<ResolveAiRuntimeConfigResult> {
  if (aiConfigId && aiConfigId.trim().length > 0) {
    const config = await loadAiConfigById(userId, aiConfigId);
    if (!config) {
      return {
        kind: "invalid",
        message: "你选择的 AI 配置不存在，请回到首页重新选择。"
      };
    }

    try {
      return {
        kind: "configured",
        configId: config.id,
        runtimeConfig: decodeRuntimeConfig(config)
      };
    } catch {
      return {
        kind: "invalid",
        message: "AI 配置解密失败，请检查服务端 AI_CONFIG_ENCRYPTION_KEY 配置。"
      };
    }
  }

  const defaults = await loadAiDefaults(userId);
  const defaultConfigId = requestType === "review" ? defaults.reviewConfigId : defaults.solutionConfigId;
  if (!defaultConfigId) {
    return { kind: "none" };
  }

  const config = await loadAiConfigById(userId, defaultConfigId);
  if (!config) {
    return {
      kind: "invalid",
      message: "默认 AI 配置已失效，请回到首页重新设置默认 AI。"
    };
  }

  try {
    return {
      kind: "configured",
      configId: config.id,
      runtimeConfig: decodeRuntimeConfig(config)
    };
  } catch {
    return {
      kind: "invalid",
      message: "默认 AI 配置解密失败，请检查服务端 AI_CONFIG_ENCRYPTION_KEY 配置。"
    };
  }
}
