import { useState } from 'react';
import { ArrowLeft, LogIn, UserPlus } from 'lucide-react';
import AuthPanel from '../components/AuthPanel.jsx';
import { api, login } from '../services/api.js';

export default function AcademicPage({ onBack, onAuth }) {
  const [tab, setTab] = useState('supervisor-login');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({});

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submitSupervisorRegistration = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const payload = await api('/auth/supervisor/register', {
        method: 'POST',
        body: {
          fullName: form.fullName,
          password: form.password,
          groupCode: form.groupCode
        }
      });
      setMessage(`${payload.message} Group code: ${payload.supervisor.group_code}`);
      setForm({});
    } catch (err) {
      setError(err.message);
    }
  };

  const submitSupervisorLogin = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const user = await login('/auth/supervisor/login', {
        fullName: form.fullName,
        password: form.password
      });
      onAuth(user);
    } catch (err) {
      setError(err.message);
    }
  };

  const submitAdminLogin = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const user = await login('/auth/admin/login', {
        username: form.username,
        password: form.password
      });
      onAuth(user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="auth-page">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={18} />
        Back
      </button>
      <div className="tab-row">
        <button className={tab === 'supervisor-login' ? 'active' : ''} onClick={() => setTab('supervisor-login')}>
          Supervisor Login
        </button>
        <button className={tab === 'supervisor-register' ? 'active' : ''} onClick={() => setTab('supervisor-register')}>
          Supervisor Register
        </button>
        <button className={tab === 'admin-login' ? 'active' : ''} onClick={() => setTab('admin-login')}>
          Super Admin
        </button>
      </div>

      {tab === 'supervisor-register' && (
        <AuthPanel title="Supervisor Registration" error={error} message={message}>
          <form onSubmit={submitSupervisorRegistration} className="form-grid">
            <label>
              Full name
              <input value={form.fullName || ''} onChange={(event) => update('fullName', event.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={form.password || ''} onChange={(event) => update('password', event.target.value)} required />
            </label>
            <label>
              Group code
              <input value={form.groupCode || ''} onChange={(event) => update('groupCode', event.target.value)} placeholder="Optional" />
            </label>
            <button className="primary" type="submit">
              <UserPlus size={18} />
              Register
            </button>
          </form>
        </AuthPanel>
      )}

      {tab === 'supervisor-login' && (
        <AuthPanel title="Supervisor Login" error={error}>
          <form onSubmit={submitSupervisorLogin} className="form-grid">
            <label>
              Full name
              <input value={form.fullName || ''} onChange={(event) => update('fullName', event.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={form.password || ''} onChange={(event) => update('password', event.target.value)} required />
            </label>
            <button className="primary" type="submit">
              <LogIn size={18} />
              Log in
            </button>
          </form>
        </AuthPanel>
      )}

      {tab === 'admin-login' && (
        <AuthPanel title="Super Administrator Login" error={error}>
          <form onSubmit={submitAdminLogin} className="form-grid">
            <label>
              Username
              <input value={form.username || ''} onChange={(event) => update('username', event.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={form.password || ''} onChange={(event) => update('password', event.target.value)} required />
            </label>
            <button className="primary" type="submit">
              <LogIn size={18} />
              Log in
            </button>
          </form>
        </AuthPanel>
      )}
    </main>
  );
}
