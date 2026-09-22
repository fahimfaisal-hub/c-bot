import { useEffect, useState, useRef } from "react";
import { Upload, Link2, RefreshCw, Trash2, FileText, Globe, Database } from "lucide-react";
import { useConnection } from "../context/ConnectionContext";
import { useToast } from "../context/ToastContext";
import Card from "../components/Card";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import { SkeletonRows } from "../components/Skeleton";

export default function KnowledgeBase() {
  const { api } = useConnection();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [sources, setSources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [addingUrl, setAddingUrl] = useState(false);
  const [syncingSource, setSyncingSource] = useState(null);
  const [deletingSource, setDeletingSource] = useState(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await api.getSources();
      setSources(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.ingestFile(file);
      toast.success(`Added ${result.chunks_added} chunks from ${result.source}`);
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAddUrl(e) {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setAddingUrl(true);
    try {
      const result = await api.ingestUrl(urlInput.trim());
      toast.success(`Added ${result.chunks_added} chunks from ${result.source}`);
      setUrlInput("");
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAddingUrl(false);
    }
  }

  async function handleSync(source) {
    setSyncingSource(source);
    try {
      const result = await api.syncSource(source);
      toast.success(`Re-synced: ${result.chunks_added} chunks updated`);
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncingSource(null);
    }
  }

  async function handleDelete(source) {
    if (!confirm(`Delete "${source}" from the knowledge base? This can't be undone.`)) return;
    setDeletingSource(source);
    try {
      await api.deleteSource(source);
      toast.success(`Deleted ${source}`);
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingSource(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-ink">Knowledge Base</h1>
        <p className="text-sm text-ink-muted mt-1">Upload documents or add website pages the bot should learn from.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Upload a document" description="PDF, DOCX, CSV, TXT, or MD">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.csv,.txt,.md"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border-strong rounded-lg py-8 cursor-pointer hover:border-signal hover:bg-signal-soft/40 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          >
            <Upload size={20} className="text-ink-faint" />
            <span className="text-sm text-ink-muted">
              {uploading ? "Uploading…" : "Click to choose a file"}
            </span>
          </label>
        </Card>

        <Card title="Add a website page" description="Auto-syncable — re-fetches on demand or on schedule">
          <form onSubmit={handleAddUrl} className="flex flex-col gap-3">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://yourcompany.com/faq"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border-strong bg-bg focus:bg-surface outline-none focus:ring-2 focus:ring-signal/30 focus:border-signal transition-colors font-mono"
            />
            <Button type="submit" icon={Link2} loading={addingUrl} className="self-start">
              Add URL
            </Button>
          </form>
        </Card>
      </div>

      <Card
        title="Sources"
        description={sources ? `${sources.sources.length} sources · ${sources.total_chunks} chunks total` : undefined}
        action={
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={refresh}>
            Refresh
          </Button>
        }
      >
        {loading ? (
          <SkeletonRows count={4} />
        ) : sources && sources.sources.length > 0 ? (
          <div className="divide-y divide-border -mx-5">
            {sources.sources.map((source) => {
              const isUrl = source.startsWith("http");
              return (
                <div key={source} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 text-ink-faint">
                      {isUrl ? <Globe size={16} /> : <FileText size={16} />}
                    </div>
                    <span className="text-sm font-mono text-ink truncate">{source}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={RefreshCw}
                        loading={syncingSource === source}
                        onClick={() => handleSync(source)}
                      >
                        Re-sync
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      loading={deletingSource === source}
                      onClick={() => handleDelete(source)}
                      className="hover:text-bad"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Database}
            title="No documents yet"
            description="Upload a file or add a website URL above to start building your bot's knowledge base."
          />
        )}
      </Card>
    </div>
  );
}
