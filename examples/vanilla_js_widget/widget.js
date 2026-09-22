/**
 * Default embeddable chat widget — a floating launcher button that opens
 * a slide-in side panel, for companies who want a working chatbot without
 * building their own UI. No dependencies, no build step — drop the
 * <script> tag in and it works.
 *
 * IMPORTANT: data-api-key should be the PUBLIC CHAT KEY (admin panel's
 * Integration page, or GET /v1/admin/chat-key with your admin key), NOT
 * the admin API_SECRET_KEY. The public key only unlocks /v1/chat — safe
 * to be visible in page source. The admin key must never appear here.
 *
 * Embed with:
 *   <script src="widget.js"
 *     data-api-url="http://localhost:8000"
 *     data-api-key="your-PUBLIC-chat-key"
 *     data-bot-name="Company Assistant"
 *     data-accent-color="#3454D1"
 *     data-greeting="Hi! Ask me anything about us."
 *     data-position="right">
 *   </script>
 *
 * This widget calls the exact same /v1/chat/stream endpoint that a fully
 * custom UI would use (see api_client.js) — it's just one pre-built
 * frontend option among many, not a special privileged path.
 */
(function () {
  const scriptTag = document.currentScript;
  const apiUrl = (scriptTag.getAttribute("data-api-url") || "http://localhost:8000").replace(/\/$/, "");
  const apiKey = scriptTag.getAttribute("data-api-key") || "";
  const botName = scriptTag.getAttribute("data-bot-name") || "Company Assistant";
  const accentColor = scriptTag.getAttribute("data-accent-color") || "#3454D1";
  const greeting = scriptTag.getAttribute("data-greeting") || `Hi 👋 Ask me anything and I'll do my best to help.`;
  const position = scriptTag.getAttribute("data-position") === "left" ? "left" : "right";

  // ---------- Styles ----------
  const style = document.createElement("style");
  style.textContent = `
    #cbf-root, #cbf-root * { box-sizing: border-box; }
    #cbf-root {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --cbf-accent: ${accentColor};
    }
    #cbf-launcher {
      position: fixed; bottom: 24px; ${position}: 24px; width: 56px; height: 56px;
      border-radius: 50%; background: var(--cbf-accent); color: #fff; border: none;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.18); z-index: 2147483000;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    #cbf-launcher:hover { transform: scale(1.06); box-shadow: 0 6px 20px rgba(0,0,0,0.22); }
    #cbf-launcher svg { width: 24px; height: 24px; }
    /* Hide the launcher entirely while the panel is open — the panel's
       own header close button handles closing. Without this, the
       launcher (fixed bottom-right, above the panel in z-index) visually
       overlaps and hides the panel's send button, which sits in the
       same bottom-right corner. */
    #cbf-root.cbf-open #cbf-launcher { opacity: 0; pointer-events: none; transform: scale(0.85); }

    #cbf-overlay {
      position: fixed; inset: 0; background: rgba(15,17,23,0.28); z-index: 2147482998;
      opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
    }
    #cbf-root.cbf-open #cbf-overlay { opacity: 1; pointer-events: auto; }

    #cbf-panel {
      position: fixed; top: 0; ${position}: 0; height: 100%; width: 400px; max-width: 100vw;
      background: #fff; z-index: 2147482999; display: flex; flex-direction: column;
      box-shadow: ${position === "right" ? "-8px 0 30px" : "8px 0 30px"} rgba(0,0,0,0.14);
      transform: translateX(${position === "right" ? "100%" : "-100%"});
      transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
    }
    #cbf-root.cbf-open #cbf-panel { transform: translateX(0); }

    #cbf-header {
      background: var(--cbf-accent); color: #fff; padding: 18px 20px;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    #cbf-header-title { font-weight: 600; font-size: 15px; }
    #cbf-header-sub { font-size: 12px; opacity: 0.85; margin-top: 2px; }
    #cbf-header-close { background: rgba(255,255,255,0.15); border: none; color: #fff;
      width: 28px; height: 28px; border-radius: 8px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; }
    #cbf-header-close:hover { background: rgba(255,255,255,0.25); }

    #cbf-messages { flex: 1; overflow-y: auto; padding: 16px; background: #F7F8FA; }
    #cbf-messages::-webkit-scrollbar { width: 6px; }
    #cbf-messages::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 6px; }

    .cbf-greeting { background: #fff; border: 1px solid #E5E7EB; border-radius: 12px;
      padding: 12px 14px; font-size: 13.5px; color: #374151; line-height: 1.5; margin-bottom: 14px; }

    .cbf-row { display: flex; margin-bottom: 12px; }
    .cbf-row.cbf-user { justify-content: flex-end; }
    .cbf-bubble { max-width: 82%; padding: 9px 13px; border-radius: 14px; font-size: 13.5px;
      line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
    .cbf-row.cbf-user .cbf-bubble { background: var(--cbf-accent); color: #fff; border-bottom-right-radius: 4px; }
    .cbf-row.cbf-bot .cbf-bubble { background: #fff; color: #14171F; border: 1px solid #E5E7EB; border-bottom-left-radius: 4px; }
    .cbf-sources { font-size: 11px; color: #9AA1AE; margin-top: 5px; padding: 0 2px; }

    .cbf-typing { display: inline-flex; gap: 3px; padding: 2px 0; }
    .cbf-typing span { width: 5px; height: 5px; border-radius: 50%; background: #9AA1AE;
      animation: cbf-bounce 1.2s infinite ease-in-out; }
    .cbf-typing span:nth-child(2) { animation-delay: 0.15s; }
    .cbf-typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes cbf-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }

    #cbf-input-area { flex-shrink: 0; border-top: 1px solid #E5E7EB; padding: 12px; background: #fff; }
    #cbf-input-row { display: flex; align-items: flex-end; gap: 8px; background: #F7F8FA;
      border: 1px solid #E5E7EB; border-radius: 12px; padding: 6px 6px 6px 12px; }
    #cbf-input-row:focus-within { border-color: var(--cbf-accent); }
    #cbf-input { flex: 1; border: none; background: transparent; resize: none; outline: none;
      font-size: 13.5px; font-family: inherit; max-height: 100px; padding: 6px 0; line-height: 1.4; }
    #cbf-send { border: none; background: var(--cbf-accent); color: #fff; width: 32px; height: 32px;
      border-radius: 9px; cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: opacity 0.15s ease; }
    #cbf-send:disabled { opacity: 0.4; cursor: not-allowed; }
    #cbf-branding { text-align: center; font-size: 10.5px; color: #B4BAC5; padding-top: 8px; }

    @media (max-width: 480px) {
      #cbf-panel { width: 100vw; }
    }
  `;
  document.head.appendChild(style);

  // ---------- Structure ----------
  const root = document.createElement("div");
  root.id = "cbf-root";
  root.innerHTML = `
    <div id="cbf-overlay"></div>
    <div id="cbf-panel" role="dialog" aria-label="${botName} chat">
      <div id="cbf-header">
        <div>
          <div id="cbf-header-title">${botName}</div>
          <div id="cbf-header-sub">Usually replies instantly</div>
        </div>
        <button id="cbf-header-close" aria-label="Close chat">${iconX()}</button>
      </div>
      <div id="cbf-messages">
        <div class="cbf-greeting">${greeting}</div>
      </div>
      <div id="cbf-input-area">
        <div id="cbf-input-row">
          <textarea id="cbf-input" rows="1" placeholder="Type your question…"></textarea>
          <button id="cbf-send" aria-label="Send">${iconSend()}</button>
        </div>
        <div id="cbf-branding">Powered by C-Bot</div>
      </div>
    </div>
    <button id="cbf-launcher" aria-label="Open chat">
      ${iconChat()}
    </button>
  `;
  document.body.appendChild(root);

  function iconChat() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
  }
  function iconX() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  }
  function iconSend() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;
  }

  const launcher = root.querySelector("#cbf-launcher");
  const overlay = root.querySelector("#cbf-overlay");
  const closeBtn = root.querySelector("#cbf-header-close");
  const messagesEl = root.querySelector("#cbf-messages");
  const inputEl = root.querySelector("#cbf-input");
  const sendBtn = root.querySelector("#cbf-send");

  // ---------- Open/close ----------
  function openPanel() {
    root.classList.add("cbf-open");
    setTimeout(() => inputEl.focus(), 150);
  }
  function closePanel() {
    root.classList.remove("cbf-open");
  }
  launcher.addEventListener("click", () => {
    root.classList.contains("cbf-open") ? closePanel() : openPanel();
  });
  overlay.addEventListener("click", closePanel);
  closeBtn.addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.classList.contains("cbf-open")) closePanel();
  });

  // ---------- Input auto-grow ----------
  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + "px";
  });
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  sendBtn.addEventListener("click", sendMessage);

  // ---------- Messaging ----------
  function appendRow(role) {
    const row = document.createElement("div");
    row.className = `cbf-row cbf-${role}`;
    const bubble = document.createElement("div");
    bubble.className = "cbf-bubble";
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function typingIndicator() {
    const span = document.createElement("span");
    span.className = "cbf-typing";
    span.innerHTML = "<span></span><span></span><span></span>";
    return span;
  }

  async function sendMessage() {
    const question = inputEl.value.trim();
    if (!question) return;

    appendRow("user").textContent = question;
    inputEl.value = "";
    inputEl.style.height = "auto";
    sendBtn.disabled = true;

    const botBubble = appendRow("bot");
    botBubble.appendChild(typingIndicator());
    let firstChunkReceived = false;
    let sourcesEl = null;

    try {
      const res = await fetch(`${apiUrl}/v1/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ question }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}));
        botBubble.textContent = errBody.detail || "Sorry, something went wrong.";
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
        buffer = events.pop();

        for (const rawEvent of events) {
          const line = rawEvent.trim();
          if (!line.startsWith("data: ")) continue;
          const payload = JSON.parse(line.slice("data: ".length));

          if (payload.type === "chunk") {
            if (!firstChunkReceived) {
              botBubble.textContent = "";
              firstChunkReceived = true;
            }
            botBubble.textContent += payload.text;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          } else if (payload.type === "done") {
            if (payload.sources && payload.sources.length) {
              sourcesEl = document.createElement("div");
              sourcesEl.className = "cbf-sources";
              sourcesEl.textContent = `Source: ${payload.sources.join(", ")}`;
              botBubble.parentElement.appendChild(sourcesEl);
            }
          } else if (payload.type === "error") {
            botBubble.textContent = payload.detail;
          }
        }
      }
    } catch (err) {
      botBubble.textContent = "Sorry, couldn't reach the server. Please try again.";
    } finally {
      sendBtn.disabled = false;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }
})();
