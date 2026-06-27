import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileText, LogIn, Send, Upload, UserPlus } from 'lucide-react';
import AuthPanel from '../components/AuthPanel.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { api, login, openFile } from '../services/api.js';

const localDateTime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

export default function StudentPage({ user, onBack, onAuth }) {
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ dateTime: localDateTime() });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState(null);
  const [viewerUrl, setViewerUrl] = useState('');

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const loadProfile = async () => {
    if (!user) return;
    const payload = await api('/student/profile');
    setProfile(payload);
  };

  useEffect(() => {
    loadProfile().catch((err) => setError(err.message));
  }, [user]);

  useEffect(() => {
    if (!user || profile?.submission) return undefined;
    const updateSubmissionTime = () => {
      setForm((current) => ({ ...current, dateTime: localDateTime() }));
    };
    updateSubmissionTime();
    const timer = window.setInterval(updateSubmissionTime, 30_000);
    return () => window.clearInterval(timer);
  }, [user, profile?.submission]);

  const submitRegistration = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const payload = await api('/auth/student/register', {
        method: 'POST',
        body: {
          fullName: form.fullName,
          indexNumber: form.indexNumber,
          password: form.password
        }
      });
      setMessage(payload.message);
      setForm({ dateTime: localDateTime() });
    } catch (err) {
      setError(err.message);
    }
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const nextUser = await login('/auth/student/login', {
        indexNumber: form.indexNumber,
        password: form.password
      });
      onAuth(nextUser);
    } catch (err) {
      setError(err.message);
    }
  };

  const submitCareStudy = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const data = new FormData();
      data.append('dateTime', localDateTime());
      data.append('pdf', form.pdf);
      await api('/student/submission', { method: 'POST', body: data });
      setMessage('Care study submitted successfully.');
      setForm((current) => ({ ...current, pdf: null }));
      await loadProfile();
    } catch (err) {
      setError(err.message);
    }
  };

  const submissionBlocked = useMemo(() => {
    if (!profile) return true;
    return !profile.permissions.canSubmit;
  }, [profile]);

  if (!user) {
    return (
      <main className="auth-page">
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={18} />
          Back
        </button>
        <div className="tab-row">
          <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>Login</button>
          <button className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>Register</button>
        </div>

        {tab === 'register' && (
          <AuthPanel title="Student Registration" error={error} message={message}>
            <form onSubmit={submitRegistration} className="form-grid">
              <label>
                Full name
                <input value={form.fullName || ''} onChange={(event) => update('fullName', event.target.value)} required />
              </label>
              <label>
                Index number
                <input value={form.indexNumber || ''} onChange={(event) => update('indexNumber', event.target.value)} required />
              </label>
              <label>
                Password
                <input type="password" value={form.password || ''} onChange={(event) => update('password', event.target.value)} required />
              </label>
              <button className="primary" type="submit">
                <UserPlus size={18} />
                Register
              </button>
            </form>
          </AuthPanel>
        )}

        {tab === 'login' && (
          <AuthPanel title="Student Login" error={error}>
            <form onSubmit={submitLogin} className="form-grid">
              <label>
                Index number
                <input value={form.indexNumber || ''} onChange={(event) => update('indexNumber', event.target.value)} required />
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

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div>
          <h1>Submission of Care Study</h1>
          <p>{profile?.settings?.notice}</p>
        </div>
        <StatusPill value={profile?.student?.account_status} />
      </div>

      {message && <p className="notice success">{message}</p>}
      {error && <p className="notice error">{error}</p>}

      <section className="panel">
        <div className="form-grid two">
          <label>
            Supervisor
            <input value={profile?.student?.supervisor_name || 'Not assigned'} readOnly />
          </label>
          <label>
            Date and time
            <input
              type="datetime-local"
              value={form.dateTime}
              disabled
              aria-readonly="true"
            />
          </label>
        </div>

        {profile?.submission ? (
          <div className="submitted-file">
            <FileText size={20} />
            <span>
              <strong>{profile.submission.original_name}</strong>
              <small>Submitted {new Date(profile.submission.submitted_at).toLocaleString()}</small>
            </span>
            {profile.permissions.canViewOwnPdf && (
              <button className="secondary" onClick={async () => setViewerUrl(await openFile(profile.submission.file_id, 'view'))}>
                Open
              </button>
            )}
          </div>
        ) : null}

        <form onSubmit={submitCareStudy} className="upload-row">
          <label className="file-input">
            <Upload size={18} />
            <span>{form.pdf?.name || 'Attach PDF file'}</span>
            <input
              type="file"
              accept="application/pdf"
              disabled={submissionBlocked}
              onChange={(event) => update('pdf', event.target.files[0])}
              required={!submissionBlocked}
            />
          </label>
          <button className="primary" type="submit" disabled={submissionBlocked || !form.pdf}>
            <Send size={18} />
            Submit
          </button>
        </form>
      </section>

      {viewerUrl && (
        <section className="panel pdf-panel">
          <iframe title="Submitted care study PDF" src={viewerUrl} />
        </section>
      )}
    </section>
  );
}
