"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type ModalSize = "sm" | "md" | "lg";

const SIZES: Record<ModalSize, string> = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

type ModalProps = {
  isOpen: boolean;
  /** Appelé une fois, quand le dialogue s'est fermé (croix, fond, Échap) : le parent passe isOpen à false. */
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  size?: ModalSize;
  children: ReactNode;
};

/**
 * Élément <dialog> natif en mode modal : focus piégé, arrière-plan inerte et touche Échap
 * gérés par le navigateur. Entrée et sortie animées en CSS (@starting-style) : fondu,
 * léger glissement vertical et échelle 0,98 → 1.
 */
export function Modal({ isOpen, onClose, title, description, footer, size = "md", children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Point de sortie unique : toute fermeture (croix, fond, Échap) passe par l'événement natif « close ».
  // L'écouteur est posé une fois et lit toujours le dernier onClose.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const notifyClose = () => onCloseRef.current();
    dialog.addEventListener("close", notifyClose);
    return () => dialog.removeEventListener("close", notifyClose);
  }, []);

  const requestClose = () => dialogRef.current?.close();

  // Le dialogue occupe tout l'écran sous son contenu : un clic qui l'atteint directement vient du fond.
  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) requestClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={handleBackdropClick}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-2xl border border-border bg-elevated p-0 text-fg shadow-raised",
        "translate-y-2 scale-[0.98] opacity-0 transition-[opacity,translate,scale,overlay,display] transition-discrete duration-enter ease-standard",
        "open:translate-y-0 open:scale-100 open:opacity-100",
        "starting:open:translate-y-2 starting:open:scale-[0.98] starting:open:opacity-0",
        "backdrop:bg-transparent backdrop:backdrop-blur-none backdrop:transition-all backdrop:transition-discrete backdrop:duration-enter",
        "open:backdrop:bg-canvas/70 open:backdrop:backdrop-blur-sm starting:open:backdrop:bg-transparent",
        SIZES[size],
      )}
    >
      <div className="flex flex-col gap-5 p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-fg-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Fermer"
            className="-m-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-muted transition duration-hover hover:bg-surface hover:text-fg"
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>
        <div>{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-3">{footer}</footer>}
      </div>
    </dialog>
  );
}
