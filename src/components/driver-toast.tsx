"use client";

import { useEffect } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

export type DriverToastTone = "success" | "warning" | "error" | "info";

export function DriverToast({
  tone,
  message,
  onClose,
}: {
  tone: DriverToastTone;
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 3200);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? TriangleAlert : Info;

  return (
    <div className={`driver-toast driver-toast-${tone}`} role="status" aria-live="polite">
      <Icon size={18} />
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Tutup notifikasi">
        <X size={16} />
      </button>
    </div>
  );
}
