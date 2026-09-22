import { useEffect, useState } from "react";
import { Save, PlayCircle } from "lucide-react";
import { useConnection } from "../context/ConnectionContext";
import { useToast } from "../context/ToastContext";
import Card from "../components/Card";
import Button from "../components/Button";
import StatusPulse from "../components/StatusPulse";
import Skeleton from "../components/Skeleton";

function formatRelative(iso) {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return "less than an hour ago";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Automation() {
  const { api } = useConnection();
  const toast = useToast();

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retentionDays, setRetentionDays] = useState(0);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncHours, setSyncHours] = useState(24);
  const [savingRetention, setSavingRetention] = useState(false);
  const [savingSync, setSavingSync] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await api.getAutomation();
      setSettings(data);
      setRetentionDays(data.log_retention_days);
      setSyncEnabled(data.auto_sync_enabled);
      setSyncHours(data.auto_sync_interval_hours);
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

  async function handleSaveRetention() {
    setSavingRetention(true);
    try {
      await api.updateLogRetention(Number(retentionDays));
      toast.success(retentionDays > 0 ? `Logs older than ${retentionDays} days will be auto-deleted.` : "Auto-clear disabled.");
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingRetention(false);
    }
  }

  async function handleSaveSync() {
    setSavingSync(true);
    try {
      await api.updateAutoSync(syncEnabled, Number(syncHours));
      toast.success(syncEnabled ? `Auto-sync enabled — every ${syncHours}h.` : "Auto-sync disabled.");
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingSync(false);
    }
  }

  async function handleSyncNow() {
    setSyncingNow(true);
    try {
      const result = await api.syncAllNow();
      toast.success(`Synced ${result.synced.length} source(s).${result.failed.length ? ` ${result.failed.length} failed.` : ""}`);
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncingNow(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-ink">Automation</h1>
        <p className="text-sm text-ink-muted mt-1">Background tasks that run without any manual work.</p>
      </div>

      <Card
        title="Log auto-clear"
        description="Automatically deletes chat logs older than the given number of days. Checked once a day."
        action={loading ? null : <StatusPulse variant={settings.log_retention_days > 0 ? "good" : "idle"} label={`Last ran: ${formatRelative(settings.last_log_cleanup_at)}`} />}
      >
        {loading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Keep logs for (days)</label>
              <input
                type="number"
                min={0}
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                className="w-32 px-3 py-2 text-sm font-mono rounded-lg border border-border-strong bg-bg focus:bg-surface outline-none focus:ring-2 focus:ring-signal/30 focus:border-signal transition-colors"
              />
            </div>
            <Button icon={Save} loading={savingRetention} onClick={handleSaveRetention}>Save</Button>
          </div>
        )}
        <p className="text-xs text-ink-faint mt-2">Set to 0 to disable — logs are kept until manually cleared.</p>
      </Card>

      <Card
        title="Scheduled auto-sync"
        description="Automatically re-fetches every website URL in your knowledge base on a fixed schedule."
        action={loading ? null : <StatusPulse variant={settings.auto_sync_enabled ? "good" : "idle"} label={`Last ran: ${formatRelative(settings.last_auto_sync_at)}`} pulse={settings.auto_sync_enabled} />}
      >
        {loading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
              <input
                type="checkbox"
                checked={syncEnabled}
                onChange={(e) => setSyncEnabled(e.target.checked)}
                className="rounded border-border-strong text-signal focus:ring-signal/30"
              />
              Enable scheduled auto-sync
            </label>

            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Every (hours)</label>
                <input
                  type="number"
                  min={1}
                  value={syncHours}
                  onChange={(e) => setSyncHours(e.target.value)}
                  className="w-32 px-3 py-2 text-sm font-mono rounded-lg border border-border-strong bg-bg focus:bg-surface outline-none focus:ring-2 focus:ring-signal/30 focus:border-signal transition-colors"
                />
              </div>
              <Button icon={Save} loading={savingSync} onClick={handleSaveSync}>Save</Button>
              <Button variant="secondary" icon={PlayCircle} loading={syncingNow} onClick={handleSyncNow}>
                Sync all URLs now
              </Button>
            </div>
          </div>
        )}
        <p className="text-xs text-ink-faint mt-3">Only applies to URL sources, not uploaded files.</p>
      </Card>
    </div>
  );
}
