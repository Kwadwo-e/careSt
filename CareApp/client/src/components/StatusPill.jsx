export default function StatusPill({ value }) {
  const normalized = String(value || 'none').toLowerCase();
  return <span className={`status-pill ${normalized}`}>{value || 'none'}</span>;
}
