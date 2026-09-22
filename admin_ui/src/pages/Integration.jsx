import { useEffect, useState } from "react";
import { Copy, Check, Code2, RefreshCw, ShieldAlert, Plus, X } from "lucide-react";
import { useConnection } from "../context/ConnectionContext";
import { useToast } from "../context/ToastContext";
import Card from "../components/Card";
import Button from "../components/Button";
import Skeleton from "../components/Skeleton";

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="relative group">
      <pre className="text-xs font-mono text-ink bg-bg border border-border rounded-lg p-4 overflow-x-auto whitespace-pre leading-relaxed">
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2.5 right-2.5 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-surface border border-border text-ink-muted hover:text-ink opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check size={13} className="text-good" /> : <Copy size={13} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function Integration() {
  const { api, baseUrl } = useConnection();
  const toast = useToast();

  const [chatKey, setChatKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [domains, setDomains] = useState([]);
  const [domainInput, setDomainInput] = useState("");
  const [savingDomains, setSavingDomains] = useState(false);

  useEffect(() => {
    Promise.all([api.getChatPublicKey(), api.getAllowedDomains()])
      .then(([keyRes, domainsRes]) => {
        setChatKey(keyRes.chat_public_key);
        setDomains(domainsRes.allowed_domains);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRegenerate() {
    if (!confirm("Rotate the public chat key? Any widget or custom UI using the old key will stop working until updated.")) return;
    setRegenerating(true);
    try {
      const res = await api.regenerateChatPublicKey();
      setChatKey(res.chat_public_key);
      toast.success("Chat key rotated. Update any embedded widgets with the new key.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleAddDomain(e) {
    e.preventDefault();
    const cleaned = domainInput.trim().toLowerCase();
    if (!cleaned || domains.includes(cleaned)) {
      setDomainInput("");
      return;
    }
    const updated = [...domains, cleaned];
    setSavingDomains(true);
    try {
      const res = await api.updateAllowedDomains(updated);
      setDomains(res.allowed_domains);
      setDomainInput("");
      toast.success(`Added ${cleaned}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingDomains(false);
    }
  }

  async function handleRemoveDomain(domain) {
    const updated = domains.filter((d) => d !== domain);
    setSavingDomains(true);
    try {
      const res = await api.updateAllowedDomains(updated);
      setDomains(res.allowed_domains);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingDomains(false);
    }
  }

  const widgetSnippet = chatKey && `<script src="widget.js"
  data-api-url="${baseUrl}"
  data-api-key="${chatKey}"
  data-bot-name="Company Assistant"
  data-accent-color="#3454D1"
  data-greeting="Hi! Ask me anything about us."
  data-position="right">
</script>`;

  const headlessSnippet = chatKey && `const res = await fetch("${baseUrl}/v1/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${chatKey}",
  },
  body: JSON.stringify({ question: "What are your business hours?" }),
});
const { answer, sources } = await res.json();`;

  const streamSnippet = chatKey && `const res = await fetch("${baseUrl}/v1/chat/stream", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${chatKey}",
  },
  body: JSON.stringify({ question: "What are your business hours?" }),
});
// Read res.body as a stream of Server-Sent Events —
// see examples/vanilla_js_widget/api_client.js for a full reference.`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-ink">Integration</h1>
        <p className="text-sm text-ink-muted mt-1">
          Ready-to-use snippets for connecting a chat interface to this bot.
        </p>
      </div>

      <Card title="Public chat key">
        <div className="flex items-start gap-2.5 text-xs text-ink-muted bg-bg rounded-lg p-3 mb-4">
          <ShieldAlert size={15} className="shrink-0 mt-0.5 text-warn" />
          <p>
            This key is safe to embed in a public website — it only unlocks{" "}
            <code className="font-mono">/v1/chat</code> and{" "}
            <code className="font-mono">/v1/chat/stream</code>, never admin
            routes. It's separate from your admin API key, which should
            never appear in a public frontend.
          </p>
        </div>

        {loading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono bg-bg border border-border rounded-lg px-3 py-2 truncate">
              {chatKey}
            </code>
            <Button variant="secondary" size="sm" icon={RefreshCw} loading={regenerating} onClick={handleRegenerate}>
              Rotate
            </Button>
          </div>
        )}
      </Card>

      <Card
        title="Allowed domains"
        description="Restrict the public chat key to specific websites. Empty = any site can use it (relying on scope + rate limiting alone)."
      >
        {loading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {domains.length === 0 && (
                <span className="text-xs text-ink-faint">No restriction — any domain can currently use this key.</span>
              )}
              {domains.map((domain) => (
                <span
                  key={domain}
                  className="inline-flex items-center gap-1.5 text-xs font-mono bg-signal-soft text-signal px-2.5 py-1 rounded-full"
                >
                  {domain}
                  <button onClick={() => handleRemoveDomain(domain)} disabled={savingDomains}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <form onSubmit={handleAddDomain} className="flex gap-2">
              <input
                type="text"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="yourcompany.com"
                className="flex-1 px-3 py-2 text-sm font-mono rounded-lg border border-border-strong bg-bg focus:bg-surface outline-none focus:ring-2 focus:ring-signal/30 focus:border-signal transition-colors"
              />
              <Button type="submit" size="sm" icon={Plus} loading={savingDomains}>Add</Button>
            </form>
          </>
        )}
      </Card>

      <Card
        title="Option A — Default widget"
        description="Floating launcher button + slide-in side panel. Drop into your website's HTML for a working chat interface in minutes."
      >
        {loading ? <Skeleton className="h-32 w-full" /> : <CodeBlock code={widgetSnippet} />}
        <p className="text-xs text-ink-faint mt-3">
          File: <code className="font-mono">examples/vanilla_js_widget/widget.js</code> · set{" "}
          <code className="font-mono">data-position</code> to <code className="font-mono">"left"</code> or{" "}
          <code className="font-mono">"right"</code>
        </p>
      </Card>

      <Card
        title="Option B — Headless (custom UI)"
        description="Call the API directly from any frontend you build yourself."
      >
        {loading ? <Skeleton className="h-32 w-full" /> : <CodeBlock code={headlessSnippet} />}
        <p className="text-xs text-ink-faint mt-3">
          Full example: <code className="font-mono">examples/react_custom_ui_example/CustomChatUI.jsx</code>
        </p>
      </Card>

      <Card title="Streaming responses" description="Word-by-word answers via Server-Sent Events.">
        {loading ? <Skeleton className="h-32 w-full" /> : <CodeBlock code={streamSnippet} />}
      </Card>

      <Card title="API reference">
        <a
          href={`${baseUrl}/docs`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-signal hover:text-signal-hover"
        >
          <Code2 size={16} />
          Open full API docs ({baseUrl}/docs)
        </a>
      </Card>
    </div>
  );
}
