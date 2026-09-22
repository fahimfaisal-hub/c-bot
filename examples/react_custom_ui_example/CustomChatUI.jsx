/**
 * Example of a FULLY custom chat UI, built from scratch, that talks to
 * the same /v1/chat endpoint the default widget.js uses.
 *
 * This is the point: the default widget is optional. A company's dev
 * team can ignore it entirely and build any layout/animation/branding
 * they want — sidebar panel, full-page assistant, voice-first UI,
 * whatever fits their product — as long as they call this one endpoint.
 *
 * IMPORTANT: apiKey here should be the PUBLIC CHAT KEY from the admin
 * panel's Integration page, not the admin API_SECRET_KEY. It only
 * unlocks /v1/chat and /v1/chat/stream, and is safe to ship in
 * client-side code.
 *
 * Usage:
 *   <CustomChatUI apiUrl="http://localhost:8000" apiKey="your-api-key" />
 */
import { useState } from "react";

export default function CustomChatUI({ apiUrl, apiKey }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    // Add an empty bot message, then fill it in as chunks stream in.
    setMessages((prev) => [...prev, { role: "bot", text: "" }]);

    try {
      const res = await fetch(`${apiUrl}/v1/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ question }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || "Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop();

        for (const rawEvent of events) {
          const line = rawEvent.trim();
          if (!line.startsWith("data: ")) continue;
          const payload = JSON.parse(line.slice("data: ".length));

          if (payload.type === "chunk") {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1].text += payload.text;
              return updated;
            });
          } else if (payload.type === "done") {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1].sources = payload.sources;
              return updated;
            });
          } else if (payload.type === "error") {
            throw new Error(payload.detail);
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].text = `Error: ${err.message}`;
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, fontFamily: "Inter, sans-serif" }}>
      {/* This entire layout is arbitrary — replace with your own design system */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, height: 420, overflowY: "auto" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12, textAlign: m.role === "user" ? "right" : "left" }}>
            <div
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: 12,
                background: m.role === "user" ? "#111827" : "#f3f4f6",
                color: m.role === "user" ? "white" : "#111827",
                maxWidth: "80%",
              }}
            >
              {m.text}
            </div>
            {m.sources && m.sources.length > 0 && (
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                Source: {m.sources.join(", ")}
              </div>
            )}
          </div>
        ))}
        {loading && <div style={{ color: "#9ca3af", fontSize: 13 }}>Thinking...</div>}
      </div>

      <div style={{ display: "flex", marginTop: 8, gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask something..."
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          style={{ padding: "10px 16px", borderRadius: 8, background: "#111827", color: "white", border: "none" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
