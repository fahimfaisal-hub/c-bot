export default function StatCard({ label, value, sublabel, icon: Icon, accent = "signal" }) {
  const accentClasses = {
    signal: "text-signal bg-signal-soft",
    good: "text-good bg-good-soft",
    warn: "text-warn bg-warn-soft",
    bad: "text-bad bg-bad-soft",
  }[accent];

  return (
    <div className="bg-surface border border-border rounded-card shadow-card p-5 flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">{label}</p>
        <p className="font-mono text-3xl font-semibold text-ink mt-2">{value}</p>
        {sublabel && <p className="text-xs text-ink-faint mt-1">{sublabel}</p>}
      </div>
      {Icon && (
        <div className={`shrink-0 rounded-lg p-2 ${accentClasses}`}>
          <Icon size={18} />
        </div>
      )}
    </div>
  );
}
