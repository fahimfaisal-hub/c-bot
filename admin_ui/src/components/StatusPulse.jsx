const VARIANTS = {
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
  idle: "bg-ink-faint",
  signal: "bg-signal",
};

/**
 * Small colored dot + label, used consistently across the app: connection
 * status, sync status, unanswered flags. This recurring motif is the
 * panel's signature visual language — a running system being monitored.
 */
export default function StatusPulse({ variant = "idle", label, pulse = false }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${VARIANTS[variant]} opacity-60`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${VARIANTS[variant]}`} />
      </span>
      {label}
    </span>
  );
}
