import { useEffect } from 'react';
import { useAppStore } from '../state/store';

const VISIBLE_MS = 9_000;

/** One short message at a time, optionally with an action. It goes away by itself. */
export function Toast() {
  const toast = useAppStore((state) => state.toast);
  const dismissToast = useAppStore((state) => state.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.();
            dismissToast();
          }}
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
  );
}
