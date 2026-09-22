const VARIANTS = {
  primary: "bg-signal text-white hover:bg-signal-hover disabled:bg-signal/50",
  secondary: "bg-surface text-ink border border-border-strong hover:bg-bg disabled:opacity-50",
  danger: "bg-bad text-white hover:bg-bad/90 disabled:bg-bad/50",
  ghost: "text-ink-muted hover:text-ink hover:bg-bg disabled:opacity-50",
};

const SIZES = {
  sm: "text-xs px-2.5 py-1.5 gap-1.5",
  md: "text-sm px-3.5 py-2 gap-2",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  className = "",
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        Icon && <Icon size={size === "sm" ? 14 : 16} />
      )}
      {children}
    </button>
  );
}
