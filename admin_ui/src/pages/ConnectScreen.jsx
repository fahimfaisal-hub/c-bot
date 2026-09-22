import { useState } from "react";
import { Radio, ArrowRight, AlertCircle } from "lucide-react";
import { useConnection } from "../context/ConnectionContext";
import Button from "../components/Button";

export default function ConnectScreen() {
  const { connect } = useConnection();
  const [baseUrl, setBaseUrl] = useState("http://localhost:8000");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await connect(baseUrl, apiKey);
    setLoading(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="rounded-lg bg-signal-soft text-signal p-2">
            <Radio size={18} />
          </div>
          <span className="font-display font-bold text-lg text-ink">C-Bot</span>
        </div>

        <div className="bg-surface border border-border rounded-card shadow-card p-6">
          <h1 className="font-display font-semibold text-base text-ink mb-1">Connect to your instance</h1>
          <p className="text-xs text-ink-muted mb-5">
            Enter the API URL and key for your self-hosted C-Bot deployment.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">API URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:8000"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-border-strong bg-bg focus:bg-surface outline-none focus:ring-2 focus:ring-signal/30 focus:border-signal transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your API_SECRET_KEY"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-border-strong bg-bg focus:bg-surface outline-none focus:ring-2 focus:ring-signal/30 focus:border-signal transition-colors"
                required
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-bad bg-bad-soft rounded-lg px-3 py-2.5">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" loading={loading} icon={ArrowRight}>
              Connect
            </Button>
          </form>
        </div>

        <p className="text-xs text-ink-faint text-center mt-4">
          Your API key is stored only in this browser's local storage.
        </p>
      </div>
    </div>
  );
}
