"use client";

import { useEffect, useRef, useState } from "react";

function extractCode(raw: string): string | null {
  try {
    const url = new URL(raw);
    const c = url.searchParams.get("code");
    if (c) return c;
  } catch {
    // not a URL
  }
  const trimmed = raw.trim();
  if (/^[A-Za-z0-9-]{4,64}$/.test(trimmed)) return trimmed;
  return null;
}

export function QrScanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean>(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!("BarcodeDetector" in window)) {
      setSupported(false);
      return;
    }
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        const loop = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const code = extractCode(barcodes[0].rawValue || "");
              if (code) {
                onScan(code);
                return;
              }
            }
          } catch {
            // ignore frame errors
          }
          if (!cancelled) requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      } catch {
        setError("Tidak dapat mengakses kamera. Gunakan upload foto QR.");
        setSupported(false);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-file-reader");
      const decoded = await scanner.scanFile(file, true);
      const code = extractCode(decoded);
      if (code) onScan(code);
      else setError("QR tidak terbaca. Coba foto lain.");
    } catch {
      setError("Gagal membaca foto. Pastikan QR terlihat jelas.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="field-card" style={{ display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>Scan QR Pendaftaran</h3>
      {supported ? (
        <>
          <video ref={videoRef} style={{ width: "100%", borderRadius: 12, background: "#000" }} playsInline muted />
          <p className="field-caption" style={{ margin: 0 }}>Arahkan kamera ke QR code pendaftaran.</p>
        </>
      ) : (
        <p className="field-caption">Kamera tidak tersedia. Upload foto QR.</p>
      )}
      {error && <p className="field-error-text">{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <label className="field-btn" style={{ flex: 1, justifyContent: "center" }}>
          {scanning ? "Membaca..." : "Upload foto QR"}
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} disabled={scanning} />
        </label>
        <button type="button" className="field-btn" onClick={onClose}>Tutup</button>
      </div>
      <div id="qr-file-reader" style={{ display: "none" }} />
    </div>
  );
}
