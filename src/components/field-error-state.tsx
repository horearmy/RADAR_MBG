export default function FieldErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: 24 }}>
      <strong style={{ color: "#DC2626" }}>Terjadi kesalahan</strong>
      <p style={{ color: "#718096" }}>{message}</p>
      {onRetry && <button type="button" onClick={onRetry}>Coba lagi</button>}
    </div>
  );
}