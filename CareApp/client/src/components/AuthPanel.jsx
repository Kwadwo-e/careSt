import { AlertCircle } from 'lucide-react';

export default function AuthPanel({ title, children, error, message }) {
  return (
    <section className="panel auth-panel">
      <h2>{title}</h2>
      {message && <p className="notice success">{message}</p>}
      {error && (
        <p className="notice error">
          <AlertCircle size={16} />
          {error}
        </p>
      )}
      {children}
    </section>
  );
}
