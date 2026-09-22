import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type = "info") => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const toast = {
    success: (msg) => push(msg, "success"),
    error: (msg) => push(msg, "error"),
    info: (msg) => push(msg, "info"),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const config = {
    success: { icon: CheckCircle2, className: "border-good/30 bg-good-soft text-good" },
    error: { icon: XCircle, className: "border-bad/30 bg-bad-soft text-bad" },
    info: { icon: Info, className: "border-signal/30 bg-signal-soft text-signal" },
  }[toast.type];

  const Icon = config.icon;

  return (
    <div
      className={`flex items-start gap-2.5 rounded-card border shadow-pop px-3.5 py-3 bg-surface animate-[fadein_0.15s_ease-out]`}
      role="status"
    >
      <Icon size={18} className={`shrink-0 mt-0.5 ${config.className.split(" ")[2]}`} />
      <p className="text-sm text-ink flex-1 leading-snug">{toast.message}</p>
      <button onClick={onDismiss} className="text-ink-faint hover:text-ink-muted shrink-0">
        <X size={15} />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
