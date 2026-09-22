/**
 * Lightweight headless client for the C-Bot API.
 * No framework dependency — use this directly, or as a reference for
 * building a client in any language/framework you like.
 *
 * IMPORTANT: apiKey should be the PUBLIC CHAT KEY (admin panel's
 * Integration page, or GET /v1/admin/chat-key with your admin key) —
 * not the admin API_SECRET_KEY. The public chat key only unlocks
 * /v1/chat and /v1/chat/stream, and is safe to ship in client-side code.
 *
 * Usage (regular, wait-for-full-answer):
 *   const bot = new CompanyBotClient({ baseUrl: "http://localhost:8000", apiKey: "your-api-key" });
 *   const { answer, sources } = await bot.ask("What are your business hours?");
 *
 * Usage (streaming, word-by-word):
 *   await bot.askStream("What are your business hours?", {
 *     onChunk: (text) => console.log(text),      // called repeatedly as text arrives
 *     onDone: (sources) => console.log(sources),  // called once, at the end
 *     onError: (detail) => console.error(detail),
 *   });
 */
class CompanyBotClient {
  constructor({ baseUrl, apiKey }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  async ask(question) {
    const res = await fetch(`${this.baseUrl}/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify({ question }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.detail || `Request failed with status ${res.status}`);
    }

    return res.json(); // { answer, sources }
  }

  /**
   * Streaming version. Uses fetch + manual SSE parsing (not the native
   * EventSource API) because EventSource can't send custom headers like
   * X-API-Key — it only supports GET with no auth header.
   */
  async askStream(question, { onChunk, onDone, onError } = {}) {
    let res;
    try {
      res = await fetch(`${this.baseUrl}/v1/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey,
        },
        body: JSON.stringify({ question }),
      });
    } catch (err) {
      onError?.(err.message);
      return;
    }

    if (!res.ok || !res.body) {
      const errBody = await res.json().catch(() => ({}));
      onError?.(errBody.detail || `Request failed with status ${res.status}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop(); // last (possibly incomplete) event stays in buffer

      for (const rawEvent of events) {
        const line = rawEvent.trim();
        if (!line.startsWith("data: ")) continue;
        const payload = JSON.parse(line.slice("data: ".length));

        if (payload.type === "chunk") onChunk?.(payload.text);
        else if (payload.type === "done") onDone?.(payload.sources);
        else if (payload.type === "error") onError?.(payload.detail);
      }
    }
  }

  async getConfig() {
    const res = await fetch(`${this.baseUrl}/v1/config`);
    return res.json(); // { bot_name, system_prompt, llm_provider, llm_model }
  }
}

// Works in both <script> tag usage and module bundlers
if (typeof module !== "undefined" && module.exports) {
  module.exports = CompanyBotClient;
}
