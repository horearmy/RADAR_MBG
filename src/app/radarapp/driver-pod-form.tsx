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

const STEPS = [
  { key: "photo", label: "Foto Bukti", icon: "📷" },
  { key: "quantity", label: "Jumlah", icon: "📦" },
  { key: "receiver", label: "Penerima", icon: "👤" },
  { key: "review", label: "Review", icon: "✓" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

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
  const [step, setStep] = useState<StepKey>("photo");
  const [submitted, setSubmitted] = useState<DeliverySubmitResult | null>(null);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [done, setDone] = useState(false);
  const [podStage, setPodStage] = useState<"idle" | "submitting" | "uploading" | "done">("idle");
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
    submitKey.current = null;
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

  function quickFill(kind: "all" | "partial" | "damaged") {
    if (dispatched === null || dispatched === undefined) return;
    if (kind === "all") {
      update({ received: String(dispatched), damaged: "0", reason: "", receiver: draft.receiver || "Penerima di lokasi" });
    } else if (kind === "partial") {
      update({ received: String(Math.max(0, dispatched - 1)), damaged: "0", reason: "Sebagian porsi tidak diterima" });
    } else {
      update({ received: String(Math.max(0, dispatched - 1)), damaged: "1", reason: "Ada porsi rusak" });
    }
  }

  function validate(currentStep: StepKey): boolean {
    const next: Record<string, string> = {};
    if (currentStep === "photo" && !file && !submitted) {
      next.photo = "Foto bukti serah terima wajib diambil.";
    }
    if (currentStep === "quantity") {
      const received = Number(draft.received);
      const damaged = Number(draft.damaged);
      if (draft.received.trim() === "" || !Number.isSafeInteger(received) || received < 0 || received > MAX_QTY) {
        next.received = "Isi jumlah diserahkan berupa bilangan bulat 0 atau lebih.";
      }
      if (draft.damaged.trim() === "" || !Number.isSafeInteger(damaged) || damaged < 0 || damaged > MAX_QTY) {
        next.damaged = "Isi jumlah rusak berupa bilangan bulat 0 atau lebih.";
      }
      if (dispatched === null || dispatched === undefined) {
        next.received = "Jumlah porsi yang dikirim belum tersedia dari server.";
      } else if (!next.received && !next.damaged && received + damaged > dispatched) {
        next.received = `Jumlah diserahkan + rusak tidak boleh melebihi ${dispatched} porsi.`;
      }
    }
    if (currentStep === "receiver") {
      if (draft.receiver.trim().length < 2) next.receiver = "Isi nama penerima di lokasi.";
      if (dispatched !== null && dispatched !== undefined) {
        const received = Number(draft.received);
        const damaged = Number(draft.damaged);
        const variance = received + damaged < dispatched || damaged > 0;
        if ((variance || isCorrection) && draft.reason.trim().length < 3) {
          next.reason = isCorrection ? "Isi alasan koreksi (minimal 3 karakter)." : "Ada selisih/barang rusak. Isi alasan (minimal 3 karakter).";
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function nextStep() {
    const order: StepKey[] = ["photo", "quantity", "receiver", "review"];
    const idx = order.indexOf(step);
    if (idx < order.length - 1) {
      if (validate(step)) {
        setStep(order[idx + 1]);
      }
    }
  }

  function prevStep() {
    const order: StepKey[] = ["photo", "quantity", "receiver", "review"];
    const idx = order.indexOf(step);
    if (idx > 0) {
      setStep(order[idx - 1]);
    }
  }

  async function doUpload(recordTripId: string, photo: File) {
    uploadKey.current ??= crypto.randomUUID();
    setPodStage("uploading");
    try {
      await uploadTripProof(recordTripId, photo, uploadKey.current);
      setUploadFailed(false);
      setDone(true);
      setPodStage("done");
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
      setFormError("Anda sedang offline. POD belum dapat dikirim; draft tersimpan di perangkat.");
      return;
    }
    if (!validate("review")) return;
    if (!file && !submitted) {
      setStep("photo");
      setErrors((e) => ({ ...e, photo: "Foto bukti serah terima wajib diambil." }));
      return;
    }

    setBusy(true);
    submitKey.current ??= crypto.randomUUID();
    setPodStage("submitting");
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
      if (file) {
        setPodStage("uploading");
        await doUpload(trip.id, file);
      } else {
        setPodStage("done");
        setDone(true);
        onSubmitted();
      }
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHENTICATED") {
        onUnauthenticated?.();
        return;
      }
      setFormError(safeErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (done && submitted) {
    return (
      <div className="field-stack">
        <div className="pod-success">
          <div className="pod-success-icon">✓</div>
          <h3>POD Berhasil Dikirim</h3>
          <p className="pod-success-ref">POD-{submitted.deliveryRecordId.slice(0, 8).toUpperCase()}</p>
          <p className="field-caption">Status: Menunggu verifikasi penerima</p>
        </div>
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
        if (step === "review") {
          void submit();
        } else {
          nextStep();
        }
      }}
    >
      <p className="field-caption" style={{ margin: 0 }}>
        {tripReference(trip.id)} · {trip.deliveryLocation.name}
      </p>

      {/* Step Indicator */}
      <div className="pod-steps">
        {STEPS.map((s, i) => (
          <div key={s.key} className={`pod-step ${step === s.key ? "active" : ""} ${i < STEPS.findIndex((x) => x.key === step) ? "done" : ""}`} aria-current={step === s.key ? "step" : undefined}>
            <span className="pod-step-icon">{s.icon}</span>
            <span className="pod-step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {isCorrection && record?.reviewReason && (
        <Banner tone="warning" title="POD sebelumnya ditolak">
          {record.reviewReason}
        </Banner>
      )}
      {!online && (
        <Banner tone="warning" title="Offline">
          POD tidak dapat dikirim saat offline. Draft isian tersimpan di perangkat.
        </Banner>
      )}

      {/* Step: Photo */}
      {step === "photo" && (
        <div className="field-field" data-invalid={Boolean(errors.photo)}>
          <span style={{ fontWeight: 600 }}>Foto bukti serah terima</span>
          <p className="field-hint">Ambil foto paket/kotak yang diserahkan sebagai bukti.</p>
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
      )}

      {/* Step: Quantity */}
      {step === "quantity" && (
        <>
          <div className="pod-quick-actions">
            <span className="field-hint" style={{ width: "100%" }}>Quick fill:</span>
            <button type="button" className="field-chip" onClick={() => quickFill("all")} disabled={busy}>
              ✓ Semua terkirim
            </button>
            <button type="button" className="field-chip" onClick={() => quickFill("partial")} disabled={busy}>
              ⚠ Sebagian tidak diterima
            </button>
            <button type="button" className="field-chip" onClick={() => quickFill("damaged")} disabled={busy}>
              ✕ Ada rusak
            </button>
          </div>

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
        </>
      )}

      {/* Step: Receiver */}
      {step === "receiver" && (
        <>
          <label className="field-field" data-invalid={Boolean(errors.receiver)}>
            <span>Nama penerima di lokasi</span>
            <input
              type="text"
              value={draft.receiver}
              onChange={(e) => update({ receiver: e.target.value })}
              autoComplete="off"
              placeholder="Nama penerima"
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
              placeholder="Isi jika ada selisih atau rusak"
              aria-invalid={Boolean(errors.reason)}
              aria-describedby={errors.reason ? "pod-reason-err" : undefined}
              disabled={busy || Boolean(submitted)}
            />
            {errors.reason && <span id="pod-reason-err" className="field-error-text">{errors.reason}</span>}
          </label>

          <label className="field-field">
            <span>Catatan (opsional)</span>
            <textarea value={draft.note} onChange={(e) => update({ note: e.target.value })} disabled={busy || Boolean(submitted)} placeholder="Catatan tambahan untuk penerima" />
          </label>
        </>
      )}

      {/* Step: Review */}
      {step === "review" && (
        <div className="pod-review">
          <h4 className="pod-review-title">Review POD</h4>
          <dl className="pod-review-list">
            <div>
              <dt>Perjalanan</dt>
              <dd>{tripReference(trip.id)}</dd>
            </div>
            <div>
              <dt>Lokasi</dt>
              <dd>{trip.deliveryLocation.name}</dd>
            </div>
            <div>
              <dt>Jumlah diserahkan</dt>
              <dd>{draft.received} porsi</dd>
            </div>
            <div>
              <dt>Jumlah rusak</dt>
              <dd>{draft.damaged} porsi</dd>
            </div>
            <div>
              <dt>Penerima</dt>
              <dd>{draft.receiver || "-"}</dd>
            </div>
            {draft.reason && (
              <div>
                <dt>Alasan</dt>
                <dd>{draft.reason}</dd>
              </div>
            )}
            {draft.note && (
              <div>
                <dt>Catatan</dt>
                <dd>{draft.note}</dd>
              </div>
            )}
            <div>
              <dt>Foto</dt>
              <dd>{file ? "✓ Terlampir" : "✗ Tidak ada"}</dd>
            </div>
          </dl>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="field-photo pod-review-photo" src={preview} alt="Pratinjau foto bukti serah terima" />
          )}
        </div>
      )}

       {busy && (
         <div>
           <div className="field-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuetext={podStage === "submitting" ? "Mengirim data POD" : podStage === "uploading" ? "Mengunggah foto" : "Menyelesaikan"}>
             <div style={{ width: podStage === "submitting" ? "35%" : podStage === "uploading" ? "75%" : "95%" }} />
           </div>
           <small className="field-hint">
             {podStage === "submitting"
               ? "Mengirim data POD ke server..."
               : podStage === "uploading"
                 ? "Mengunggah foto bukti..."
                 : "Menyelesaikan pengiriman..."}
           </small>
         </div>
       )}

      {formError && <Banner tone="danger">{formError}</Banner>}

       {uploadFailed && submitted && file && (
         <button type="button" className="field-btn field-btn-block" data-variant="primary" onClick={() => void doUpload(trip.id, file)} disabled={busy || !online}>
           Coba unggah foto lagi
         </button>
       )}

      <div className="field-actions">
        {step !== "photo" ? (
          <button type="button" className="field-btn" onClick={prevStep} disabled={busy}>
            Kembali
          </button>
        ) : (
          <button type="button" className="field-btn" onClick={onClose} disabled={busy}>
            Tutup
          </button>
        )}
        <button type="submit" className="field-btn" data-variant="primary" disabled={busy || !online}>
          {busy ? "Mengirim..." : step === "review" ? "Kirim POD" : "Lanjut"}
        </button>
      </div>
    </form>
  );
}
