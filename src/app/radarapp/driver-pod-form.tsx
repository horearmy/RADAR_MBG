"use client";

import { useEffect, useRef, useState } from "react";
import { submitTripDelivery, uploadTripProof, type DeliverySubmitResult, type TripDetail, type TripSummary } from "@/lib/api";
import { FIELD_STORAGE_PREFIX } from "@/lib/field-api";
import { safeErrorMessage, tripReference } from "@/lib/field-status";
import { Banner } from "@/components/field-ui";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_QTY = 100_000;

type Draft = { received: string; damaged: string; receiver: string; reason: string; note: string };
const EMPTY_DRAFT: Draft = { received: "", damaged: "0", receiver: "", reason: "", note: "" };

function loadDraft(tripId: string): Draft {
  try {
    const raw = window.localStorage.getItem(`${FIELD_STORAGE_PREFIX}pod_draft_${tripId}`);
    return raw ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) } : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT;
  }
}

export function PodForm({
  trip,
  detail,
  online,
  onClose,
  onSubmitted,
  onUnauthenticated,
}: {
  trip: TripSummary;
  detail: TripDetail | null;
  online: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  onUnauthenticated?: () => void;
}) {
  const record = detail?.deliveryRecords?.[0] ?? null;
  const dispatched = record?.dispatchedQuantity ?? trip.dispatchedQuantity;
  const isCorrection = trip.status === "DELIVERED" && record?.reviewStatus === "REJECTED";

  const [draft, setDraft] = useState<Draft>(() => loadDraft(trip.id));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [submitted, setSubmitted] = useState<DeliverySubmitResult | null>(null);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [done, setDone] = useState(false);
  const submitKey = useRef<string | null>(null);
  const uploadKey = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function update(patch: Partial<Draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    submitKey.current = null; // payload berubah → idempotency key baru
    try {
      window.localStorage.setItem(`${FIELD_STORAGE_PREFIX}pod_draft_${trip.id}`, JSON.stringify(next));
    } catch {
      // abaikan
    }
  }

  function onPickFile(picked: File | null) {
    uploadKey.current = null;
    if (preview) URL.revokeObjectURL(preview);
    if (!picked) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (!picked.type.startsWith("image/")) {
      setErrors((e) => ({ ...e, photo: "File harus berupa foto (JPG/PNG)." }));
      return;
    }
    if (picked.size > MAX_PHOTO_BYTES) {
      setErrors((e) => ({ ...e, photo: "Ukuran foto maksimal 10 MB." }));
      return;
    }
    setErrors((e) => {
      const { photo: _removed, ...rest } = e;
      void _removed;
      return rest;
    });
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    const received = Number(draft.received);
    const damaged = Number(draft.damaged);
    if (draft.received.trim() === "" || !Number.isSafeInteger(received) || received < 0 || received > MAX_QTY) {
      next.received = "Isi jumlah diserahkan berupa bilangan bulat 0 atau lebih.";
    }
    if (draft.damaged.trim() === "" || !Number.isSafeInteger(damaged) || damaged < 0 || damaged > MAX_QTY) {
      next.damaged = "Isi jumlah rusak berupa bilangan bulat 0 atau lebih.";
    }
    if (dispatched === null || dispatched === undefined) {
      next.received = "Jumlah porsi yang dikirim belum tersedia dari server. Muat ulang lalu coba lagi.";
    } else if (!next.received && !next.damaged && received + damaged > dispatched) {
      next.received = `Jumlah diserahkan + rusak tidak boleh melebihi ${dispatched} porsi yang dikirim.`;
    }
    if (dispatched !== null && dispatched !== undefined && !next.received && !next.damaged) {
      const variance = received + damaged < dispatched || damaged > 0;
      if ((variance || isCorrection) && draft.reason.trim().length < 3) {
        next.reason = isCorrection
          ? "Isi alasan koreksi (minimal 3 karakter)."
          : "Ada selisih/barang rusak. Isi alasan (minimal 3 karakter).";
      }
    }
    if (draft.receiver.trim().length < 2) next.receiver = "Isi nama penerima di lokasi.";
    if (!file && !submitted) next.photo = "Foto bukti serah terima wajib diambil.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function doUpload(recordTripId: string, photo: File) {
    setStep(2);
    uploadKey.current ??= crypto.randomUUID();
    try {
      await uploadTripProof(recordTripId, photo, uploadKey.current);
      setUploadFailed(false);
      setDone(true);
      try {
        window.localStorage.removeItem(`${FIELD_STORAGE_PREFIX}pod_draft_${trip.id}`);
      } catch {
        // abaikan
      }
      onSubmitted();
    } catch (error) {
      setUploadFailed(true);
      setFormError(`POD sudah diterima server, tetapi foto belum terunggah. ${safeErrorMessage(error)}`);
    }
  }

  async function submit() {
    if (busy) return;
    setFormError("");
    if (!online) {
      setFormError("Anda sedang offline. POD belum dapat dikirim; draft tersimpan di perangkat. Foto perlu dipilih ulang setelah online.");
      return;
    }
    if (submitted) {
      // Retry upload foto saja; POD sudah tercatat di server.
      if (file) {
        setBusy(true);
        await doUpload(trip.id, file);
        setBusy(false);
      }
      return;
    }
    if (!validate() || !file) return;

    setBusy(true);
    setStep(1);
    submitKey.current ??= crypto.randomUUID();
    try {
      const receiverNote = `Penerima di lokasi: ${draft.receiver.trim()}.`;
      const note = draft.note.trim() ? `${receiverNote} ${draft.note.trim()}` : receiverNote;
      const result = await submitTripDelivery(
        trip.id,
        {
          receivedQuantity: Number(draft.received),
          damagedQuantity: Number(draft.damaged),
          varianceReason: draft.reason.trim() || undefined,
          confirmationNote: note,
          deviceTimestamp: new Date().toISOString(),
        },
        submitKey.current,
      );
      setSubmitted(result);
      await doUpload(trip.id, file);
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        onUnauthenticated?.();
        return;
      }
      setStep(0);
      setFormError(safeErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (done && submitted) {
    return (
      <div className="field-stack">
        <Banner tone="success" title="POD diterima server">
          Referensi POD: <strong>POD-{submitted.deliveryRecordId.slice(0, 8).toUpperCase()}</strong>
          <br />
          Status: Menunggu verifikasi penerima.
        </Banner>
        <button type="button" className="field-btn field-btn-block" data-variant="primary" onClick={onClose}>
          Selesai
        </button>
      </div>
    );
  }

  return (
    <form
      className="field-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="field-caption" style={{ margin: 0 }}>
        {tripReference(trip.id)} · {trip.deliveryLocation.name}
      </p>
      {isCorrection && record?.reviewReason && (
        <Banner tone="warning" title="POD sebelumnya ditolak">
          {record.reviewReason}
        </Banner>
      )}
      {!online && (
        <Banner tone="warning" title="Offline">
          POD tidak dapat dikirim saat offline dan tidak ditandai berhasil. Draft isian tersimpan di perangkat.
        </Banner>
      )}

      <div className="field-field">
        <span>Lokasi / stop</span>
        <input value={`${trip.deliveryLocation.name}`} readOnly aria-readonly="true" />
        <small className="field-hint">
          Jumlah yang dikirim: {dispatched ?? "belum tersedia"} porsi (rencana {trip.plannedQuantity})
        </small>
      </div>

      <label className="field-field" data-invalid={Boolean(errors.received)}>
        <span>Jumlah porsi diserahkan</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={draft.received}
          onChange={(e) => update({ received: e.target.value })}
          aria-invalid={Boolean(errors.received)}
          aria-describedby={errors.received ? "pod-received-err" : undefined}
          disabled={busy || Boolean(submitted)}
        />
        {errors.received && <span id="pod-received-err" className="field-error-text">{errors.received}</span>}
      </label>

      <label className="field-field" data-invalid={Boolean(errors.damaged)}>
        <span>Jumlah porsi rusak</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={draft.damaged}
          onChange={(e) => update({ damaged: e.target.value })}
          aria-invalid={Boolean(errors.damaged)}
          aria-describedby={errors.damaged ? "pod-damaged-err" : undefined}
          disabled={busy || Boolean(submitted)}
        />
        {errors.damaged && <span id="pod-damaged-err" className="field-error-text">{errors.damaged}</span>}
      </label>

      <label className="field-field" data-invalid={Boolean(errors.receiver)}>
        <span>Nama penerima di lokasi</span>
        <input
          type="text"
          value={draft.receiver}
          onChange={(e) => update({ receiver: e.target.value })}
          autoComplete="off"
          aria-invalid={Boolean(errors.receiver)}
          aria-describedby={errors.receiver ? "pod-receiver-err" : undefined}
          disabled={busy || Boolean(submitted)}
        />
        {errors.receiver && <span id="pod-receiver-err" className="field-error-text">{errors.receiver}</span>}
      </label>

      <label className="field-field" data-invalid={Boolean(errors.reason)}>
        <span>Alasan selisih / rusak / koreksi</span>
        <input
          type="text"
          value={draft.reason}
          onChange={(e) => update({ reason: e.target.value })}
          aria-invalid={Boolean(errors.reason)}
          aria-describedby={errors.reason ? "pod-reason-err" : undefined}
          disabled={busy || Boolean(submitted)}
        />
        {errors.reason && <span id="pod-reason-err" className="field-error-text">{errors.reason}</span>}
      </label>

      <label className="field-field">
        <span>Catatan (opsional)</span>
        <textarea value={draft.note} onChange={(e) => update({ note: e.target.value })} disabled={busy || Boolean(submitted)} />
      </label>

      <div className="field-field" data-invalid={Boolean(errors.photo)}>
        <label htmlFor="pod-photo">
          <span style={{ fontWeight: 600 }}>Foto bukti serah terima</span>
        </label>
        <input
          id="pod-photo"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          aria-invalid={Boolean(errors.photo)}
          aria-describedby={errors.photo ? "pod-photo-err" : undefined}
          disabled={busy}
        />
        {errors.photo && <span id="pod-photo-err" className="field-error-text">{errors.photo}</span>}
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="field-photo" src={preview} alt="Pratinjau foto bukti serah terima" />
        )}
      </div>

      {busy && (
        <div>
          <div className="field-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={step === 1 ? 50 : 90}>
            <div style={{ width: step === 1 ? "50%" : "90%" }} />
          </div>
          <small className="field-hint">{step === 1 ? "Mengirim data POD (1/2)..." : "Mengunggah foto bukti (2/2)..."}</small>
        </div>
      )}

      {formError && <Banner tone="danger">{formError}</Banner>}

      <div className="field-actions">
        <button type="button" className="field-btn" onClick={onClose} disabled={busy}>
          Tutup
        </button>
        <button type="submit" className="field-btn" data-variant="primary" disabled={busy || !online}>
          {busy ? "Mengirim..." : uploadFailed ? "Coba Unggah Foto Lagi" : "Kirim POD"}
        </button>
      </div>
    </form>
  );
}
