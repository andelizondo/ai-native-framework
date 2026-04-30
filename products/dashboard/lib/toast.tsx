"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

export type ToastVariant = "success" | "error";

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  visible: boolean;
}

type Action =
  | { type: "add"; item: ToastItem }
  | { type: "show"; id: string }
  | { type: "hide"; id: string }
  | { type: "remove"; id: string };

function reducer(state: ToastItem[], action: Action): ToastItem[] {
  switch (action.type) {
    case "add":
      return [...state, action.item];
    case "show":
      return state.map((t) => (t.id === action.id ? { ...t, visible: true } : t));
    case "hide":
      return state.map((t) => (t.id === action.id ? { ...t, visible: false } : t));
    case "remove":
      return state.filter((t) => t.id !== action.id);
  }
}

const SUCCESS_DISMISS_MS = 4000;
const EXIT_ANIMATION_MS = 280;

// Split into two contexts so components that only fire toasts don't
// re-render when the toast list changes.
interface ToastStoreContextValue {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

interface ToastActionsContextValue {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastStoreContext = createContext<ToastStoreContextValue | null>(null);
const ToastActionsContext = createContext<ToastActionsContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);

  const dismiss = useCallback((id: string) => {
    dispatch({ type: "hide", id });
    setTimeout(() => dispatch({ type: "remove", id }), EXIT_ANIMATION_MS);
  }, []);

  const add = useCallback(
    (variant: ToastVariant, title: string, description?: string) => {
      const id = crypto.randomUUID();
      dispatch({ type: "add", item: { id, variant, title, description, visible: false } });
      // Double rAF ensures the initial opacity-0/translate-y state is
      // painted before we flip visible → true so the CSS transition fires.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          dispatch({ type: "show", id });
        });
      });
      if (variant === "success") {
        setTimeout(() => dismiss(id), SUCCESS_DISMISS_MS);
      }
    },
    [dismiss],
  );

  const success = useCallback(
    (title: string, description?: string) => add("success", title, description),
    [add],
  );

  const error = useCallback(
    (title: string, description?: string) => add("error", title, description),
    [add],
  );

  const storeValue = useMemo(() => ({ toasts, dismiss }), [toasts, dismiss]);
  const actionsValue = useMemo(() => ({ success, error }), [success, error]);

  return (
    <ToastStoreContext.Provider value={storeValue}>
      <ToastActionsContext.Provider value={actionsValue}>
        {children}
      </ToastActionsContext.Provider>
    </ToastStoreContext.Provider>
  );
}

/** Use in components that fire toasts (actions are stable — won't trigger re-renders). */
export function useToast() {
  const ctx = useContext(ToastActionsContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

/** Use in the Toaster renderer to read the toast list and dismiss. */
export function useToastStore() {
  const ctx = useContext(ToastStoreContext);
  if (!ctx) throw new Error("useToastStore must be used inside ToastProvider");
  return ctx;
}
