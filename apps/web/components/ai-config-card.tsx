"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AI_CONFIG_SYNC_EVENT,
  createAiConfig,
  deleteAiConfig,
  emitAiConfigSync,
  listAiConfigs,
  type AiConfigDefaults,
  type AiConfigItem,
  updateAiConfig,
  updateAiDefaults
} from "@/lib/ai-config";

type Props = {
  apiBaseUrl: string;
};

type ConfigFormState = {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
};

const EMPTY_FORM: ConfigFormState = {
  name: "",
  baseUrl: "",
  model: "",
  apiKey: ""
};

function formatTime(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString();
}

export default function AiConfigCard({ apiBaseUrl }: Props) {
  const [items, setItems] = useState<AiConfigItem[]>([]);
  const [defaults, setDefaults] = useState<AiConfigDefaults>({
    reviewConfigId: null,
    solutionConfigId: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ConfigFormState>(EMPTY_FORM);
  const [savingForm, setSavingForm] = useState(false);

  const [draftDefaults, setDraftDefaults] = useState<AiConfigDefaults>({
    reviewConfigId: null,
    solutionConfigId: null
  });
  const [savingDefaults, setSavingDefaults] = useState(false);

  const hasConfigItems = items.length > 0;

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await listAiConfigs(apiBaseUrl);
      setItems(data.items);
      setDefaults(data.defaults);
      setDraftDefaults(data.defaults);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "加载 AI 配置失败。";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  useEffect(() => {
    const onSync = () => {
      void loadConfigs();
    };

    window.addEventListener(AI_CONFIG_SYNC_EVENT, onSync);
    return () => {
      window.removeEventListener(AI_CONFIG_SYNC_EVENT, onSync);
    };
  }, [loadConfigs]);

  const editingConfig = useMemo(() => items.find((item) => item.id === editingId) ?? null, [editingId, items]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }, []);

  const handleSubmitForm = useCallback(async () => {
    setSavingForm(true);
    setError(null);

    try {
      if (editingId) {
        await updateAiConfig(apiBaseUrl, editingId, {
          name: form.name,
          baseUrl: form.baseUrl,
          model: form.model,
          ...(form.apiKey.trim().length > 0 ? { apiKey: form.apiKey } : {})
        });
      } else {
        await createAiConfig(apiBaseUrl, form);
      }

      resetForm();
      await loadConfigs();
      emitAiConfigSync();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "保存 AI 配置失败。";
      setError(message);
    } finally {
      setSavingForm(false);
    }
  }, [apiBaseUrl, editingId, form, loadConfigs, resetForm]);

  const handleDelete = useCallback(
    async (configId: string) => {
      if (!window.confirm("确认删除该 AI 配置吗？删除后默认选择可能会被清空。")) {
        return;
      }

      setError(null);
      try {
        await deleteAiConfig(apiBaseUrl, configId);
        if (editingId === configId) {
          resetForm();
        }
        await loadConfigs();
        emitAiConfigSync();
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : "删除 AI 配置失败。";
        setError(message);
      }
    },
    [apiBaseUrl, editingId, loadConfigs, resetForm]
  );

  const handleSaveDefaults = useCallback(async () => {
    setSavingDefaults(true);
    setError(null);

    try {
      const next = await updateAiDefaults(apiBaseUrl, {
        reviewConfigId: draftDefaults.reviewConfigId,
        solutionConfigId: draftDefaults.solutionConfigId
      });
      setDefaults(next);
      setDraftDefaults(next);
      emitAiConfigSync();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "保存默认 AI 失败。";
      setError(message);
    } finally {
      setSavingDefaults(false);
    }
  }, [apiBaseUrl, draftDefaults.reviewConfigId, draftDefaults.solutionConfigId]);

  return (
    <section className="lc-card overflow-hidden">
      <div className="border-b bg-[var(--lc-surface-soft)] px-5 py-4">
        <h2 className="text-base font-semibold text-[var(--lc-text)]">我的 AI 配置（OpenAI 兼容）</h2>
        <p className="mt-1 text-xs text-[var(--lc-text-muted)]">
          你可以维护多个 AI 配置，并分别设置“AI判题”和“AI题解”的默认配置。API Key 仅密文存储。
        </p>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3">
          <p className="mb-2 text-sm font-semibold text-[var(--lc-text)]">默认配置</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs text-[var(--lc-text-muted)]">
              <span>AI判题默认配置</span>
              <select
                className="lc-select w-full"
                value={draftDefaults.reviewConfigId ?? ""}
                onChange={(event) =>
                  setDraftDefaults((previous) => ({
                    ...previous,
                    reviewConfigId: event.target.value || null
                  }))
                }
                disabled={savingDefaults || loading}
              >
                <option value="">未设置（需手动选择）</option>
                {items.map((item) => (
                  <option key={`review-${item.id}`} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs text-[var(--lc-text-muted)]">
              <span>AI题解默认配置</span>
              <select
                className="lc-select w-full"
                value={draftDefaults.solutionConfigId ?? ""}
                onChange={(event) =>
                  setDraftDefaults((previous) => ({
                    ...previous,
                    solutionConfigId: event.target.value || null
                  }))
                }
                disabled={savingDefaults || loading}
              >
                <option value="">未设置（需手动选择）</option>
                {items.map((item) => (
                  <option key={`solution-${item.id}`} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button type="button" className="lc-btn-secondary h-8 px-3 text-xs" onClick={() => setDraftDefaults(defaults)} disabled={savingDefaults}>
              还原
            </button>
            <button type="button" className="lc-btn-primary h-8 px-3 text-xs" onClick={() => void handleSaveDefaults()} disabled={savingDefaults || loading}>
              {savingDefaults ? "保存中..." : "保存默认配置"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3">
          <p className="mb-2 text-sm font-semibold text-[var(--lc-text)]">{editingConfig ? "编辑 AI 配置" : "新增 AI 配置"}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs text-[var(--lc-text-muted)]">
              <span>配置名称</span>
              <input
                type="text"
                className="lc-select w-full"
                placeholder="例如：我的 GPT-4o"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                disabled={savingForm}
              />
            </label>
            <label className="space-y-1 text-xs text-[var(--lc-text-muted)]">
              <span>模型名</span>
              <input
                type="text"
                className="lc-select w-full"
                placeholder="例如：gpt-4o-mini"
                value={form.model}
                onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
                disabled={savingForm}
              />
            </label>
            <label className="space-y-1 text-xs text-[var(--lc-text-muted)] md:col-span-2">
              <span>Base URL</span>
              <input
                type="text"
                className="lc-select w-full"
                placeholder="例如：https://api.openai.com/v1"
                value={form.baseUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
                disabled={savingForm}
              />
            </label>
            <label className="space-y-1 text-xs text-[var(--lc-text-muted)] md:col-span-2">
              <span>API Key {editingConfig ? "（留空则不修改）" : ""}</span>
              <input
                type="password"
                className="lc-select w-full"
                placeholder={editingConfig ? "留空不改，或输入新 Key" : "请输入 API Key"}
                value={form.apiKey}
                onChange={(event) => setForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                disabled={savingForm}
              />
            </label>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            {editingConfig ? (
              <button type="button" className="lc-btn-secondary h-8 px-3 text-xs" onClick={resetForm} disabled={savingForm}>
                取消编辑
              </button>
            ) : null}
            <button type="button" className="lc-btn-primary h-8 px-3 text-xs" onClick={() => void handleSubmitForm()} disabled={savingForm}>
              {savingForm ? "保存中..." : editingConfig ? "保存修改" : "新增配置"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="border-b bg-[var(--lc-surface-soft)] px-3 py-2 text-xs text-[var(--lc-text-muted)]">已保存配置</div>
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-3 text-sm text-[var(--lc-text-muted)]">加载中...</p>
            ) : hasConfigItems ? (
              <div className="divide-y">
                {items.map((item) => {
                  const isDefaultReview = defaults.reviewConfigId === item.id;
                  const isDefaultSolution = defaults.solutionConfigId === item.id;

                  return (
                    <div key={item.id} className="space-y-2 px-3 py-3 text-xs text-[var(--lc-text-muted)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--lc-text)]">{item.name}</p>
                          <p className="mt-0.5 font-mono">{item.baseUrl}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="lc-btn-secondary h-7 px-2.5 text-xs"
                            onClick={() => {
                              setEditingId(item.id);
                              setForm({
                                name: item.name,
                                baseUrl: item.baseUrl,
                                model: item.model,
                                apiKey: ""
                              });
                            }}
                          >
                            编辑
                          </button>
                          <button type="button" className="lc-btn-secondary h-7 px-2.5 text-xs" onClick={() => void handleDelete(item.id)}>
                            删除
                          </button>
                        </div>
                      </div>

                      <p>model: {item.model}</p>
                      <p>
                        key: {item.apiKeyMasked}（后四位 {item.apiKeyLast4 || "----"}）
                      </p>
                      <p>更新时间：{formatTime(item.updatedAt)}</p>
                      <p>
                        {isDefaultReview ? "[AI判题默认] " : ""}
                        {isDefaultSolution ? "[AI题解默认]" : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="px-3 py-3 text-sm text-[var(--lc-text-muted)]">你还没有保存任何 AI 配置。</p>
            )}
          </div>
        </div>

        {error ? <p className="text-sm text-[var(--lc-danger)]">{error}</p> : null}
      </div>
    </section>
  );
}
