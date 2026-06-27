import { Home, LogOut } from 'lucide-react';

export default function Layout({ user, children, onLogout, onHome }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-button" onClick={onHome} title="Home">
          <Home size={18} />
          <span>
            <strong>OWBRHE</strong>
            <small>Care Study Submission</small>
          </span>
        </button>
        <div className="session">
          <span>
            <strong>{user?.name}</strong>
            <small>{user?.role}</small>
          </span>
          <button className="icon-button" onClick={onLogout} title="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
