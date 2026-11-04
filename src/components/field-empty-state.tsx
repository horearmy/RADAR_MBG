export default function FieldEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{ textAlign: "center", padding: 24 }}>
      <strong>{title}</strong>
      {description && <p style={{ color: "#718096" }}>{description}</p>}
    </div>
  );
}