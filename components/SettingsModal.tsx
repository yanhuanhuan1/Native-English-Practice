"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  AI_PROVIDER_PRESETS,
  buildProviderRequestUrl,
  createSettingsForProvider,
  resolveProviderForSettings
} from "@/lib/ai/config";
import type { ApiSettings } from "@/types/settings";

interface SettingsModalProps {
  open: boolean;
  settings: ApiSettings;
  hasServerKey?: boolean;
  onClose: () => void;
  onSave: (settings: ApiSettings) => void;
}

export function SettingsModal({
  open,
  settings,
  hasServerKey = false,
  onClose,
  onSave
}: SettingsModalProps) {
  const [draft, setDraft] = useState<ApiSettings>(settings);

  useEffect(() => {
    if (open) {
      setDraft(settings);
    }
  }, [open, settings]);

  const selectedProvider = useMemo(
    () => resolveProviderForSettings(draft),
    [draft]
  );
  const requestUrl = buildProviderRequestUrl(
    draft.baseUrl,
    selectedProvider.endpointPath,
    selectedProvider.id
  );

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="settings-title"
        aria-modal="true"
        className="settings-modal"
        role="dialog"
      >
        <div className="modal-header">
          <h2 id="settings-title">设置</h2>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            title="关闭设置"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              apiKey: draft.apiKey.trim(),
              providerId: selectedProvider.id,
              baseUrl: draft.baseUrl.trim(),
              model: draft.model.trim()
            });
          }}
        >
          <label>
            <span>AI 服务商</span>
            <select
              value={draft.providerId}
              onChange={(event) => {
                const nextSettings = createSettingsForProvider(
                  event.target.value
                );
                setDraft((current) => ({
                  ...nextSettings,
                  apiKey:
                    current.providerId === nextSettings.providerId
                      ? current.apiKey
                      : ""
                }));
              }}
            >
              {AI_PROVIDER_PRESETS.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>

          <div className="provider-summary">
            <strong>{selectedProvider.shortLabel}</strong>
            <span>
              {selectedProvider.protocol === "anthropic"
                ? "Anthropic 原生协议"
                : "OpenAI 兼容协议"}
            </span>
            <p>{selectedProvider.note}</p>
          </div>

          {hasServerKey ? (
            <div className="server-key-notice">
              API Key 已由服务端统一配置，无需填写。
            </div>
          ) : (
            <label>
              <span>{selectedProvider.apiKeyLabel}</span>
              <input
                autoComplete="off"
                placeholder="只保存在本机浏览器里"
                type="password"
                value={draft.apiKey}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    apiKey: event.target.value
                  }))
                }
              />
            </label>
          )}

          <label>
            <span>模型名称</span>
            <input
              type="text"
              value={draft.model}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  model: event.target.value
                }))
              }
            />
          </label>

          <label>
            <span>接口地址</span>
            <input
              type="url"
              value={draft.baseUrl}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  baseUrl: event.target.value
                }))
              }
            />
          </label>

          <div className="endpoint-preview">
            <span>实际请求地址</span>
            <code>{requestUrl}</code>
          </div>

          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={onClose}>
              取消
            </button>
            <button className="primary-button" type="submit">
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
