"use client";

import { Upload } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/cn";

type FileDropZoneProps = {
  label: string;
  hint: string;
  accept: string;
  isMultiple?: boolean;
  isDisabled?: boolean;
  onFiles: (files: File[]) => void;
};

/** Dépôt de fichiers par glisser-déposer, ou par le sélecteur du système (clavier compris). */
export function FileDropZone({ label, hint, accept, isMultiple = false, isDisabled = false, onFiles }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const hintId = useId();

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (isDisabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(isMultiple ? files : files.slice(0, 1));
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!isDisabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center",
        "transition duration-hover ease-standard",
        isDragging ? "border-accent bg-accent-soft shadow-halo" : "border-border bg-surface/40 hover:border-glow",
        isDisabled && "pointer-events-none opacity-60",
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-elevated text-link shadow-raised">
        <Upload aria-hidden className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-describedby={hintId}
          disabled={isDisabled}
          className="text-sm font-medium text-fg after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none after:focus-visible:ring-3 after:focus-visible:ring-accent/40"
        >
          {label}
        </button>
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={isMultiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
    </div>
  );
}
