import { useEffect, useRef, type Dispatch } from "react";
import { autoDismissDelay, type Toast, type ToastAction } from "./toast-store";

/** Compte à rebours d'une notification : en pause, il garde le temps restant. */
type Countdown = { timer: number | null; remainingMs: number; startedAt: number };

function pauseCountdown(countdown: Countdown, now: number): Countdown {
  if (countdown.timer === null) return countdown;
  window.clearTimeout(countdown.timer);
  return { timer: null, remainingMs: Math.max(0, countdown.remainingMs - (now - countdown.startedAt)), startedAt: now };
}

function resumeCountdown(countdown: Countdown, now: number, onExpire: () => void): Countdown {
  if (countdown.timer !== null) return countdown;
  return { timer: window.setTimeout(onExpire, countdown.remainingMs), remainingMs: countdown.remainingMs, startedAt: now };
}

/** Une clé par ton : quand un chargement devient un succès, un nouveau compte à rebours démarre. */
const countdownKey = (toast: Toast) => `${toast.id}:${toast.tone}`;

/**
 * Ferme chaque notification après son délai. Tant que la pile est survolée ou focalisée,
 * les comptes à rebours sont suspendus, puis reprennent là où ils s'étaient arrêtés.
 */
export function useAutoDismiss(toasts: readonly Toast[], isPaused: boolean, dispatch: Dispatch<ToastAction>): void {
  const countdowns = useRef(new Map<string, Countdown>());

  useEffect(() => {
    const active = countdowns.current;
    const now = Date.now();
    const due = new Map(
      toasts.flatMap((toast) => {
        const delay = autoDismissDelay(toast.tone);
        return delay === null ? [] : [[countdownKey(toast), { id: toast.id, delay }] as const];
      }),
    );

    active.forEach((countdown, key) => {
      if (due.has(key)) return;
      if (countdown.timer !== null) window.clearTimeout(countdown.timer);
      active.delete(key);
    });

    due.forEach(({ id, delay }, key) => {
      const current = active.get(key) ?? { timer: null, remainingMs: delay, startedAt: now };
      const expire = () => {
        active.delete(key);
        dispatch({ type: "dismiss", id });
      };
      active.set(key, isPaused ? pauseCountdown(current, now) : resumeCountdown(current, now, expire));
    });
  }, [toasts, isPaused, dispatch]);

  useEffect(() => {
    const active = countdowns.current;
    return () => {
      active.forEach((countdown) => {
        if (countdown.timer !== null) window.clearTimeout(countdown.timer);
      });
      active.clear();
    };
  }, []);
}
