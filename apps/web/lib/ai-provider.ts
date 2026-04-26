export type AiProvider = "vllm" | "minimax" | "deepseek";

const AI_PROVIDER_STORAGE_KEY = "leetcodepro.ai.provider";
export const AI_PROVIDER_SYNC_EVENT = "leetcodepro:ai-provider-sync";

function normalizeAiProvider(raw: unknown): AiProvider {
  if (typeof raw !== "string") {
    return "vllm";
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "minimax") {
    return "minimax";
  }
  if (normalized === "deepseek") {
    return "deepseek";
  }
  return "vllm";
}

export function getDefaultAiProvider(): AiProvider {
  return normalizeAiProvider(process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER);
}

export function readPreferredAiProvider(): AiProvider {
  if (typeof window === "undefined") {
    return getDefaultAiProvider();
  }
  return normalizeAiProvider(window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY));
}

export function savePreferredAiProvider(provider: AiProvider): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(AI_PROVIDER_STORAGE_KEY, provider);
  window.dispatchEvent(new Event(AI_PROVIDER_SYNC_EVENT));
}

export function aiProviderLabel(provider: AiProvider): string {
  if (provider === "minimax") {
    return "MiniMax";
  }
  if (provider === "deepseek") {
    return "DeepSeek";
  }
  return "vLLM";
}
