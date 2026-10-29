"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function DriverBottomSheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="driver-sheet-backdrop" onClick={onClose}>
      <div className="driver-sheet" ref={ref} onClick={(event) => event.stopPropagation()}>
        <div className="driver-sheet-handle" />
        <header className="driver-sheet-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </header>
        <div className="driver-sheet-body">{children}</div>
      </div>
    </div>
  );
}
