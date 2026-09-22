export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {Icon && (
        <div className="rounded-full bg-signal-soft text-signal p-3 mb-4">
          <Icon size={22} />
        </div>
      )}
      <p className="font-display font-semibold text-ink text-base">{title}</p>
      {description && <p className="text-sm text-ink-muted mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
