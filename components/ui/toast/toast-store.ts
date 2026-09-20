/** État des notifications : fonctions pures, testées sans DOM. */

export type ToastTone = "info" | "success" | "error" | "loading";

export type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
};

export type ToastInput = Omit<Toast, "id">;

export type ToastAction =
  | { type: "add"; toast: Toast }
  | { type: "update"; id: string; patch: Partial<ToastInput> }
  | { type: "dismiss"; id: string };

/** Au-delà, les plus anciennes cèdent la place. */
export const MAX_TOASTS = 4;

const AUTO_DISMISS_MS: Readonly<Record<ToastTone, number | null>> = {
  info: 5000,
  success: 5000,
  error: 8000,
  loading: null,
};

/** Délai de fermeture automatique ; null : reste affichée tant que la tâche dure. */
export function autoDismissDelay(tone: ToastTone): number | null {
  return AUTO_DISMISS_MS[tone];
}

export function toastReducer(state: readonly Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case "add":
      return [...state, action.toast].slice(-MAX_TOASTS);
    case "update":
      return state.map((toast) => (toast.id === action.id ? { ...toast, ...action.patch } : toast));
    case "dismiss":
      return state.filter((toast) => toast.id !== action.id);
  }
}
