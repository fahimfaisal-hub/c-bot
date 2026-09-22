import { useEffect, useState } from "react";
import { Save, ShieldCheck, KeyRound } from "lucide-react";
import { useConnection } from "../context/ConnectionContext";
import { useToast } from "../context/ToastContext";
import Card from "../components/Card";
import Button from "../components/Button";
import Skeleton from "../components/Skeleton";

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "local", label: "Local / OpenAI-compatible (Ollama, vLLM, OpenRouter…)" },
];

const EMBEDDING_PROVIDER_OPTIONS = [
  { value: "local", label: "Local (free, sentence-transformers, no API key)" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
];

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm rounded-lg border border-border-strong bg-bg focus:bg-surface outline-none focus:ring-2 focus:ring-signal/30 focus:border-signal transition-colors"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export default function BotSettings() {
  const { api, botName } = useConnection();
  const toast = useToast();

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // AI provider state
  const [providerSettings, setProviderSettings] = useState(null);
  const [llmProvider, setLlmProvider] = useState("openai");
  const [llmModel, setLlmModel] = useState("");
  const [llmBaseUrl, setLlmBaseUrl] = useState("");
  const [llmApiKeyInput, setLlmApiKeyInput] = useState("");
  const [savingLlm, setSavingLlm] = useState(false);

  const [embProvider, setEmbProvider] = useState("local");
  const [embModel, setEmbModel] = useState("");
  const [embApiKeyInput, setEmbApiKeyInput] = useState("");
  const [savingEmb, setSavingEmb] = useState(false);

  useEffect(() => {
    Promise.all([api.getSystemPrompt(), api.getProviderSettings()])
      .then(([promptRes, providerRes]) => {
        setPrompt(promptRes.system_prompt);
        setProviderSettings(providerRes);
        setLlmProvider(providerRes.llm_provider);
        setLlmModel(providerRes.llm_model);
        setLlmBaseUrl(providerRes.llm_base_url);
        setEmbProvider(providerRes.embedding_provider);
        setEmbModel(providerRes.embedding_model);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSavePrompt() {
    setSaving(true);
    try {
      await api.updateSystemPrompt(prompt);
      toast.success("System prompt saved — new questions will use it immediately.");
      setDirty(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLlm() {
    setSavingLlm(true);
    try {
      const res = await api.updateLlmProvider(llmProvider, llmModel, llmBaseUrl, llmApiKeyInput);
      setProviderSettings(res);
      setLlmApiKeyInput("");
      toast.success("LLM settings saved — applies to the next question, no restart needed.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingLlm(false);
    }
  }

  async function handleSaveEmbedding() {
    setSavingEmb(true);
    try {
      const res = await api.updateEmbeddingProvider(embProvider, embModel, embApiKeyInput);
      setProviderSettings(res);
      setEmbApiKeyInput("");
      toast.success("Embedding settings saved. Note: existing documents keep their old embeddings until re-uploaded/re-synced.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingEmb(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-ink">Bot Settings</h1>
        <p className="text-sm text-ink-muted mt-1">Configure how {botName} behaves and which AI provider it uses.</p>
      </div>

      <Card
        title="System prompt"
        description="Controls tone and behavior. Changes apply immediately — no restart needed."
        action={
          <Button icon={Save} size="sm" loading={saving} disabled={!dirty} onClick={handleSavePrompt}>
            Save
          </Button>
        }
      >
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setDirty(true);
            }}
            rows={8}
            className="w-full text-sm font-mono rounded-lg border border-border-strong bg-bg focus:bg-surface outline-none focus:ring-2 focus:ring-signal/30 focus:border-signal transition-colors p-3 leading-relaxed resize-y"
          />
        )}
      </Card>

      <div className="flex items-start gap-2.5 text-xs text-ink-muted bg-signal-soft rounded-lg p-3">
        <ShieldCheck size={15} className="shrink-0 mt-0.5 text-signal" />
        <p>
          API keys entered below are <strong>write-only</strong>: you can set or
          replace them here, but this panel never displays an existing key back
          to you (not even masked) — only whether one is currently set. This
          keeps the risk the same as editing <code className="font-mono">.env</code> by
          hand, with the convenience of no restart.
        </p>
      </div>

      <Card
        title="LLM provider"
        description="Used to generate chat answers."
        action={<Button size="sm" icon={Save} loading={savingLlm} onClick={handleSaveLlm}>Save</Button>}
      >
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Provider">
                <Select value={llmProvider} onChange={setLlmProvider} options={PROVIDER_OPTIONS} />
              </Field>
              <Field label="Model">
                <input
                  type="text"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-border-strong bg-bg focus:bg-surface outline-none focus:ring-2 focus:ring-signal/30 focus:border-signal transition-colors"
                />
              </Field>
            </div>

            {llmProvider === "local" && (
              <Field label="Base URL (Ollama, vLLM, OpenRouter, etc.)">
                <input
                  type="text"
                  value={llmBaseUrl}
                  onChange={(e) => setLlmBaseUrl(e.target.value)}
                  placeholder="https://openrouter.ai/api/v1"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-border-strong bg-bg focus:bg-surface outline-none focus:ring-2 focus:ring-signal/30 focus:border-signal transition-colors"
                />
              </Field>
            )}

            <Field label={`API key ${providerSettings?.llm_api_key_set ? "(currently set — leave blank to keep it)" : "(not set)"}`}>
              <div className="relative">
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  type="password"
                  value={llmApiKeyInput}
                  onChange={(e) => setLlmApiKeyInput(e.target.value)}
                  placeholder={providerSettings?.llm_api_key_set ? "•••••••••••••••• (unchanged)" : "Enter API key"}
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono rounded-lg border border-border-strong bg-bg focus:bg-surface outline-none focus:ring-2 focus:ring-signal/30 focus:border-signal transition-colors"
                  autoComplete="off"
                />
              </div>
            </Field>
          </div>
        )}
      </Card>

      <Card
        title="Embedding provider"
        description="Used to index documents and match questions to relevant content."
        action={<Button size="sm" icon={Save} loading={savingEmb} onClick={handleSaveEmbedding}>Save</Button>}
      >
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Provider">
                <Select value={embProvider} onChange={setEmbProvider} options={EMBEDDING_PROVIDER_OPTIONS} />
              </Field>
              <Field label="Model">
                <input
                  type="text"
                  value={embModel}
                  onChange={(e) => setEmbModel(e.target.value)}
                  placeholder={embProvider === "local" ? "all-MiniLM-L6-v2" : "text-embedding-3-small"}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-border-strong bg-bg focus:bg-surface outline-none focus:ring-2 focus:ring-signal/30 focus:border-signal transition-colors"
                />
              </Field>
            </div>

            {embProvider !== "local" && (
              <Field label={`API key ${providerSettings?.embedding_api_key_set ? "(currently set — leave blank to keep it)" : "(not set)"}`}>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input
                    type="password"
                    value={embApiKeyInput}
                    onChange={(e) => setEmbApiKeyInput(e.target.value)}
                    placeholder={providerSettings?.embedding_api_key_set ? "•••••••••••••••• (unchanged)" : "Enter API key"}
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono rounded-lg border border-border-strong bg-bg focus:bg-surface outline-none focus:ring-2 focus:ring-signal/30 focus:border-signal transition-colors"
                    autoComplete="off"
                  />
                </div>
              </Field>
            )}
            <p className="text-xs text-ink-faint">
              Changing this doesn't re-embed existing documents — re-upload or re-sync sources afterward if you want them on the new model.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
