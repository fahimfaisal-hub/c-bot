export default function Card({ title, description, action, children, className = "" }) {
  return (
    <div className={`bg-surface border border-border rounded-card shadow-card ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div>
            {title && <h2 className="font-display font-semibold text-sm text-ink">{title}</h2>}
            {description && <p className="text-xs text-ink-muted mt-1">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
