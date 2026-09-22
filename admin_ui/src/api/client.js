/**
 * Thin wrapper around the C-Bot REST API. Every call in
 * this app goes through here — same endpoints documented at /docs.
 */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(baseUrl, apiKey, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // response wasn't JSON, keep default message
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return null;
  return res.json();
}

export function createApiClient(baseUrl, apiKey) {
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");

  return {
    // ---- connection / health ----
    health: () => fetch(`${cleanBaseUrl}/health`).then((r) => r.ok),
    getConfig: () => request(cleanBaseUrl, apiKey, "/v1/config"),

    // ---- knowledge base ----
    getSources: () => request(cleanBaseUrl, apiKey, "/v1/sources"),
    deleteSource: (source) =>
      request(cleanBaseUrl, apiKey, "/v1/sources", {
        method: "DELETE",
        body: JSON.stringify({ source }),
      }),
    ingestUrl: (url) =>
      request(cleanBaseUrl, apiKey, "/v1/ingest/url", {
        method: "POST",
        body: JSON.stringify({ url }),
      }),
    syncSource: (source) =>
      request(cleanBaseUrl, apiKey, `/v1/sync/${encodeURIComponent(source)}`, { method: "POST" }),
    ingestFile: async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${cleanBaseUrl}/v1/ingest/file`, {
        method: "POST",
        headers: apiKey ? { "X-API-Key": apiKey } : {},
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(body.detail || "Upload failed", res.status);
      }
      return res.json();
    },

    // ---- chat logs ----
    getLogs: (limit = 50, unansweredOnly = false) =>
      request(cleanBaseUrl, apiKey, `/v1/admin/logs?limit=${limit}&unanswered_only=${unansweredOnly}`),
    clearLogs: () => request(cleanBaseUrl, apiKey, "/v1/admin/logs", { method: "DELETE" }),

    // ---- system prompt ----
    getSystemPrompt: () => request(cleanBaseUrl, apiKey, "/v1/admin/system-prompt"),
    updateSystemPrompt: (systemPrompt) =>
      request(cleanBaseUrl, apiKey, "/v1/admin/system-prompt", {
        method: "PUT",
        body: JSON.stringify({ system_prompt: systemPrompt }),
      }),

    // ---- chat public key ----
    getChatPublicKey: () => request(cleanBaseUrl, apiKey, "/v1/admin/chat-key"),
    regenerateChatPublicKey: () => request(cleanBaseUrl, apiKey, "/v1/admin/chat-key/regenerate", { method: "POST" }),

    // ---- allowed domains ----
    getAllowedDomains: () => request(cleanBaseUrl, apiKey, "/v1/admin/allowed-domains"),
    updateAllowedDomains: (domains) =>
      request(cleanBaseUrl, apiKey, "/v1/admin/allowed-domains", {
        method: "PUT",
        body: JSON.stringify({ allowed_domains: domains }),
      }),

    // ---- AI provider settings ----
    getProviderSettings: () => request(cleanBaseUrl, apiKey, "/v1/admin/provider-settings"),
    updateLlmProvider: (provider, model, baseUrl, apiKeyValue) =>
      request(cleanBaseUrl, apiKey, "/v1/admin/provider-settings/llm", {
        method: "PUT",
        body: JSON.stringify({ provider, model, base_url: baseUrl, api_key: apiKeyValue || null }),
      }),
    updateEmbeddingProvider: (provider, model, apiKeyValue) =>
      request(cleanBaseUrl, apiKey, "/v1/admin/provider-settings/embedding", {
        method: "PUT",
        body: JSON.stringify({ provider, model, api_key: apiKeyValue || null }),
      }),

    // ---- automation ----
    getAutomation: () => request(cleanBaseUrl, apiKey, "/v1/admin/automation"),
    updateLogRetention: (retentionDays) =>
      request(cleanBaseUrl, apiKey, "/v1/admin/automation/log-retention", {
        method: "PUT",
        body: JSON.stringify({ retention_days: retentionDays }),
      }),
    updateAutoSync: (enabled, intervalHours) =>
      request(cleanBaseUrl, apiKey, "/v1/admin/automation/auto-sync", {
        method: "PUT",
        body: JSON.stringify({ enabled, interval_hours: intervalHours }),
      }),
    syncAllNow: () => request(cleanBaseUrl, apiKey, "/v1/admin/sync-all-now", { method: "POST" }),
  };
}
