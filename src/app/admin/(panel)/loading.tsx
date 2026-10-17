export default function AdminLoading() {
  return (
    <div aria-busy aria-label="Loading">
      <div className="skeleton h-8 w-56" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-28 rounded-[var(--radius-xl)]" />)}
      </div>
      <div className="skeleton mt-6 h-80 rounded-[var(--radius-xl)]" />
    </div>
  );
}
