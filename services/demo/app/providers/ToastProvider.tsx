"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toasts: Toast[];
  show: (type: ToastType, message: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  show: () => {},
  dismiss: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    // Auto-dismiss after 4s
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toasts, show, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const colors: Record<ToastType, { bg: string; border: string; icon: string }> = {
    success: { bg: "bg-green-900/80", border: "border-green-500/50", icon: "text-green-400" },
    error: { bg: "bg-red-900/80", border: "border-red-500/50", icon: "text-red-400" },
    warning: { bg: "bg-yellow-900/80", border: "border-yellow-500/50", icon: "text-yellow-400" },
    info: { bg: "bg-blue-900/80", border: "border-blue-500/50", icon: "text-blue-400" },
  };

  const icons: Record<ToastType, string> = {
    success: "\u2713",
    error: "\u2717",
    warning: "!",
    info: "i",
  };

  const { bg, border, icon } = colors[toast.type];

  return (
    <div
      className={`${bg} ${border} border rounded-lg px-4 py-3 shadow-lg backdrop-blur-sm animate-slide-in-right flex items-start gap-3`}
      role="alert"
      aria-live="polite"
    >
      <span className={`${icon} font-bold text-sm flex-shrink-0 mt-0.5`}>
        {icons[toast.type]}
      </span>
      <p className="text-sm text-white/90 flex-1">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="text-white/50 hover:text-white text-sm flex-shrink-0"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}
