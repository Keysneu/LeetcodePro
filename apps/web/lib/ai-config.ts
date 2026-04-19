export type AiConfigItem = {
  id: string;
  name: string;
  providerKind: "openai_compatible";
  baseUrl: string;
  model: string;
  apiKeyMasked: string;
  apiKeyLast4: string;
  createdAt: string;
  updatedAt: string;
};

export type AiConfigDefaults = {
  reviewConfigId: string | null;
  solutionConfigId: string | null;
};

export type ListAiConfigsResponse = {
  items: AiConfigItem[];
  defaults: AiConfigDefaults;
};

export type UpsertAiConfigInput = {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  providerKind?: "openai_compatible";
};

export type UpdateAiConfigInput = {
  name?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  providerKind?: "openai_compatible";
};

export type UpdateAiDefaultsInput = {
  reviewConfigId?: string | null;
  solutionConfigId?: string | null;
};

export const AI_CONFIG_SYNC_EVENT = "leetcodepro:ai-config-sync";

function parseErrorMessage(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload !== "object" || payload === null) {
    return "请求失败，请稍后重试。";
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string") {
    return record.message;
  }
  if (Array.isArray(record.message) && typeof record.message[0] === "string") {
    return record.message[0];
  }

  return "请求失败，请稍后重试。";
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(parseErrorMessage(payload));
  }

  return payload as T;
}

export async function listAiConfigs(apiBaseUrl: string): Promise<ListAiConfigsResponse> {
  return requestJson<ListAiConfigsResponse>(`${apiBaseUrl}/api/ai/configs`, {
    cache: "no-store"
  });
}

export async function createAiConfig(apiBaseUrl: string, input: UpsertAiConfigInput): Promise<AiConfigItem> {
  const payload = await requestJson<{ item: AiConfigItem }>(`${apiBaseUrl}/api/ai/configs`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      providerKind: "openai_compatible",
      ...input
    })
  });

  return payload.item;
}

export async function updateAiConfig(
  apiBaseUrl: string,
  configId: string,
  input: UpdateAiConfigInput
): Promise<AiConfigItem> {
  const payload = await requestJson<{ item: AiConfigItem }>(`${apiBaseUrl}/api/ai/configs/${configId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return payload.item;
}

export async function deleteAiConfig(apiBaseUrl: string, configId: string): Promise<void> {
  await requestJson<{ deleted: boolean }>(`${apiBaseUrl}/api/ai/configs/${configId}`, {
    method: "DELETE"
  });
}

export async function updateAiDefaults(apiBaseUrl: string, input: UpdateAiDefaultsInput): Promise<AiConfigDefaults> {
  const payload = await requestJson<{ item: AiConfigDefaults }>(`${apiBaseUrl}/api/ai/configs/defaults`, {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return payload.item;
}

export function emitAiConfigSync(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(AI_CONFIG_SYNC_EVENT));
}
