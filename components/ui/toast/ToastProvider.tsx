"use client";

import { createContext, useContext, useMemo, useReducer, useState, type ReactNode } from "react";
import { toastReducer, type ToastInput } from "./toast-store";
import { ToastAnnouncer } from "./ToastAnnouncer";
import { ToastViewport } from "./ToastViewport";
import { useAutoDismiss } from "./use-auto-dismiss";

type Message<T> = string | ((value: T) => string);

export type ToastApi = {
  show: (input: ToastInput) => string;
  update: (id: string, patch: Partial<ToastInput>) => void;
  dismiss: (id: string) => void;
  /** Chargement, puis succès ou erreur : le loader de la notification se referme en anneau au succès. */
  promise: <T>(task: Promise<T>, messages: { loading: string; success: Message<T>; error: Message<unknown> }) => Promise<T>;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast doit être appelé sous un <ToastProvider>.");
  return api;
}

let lastToastId = 0;
const nextToastId = () => `toast-${++lastToastId}`;

const resolveMessage = <T,>(message: Message<T>, value: T) => (typeof message === "function" ? message(value) : message);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);
  const [isPaused, setIsPaused] = useState(false);
  useAutoDismiss(toasts, isPaused, dispatch);

  const api = useMemo<ToastApi>(() => {
    const show = (input: ToastInput) => {
      const id = nextToastId();
      dispatch({ type: "add", toast: { id, ...input } });
      return id;
    };
    const update = (id: string, patch: Partial<ToastInput>) => dispatch({ type: "update", id, patch });
    const dismiss = (id: string) => dispatch({ type: "dismiss", id });

    const promise: ToastApi["promise"] = async (task, messages) => {
      const id = show({ tone: "loading", title: messages.loading });
      try {
        const value = await task;
        update(id, { tone: "success", title: resolveMessage(messages.success, value) });
        return value;
      } catch (error: unknown) {
        update(id, { tone: "error", title: resolveMessage(messages.error, error) });
        throw error;
      }
    };

    return { show, update, dismiss, promise };
  }, []);

  return (
    <ToastContext value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={api.dismiss} onPauseChange={setIsPaused} />
      <ToastAnnouncer toasts={toasts} />
    </ToastContext>
  );
}
