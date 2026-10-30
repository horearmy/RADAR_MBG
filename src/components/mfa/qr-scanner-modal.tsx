"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Upload, X, AlertCircle } from "lucide-react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";

type QrScannerModalProps = {
  open: boolean;
  onClose: () => void;
  onScanned: (decodedText: string) => void;
};

export function QrScannerModal({ open, onClose, onScanned }: QrScannerModalProps) {
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerId = "mfa-qr-scanner";

  useEffect(() => {
    if (!open) {
      stopScanner();
      setError("");
      setHasPermission(null);
      setScanning(false);
      return;
    }

    startScanner();

    return () => {
      stopScanner();
    };
  }, [open]);

  async function startScanner() {
    try {
      setError("");
      setScanning(true);

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerId);
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          onScanned(decodedText);
          onClose();
        },
        () => {
          // Ignore scan errors
        }
      );

      setHasPermission(true);
    } catch (err: any) {
      setScanning(false);
      setHasPermission(false);
      if (err?.name === "NotAllowedError") {
        setError("Izin kamera ditolak. Silakan izinkan akses kamera atau gunakan upload gambar QR.");
      } else if (err?.name === "NotFoundError") {
        setError("Kamera tidak ditemukan. Gunakan upload gambar QR sebagai alternatif.");
      } else {
        setError("Gagal mengakses kamera. Gunakan upload gambar QR sebagai alternatif.");
      }
    }
  }

  async function stopScanner() {
    try {
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      }
    } catch (err) {
      // Ignore stop errors
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError("");
      setScanning(false);

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerId);
      }

      const result = await scannerRef.current.scanFile(file, true);
      onScanned(result);
      onClose();
    } catch (err) {
      setError("Gagal membaca QR dari gambar. Pastikan gambar berisi QR code yang valid.");
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleClose() {
    stopScanner();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Pindai QR Code MFA</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4">
          <div className="mb-4">
            <div
              id={scannerId}
              className="mx-auto w-full overflow-hidden rounded-lg"
              style={{ minHeight: "250px" }}
            />
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {scanning && !error && (
            <p className="mb-4 text-center text-sm text-gray-600">
              Arahkan kamera ke QR code otpauth://
            </p>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Upload size={18} />
              Upload Gambar QR
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
