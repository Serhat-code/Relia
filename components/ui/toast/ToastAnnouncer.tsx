"use client";

import { useEffect, useRef } from "react";
import type { Toast } from "./toast-store";

const announcementKey = (toast: Toast) => `${toast.id}:${toast.tone}:${toast.title}`;
const announcementText = (toast: Toast) => [toast.title, toast.description].filter(Boolean).join(". ");

/**
 * Zones d'annonce persistantes (une polie, une en alerte pour les erreurs) : un changement de
 * contenu dans une zone déjà présente est annoncé de façon fiable, contrairement à une zone
 * insérée à la volée. Chaque notification n'est annoncée qu'une fois par état.
 */
export function ToastAnnouncer({ toasts }: { toasts: readonly Toast[] }) {
  const politeRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const announced = useRef<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const keys = toasts.map(announcementKey);
    const fresh = toasts.filter((toast) => !announced.current.has(announcementKey(toast)));
    announced.current = new Set(keys);

    const latest = fresh.at(-1);
    if (!latest) return;
    const region = latest.tone === "error" ? alertRef.current : politeRef.current;
    if (region) region.textContent = announcementText(latest);
  }, [toasts]);

  return (
    <>
      <div ref={politeRef} role="status" className="sr-only" />
      <div ref={alertRef} role="alert" className="sr-only" />
    </>
  );
}
