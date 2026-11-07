export default function Loading() {
  return (
    <main className="session-state" aria-busy="true" aria-live="polite">
      <span className="session-spinner" />
      <p>Memuat halaman…</p>
    </main>
  );
}
