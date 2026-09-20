import { useCallback, useEffect, useRef, useState } from "react";
import type { ReliaLoaderState } from "@/components/brand/ReliaLoader";

export type TaskPhase = "idle" | ReliaLoaderState;

type SimulatedTaskOptions = {
  durationMs: number;
  initialPhase?: TaskPhase;
  /** Retour à « idle » après le succès (boutons) ; absent : le succès reste affiché. */
  resetAfterMs?: number;
};

/** Simule une tâche asynchrone pour la démonstration : chargement, puis succès. */
export function useSimulatedTask({ durationMs, initialPhase = "idle", resetAfterMs }: SimulatedTaskOptions) {
  const [phase, setPhase] = useState<TaskPhase>(initialPhase);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const set = useCallback(
    (next: TaskPhase) => {
      clearTimers();
      setPhase(next);
    },
    [clearTimers],
  );

  const start = useCallback(() => {
    set("loading");
    const toSuccess = window.setTimeout(() => setPhase("success"), durationMs);
    const toIdle =
      resetAfterMs === undefined ? [] : [window.setTimeout(() => setPhase("idle"), durationMs + resetAfterMs)];
    timers.current = [toSuccess, ...toIdle];
  }, [durationMs, resetAfterMs, set]);

  return { phase, start, set };
}
