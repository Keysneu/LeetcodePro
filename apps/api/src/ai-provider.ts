export type AiProvider = "vllm" | "minimax" | "deepseek";

const SUPPORTED_AI_PROVIDERS = new Set<AiProvider>(["vllm", "minimax", "deepseek"]);

export function normalizeAiProvider(value: unknown): AiProvider | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!SUPPORTED_AI_PROVIDERS.has(normalized as AiProvider)) {
    return null;
  }

  return normalized as AiProvider;
}
