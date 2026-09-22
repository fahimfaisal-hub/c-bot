import { useEffect, useState } from "react";
import { RefreshCw, Trash2, MessagesSquare, X, AlertTriangle } from "lucide-react";
import { useConnection } from "../context/ConnectionContext";
import { useToast } from "../context/ToastContext";
import Card from "../components/Card";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import { SkeletonRows } from "../components/Skeleton";

function formatTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function ChatLogs() {
  const { api } = useConnection();
  const toast = useToast();

  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await api.getLogs(50, unansweredOnly);
      setLogs(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unansweredOnly]);

  async function handleClear() {
    if (!confirm("Delete all chat logs? This can't be undone.")) return;
    try {
      await api.clearLogs();
      toast.success("Logs cleared");
      refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink">Chat Logs</h1>
          <p className="text-sm text-ink-muted mt-1">
            Every question asked, the exact prompt sent to the LLM, and whether it looked unanswered.
          </p>
        </div>
      </div>

      <Card
        title="Log entries"
        description={logs ? `${logs.total_questions} total · ${logs.unanswered_questions} unanswered` : undefined}
        action={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={unansweredOnly}
                onChange={(e) => setUnansweredOnly(e.target.checked)}
                className="rounded border-border-strong text-signal focus:ring-signal/30"
              />
              Unanswered only
            </label>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={refresh}>Refresh</Button>
            <Button variant="ghost" size="sm" icon={Trash2} onClick={handleClear} className="hover:text-bad">Clear all</Button>
          </div>
        }
      >
        {loading ? (
          <SkeletonRows count={5} height="h-16" />
        ) : logs && logs.logs.length > 0 ? (
          <div className="divide-y divide-border -mx-5">
            {logs.logs.map((log) => (
              <button
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="w-full text-left px-5 py-3.5 hover:bg-bg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink truncate flex-1">{log.question}</p>
                  {log.is_unanswered && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-warn bg-warn-soft px-2 py-0.5 rounded-full">
                      <AlertTriangle size={11} />
                      unanswered
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-faint mt-1 font-mono">
                  {formatTime(log.timestamp)} · {log.sources.length ? log.sources.join(", ") : "no sources"}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={MessagesSquare}
            title={unansweredOnly ? "No unanswered questions" : "No logs yet"}
            description={unansweredOnly ? "Nice — every logged question found an answer." : "Ask the bot something to see logs appear here."}
          />
        )}
      </Card>

      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}

function LogDetailModal({ log, onClose }) {
  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-card shadow-pop max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-display font-semibold text-sm text-ink">{log.question}</h3>
            <p className="text-xs text-ink-faint mt-1 font-mono">{formatTime(log.timestamp)}</p>
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-1.5">Answer</p>
            <p className="text-sm text-ink bg-bg rounded-lg p-3">{log.answer}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-1.5">Sources</p>
            <p className="text-sm font-mono text-ink-muted">{log.sources.length ? log.sources.join(", ") : "none"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-1.5">
              Full prompt sent to the LLM
            </p>
            <pre className="text-xs font-mono text-ink bg-bg rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
              {log.final_prompt}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
