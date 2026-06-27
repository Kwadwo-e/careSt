import { useEffect, useMemo, useState } from 'react';
import { Check, Download, FileText, RefreshCcw, RotateCcw, Save, Trash2, UserCog, X } from 'lucide-react';
import StatusPill from '../components/StatusPill.jsx';
import { api, exportExcel, openFile } from '../services/api.js';

const blankSettings = {
  submissionsOpenAt: '',
  submissionsCloseAt: '',
  allowStudentFileView: false,
  allowGlobalResubmission: false,
  notice: ''
};

const toInputDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export default function AdminDashboard() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState({ students: [], supervisors: [] });
  const [settings, setSettings] = useState(blankSettings);
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [viewerUrl, setViewerUrl] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  const supervisorOptions = useMemo(
    () => users.supervisors.filter((item) => item.account_status === 'accepted' && !item.deleted_at),
    [users]
  );

  const load = async () => {
    setError('');
    const [userPayload, settingsPayload, filesPayload, logPayload] = await Promise.all([
      api(`/admin/users?includeDeleted=${showDeleted}`),
      api('/admin/settings'),
      api('/admin/files'),
      api('/admin/audit-logs')
    ]);
    setUsers(userPayload);
    setFiles(filesPayload.files);
    setLogs(logPayload.logs);
    setSettings({
      submissionsOpenAt: toInputDate(settingsPayload.settings.submissions_open_at),
      submissionsCloseAt: toInputDate(settingsPayload.settings.submissions_close_at),
      allowStudentFileView: settingsPayload.settings.allow_student_file_view,
      allowGlobalResubmission: settingsPayload.settings.allow_global_resubmission,
      notice: settingsPayload.settings.notice || ''
    });
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [showDeleted]);

  const setStatus = async (role, id, status) => {
    try {
      await api(`/admin/users/${role}/${id}/status`, {
        method: 'PATCH',
        body: { accountStatus: status }
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await api('/admin/settings', {
        method: 'PATCH',
        body: settings
      });
      setMessage('Settings saved.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveEditor = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await api(`/admin/users/${editor.role}/${editor.id}`, {
        method: 'PUT',
        body: {
          fullName: editor.fullName,
          indexNumber: editor.indexNumber,
          groupCode: editor.groupCode,
          password: editor.password,
          supervisorId: editor.supervisorId
        }
      });
      setEditor(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const setResubmission = async (student, allowed) => {
    try {
      await api(`/admin/students/${student.id}/resubmission`, {
        method: 'PATCH',
        body: { allowed }
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteUser = async (role, user) => {
    const label = role === 'student' ? `${user.full_name} (${user.index_number})` : `${user.full_name} (${user.group_code})`;
    const confirmed = window.confirm(`Delete ${label}? Uploaded PDF files and submission records will be retained.`);
    if (!confirmed) return;

    try {
      setError('');
      setMessage('');
      const payload = await api(`/admin/users/${role}/${user.id}`, { method: 'DELETE' });
      setMessage(payload.message || 'User deleted. Uploaded file records were retained.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const retainUser = async (role, user) => {
    try {
      setError('');
      setMessage('');
      const payload = await api(`/admin/users/${role}/${user.id}/restore`, { method: 'PATCH' });
      setMessage(payload.message || 'User retained in active records.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div>
          <h1>Super Administrator Dashboard</h1>
          <p>Manage users, settings, submissions, and activity records.</p>
        </div>
        <button className="secondary" onClick={() => load().catch((err) => setError(err.message))}>
          <RefreshCcw size={18} />
          Refresh
        </button>
      </div>

      <div className="tab-row compact">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users</button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Settings</button>
        <button className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}>Files</button>
        <button className={tab === 'logs' ? 'active' : ''} onClick={() => setTab('logs')}>Activity Log</button>
      </div>

      {message && <p className="notice success">{message}</p>}
      {error && <p className="notice error">{error}</p>}

      {tab === 'users' && (
        <section className="page-stack">
          <label className="check-row user-toggle">
            <input type="checkbox" checked={showDeleted} onChange={(event) => setShowDeleted(event.target.checked)} />
            Show deleted students and supervisors
          </label>

          {editor && (
            <section className="panel editor-panel">
              <div className="panel-heading">
                <h2>Edit User</h2>
                <button className="text-button" onClick={() => setEditor(null)}>Close</button>
              </div>
              <form className="form-grid three" onSubmit={saveEditor}>
                <label>
                  Full name
                  <input value={editor.fullName || ''} onChange={(event) => setEditor({ ...editor, fullName: event.target.value })} />
                </label>
                {editor.role === 'student' && (
                  <>
                    <label>
                      Index number
                      <input value={editor.indexNumber || ''} onChange={(event) => setEditor({ ...editor, indexNumber: event.target.value })} />
                    </label>
                    <label>
                      Supervisor
                      <select value={editor.supervisorId || ''} onChange={(event) => setEditor({ ...editor, supervisorId: event.target.value })}>
                        <option value="">Unassigned</option>
                        {supervisorOptions.map((supervisor) => (
                          <option key={supervisor.id} value={supervisor.id}>{supervisor.full_name}</option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {editor.role === 'supervisor' && (
                  <label>
                    Group code
                    <input value={editor.groupCode || ''} onChange={(event) => setEditor({ ...editor, groupCode: event.target.value })} />
                  </label>
                )}
                <label>
                  New password
                  <input type="password" value={editor.password || ''} onChange={(event) => setEditor({ ...editor, password: event.target.value })} placeholder="Leave blank to keep current" />
                </label>
                <button className="primary" type="submit">
                  <Save size={18} />
                  Save
                </button>
              </form>
            </section>
          )}

          <section className="panel">
            <h2>Students</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Index number</th>
                    <th>Supervisor</th>
                    <th>Account</th>
                    <th>Group</th>
                    <th>Record</th>
                    <th>Resubmit</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.students.map((student) => (
                    <tr key={student.id}>
                      <td>{student.full_name}</td>
                      <td>{student.index_number}</td>
                      <td>{student.supervisor_name || 'Unassigned'}</td>
                      <td><StatusPill value={student.account_status} /></td>
                      <td><StatusPill value={student.supervisor_status} /></td>
                      <td><StatusPill value={student.deleted_at ? 'deleted' : 'retained'} /></td>
                      <td>
                        <input type="checkbox" checked={student.resubmission_allowed} disabled={Boolean(student.deleted_at)} onChange={(event) => setResubmission(student, event.target.checked)} />
                      </td>
                      <td className="row-actions">
                        {student.deleted_at ? (
                          <button className="icon-button ok" onClick={() => retainUser('student', student)} title="Retain student"><RotateCcw size={18} /></button>
                        ) : (
                          <>
                            <button className="icon-button ok" onClick={() => setStatus('student', student.id, 'accepted')} title="Accept"><Check size={18} /></button>
                            <button className="icon-button danger" onClick={() => setStatus('student', student.id, 'rejected')} title="Reject"><X size={18} /></button>
                            <button className="icon-button" onClick={() => setEditor({
                              role: 'student',
                              id: student.id,
                              fullName: student.full_name,
                              indexNumber: student.index_number,
                              supervisorId: student.supervisor_id || '',
                              password: ''
                            })} title="Edit"><UserCog size={18} /></button>
                            <button className="icon-button danger" onClick={() => deleteUser('student', student)} title="Delete student, retain uploaded files"><Trash2 size={18} /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!users.students.length && (
                    <tr>
                      <td colSpan="8" className="empty">No students found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h2>Supervisors</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Group code</th>
                    <th>Account</th>
                    <th>Record</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.supervisors.map((supervisor) => (
                    <tr key={supervisor.id}>
                      <td>{supervisor.full_name}</td>
                      <td>{supervisor.group_code}</td>
                      <td><StatusPill value={supervisor.account_status} /></td>
                      <td><StatusPill value={supervisor.deleted_at ? 'deleted' : 'retained'} /></td>
                      <td className="row-actions">
                        {supervisor.deleted_at ? (
                          <button className="icon-button ok" onClick={() => retainUser('supervisor', supervisor)} title="Retain supervisor"><RotateCcw size={18} /></button>
                        ) : (
                          <>
                            <button className="icon-button ok" onClick={() => setStatus('supervisor', supervisor.id, 'accepted')} title="Accept"><Check size={18} /></button>
                            <button className="icon-button danger" onClick={() => setStatus('supervisor', supervisor.id, 'rejected')} title="Reject"><X size={18} /></button>
                            <button className="icon-button" onClick={() => setEditor({
                              role: 'supervisor',
                              id: supervisor.id,
                              fullName: supervisor.full_name,
                              groupCode: supervisor.group_code,
                              password: ''
                            })} title="Edit"><UserCog size={18} /></button>
                            <button className="icon-button danger" onClick={() => deleteUser('supervisor', supervisor)} title="Delete supervisor, retain uploaded files"><Trash2 size={18} /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!users.supervisors.length && (
                    <tr>
                      <td colSpan="5" className="empty">No supervisors found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      )}

      {tab === 'settings' && (
        <section className="panel">
          <form className="form-grid two" onSubmit={saveSettings}>
            <label>
              Opening date/time
              <input type="datetime-local" value={settings.submissionsOpenAt} onChange={(event) => setSettings({ ...settings, submissionsOpenAt: event.target.value })} />
            </label>
            <label>
              Closing date/time
              <input type="datetime-local" value={settings.submissionsCloseAt} onChange={(event) => setSettings({ ...settings, submissionsCloseAt: event.target.value })} />
            </label>
            <label className="check-row">
              <input type="checkbox" checked={settings.allowStudentFileView} onChange={(event) => setSettings({ ...settings, allowStudentFileView: event.target.checked })} />
              Allow students to open submitted PDFs
            </label>
            <label className="check-row">
              <input type="checkbox" checked={settings.allowGlobalResubmission} onChange={(event) => setSettings({ ...settings, allowGlobalResubmission: event.target.checked })} />
              Allow all students to resubmit
            </label>
            <label className="span-all">
              Notice
              <textarea value={settings.notice} onChange={(event) => setSettings({ ...settings, notice: event.target.value })} rows="3" />
            </label>
            <button className="primary" type="submit">
              <Save size={18} />
              Save Settings
            </button>
          </form>
        </section>
      )}

      {tab === 'files' && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Uploaded PDF Files</h2>
            <button className="secondary" onClick={() => exportExcel('/admin/submissions/export', 'all-care-study-submissions.xlsx')}>
              <Download size={18} />
              Export Excel
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Index number</th>
                  <th>Supervisor</th>
                  <th>Submitted</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td>{file.student_name}</td>
                    <td>{file.index_number}</td>
                    <td>{file.supervisor_name || 'Unassigned'}</td>
                    <td>{file.submitted_at ? new Date(file.submitted_at).toLocaleString() : 'Not linked'}</td>
                    <td className="row-actions">
                      <button className="icon-button" onClick={async () => setViewerUrl(await openFile(file.id, 'view'))} title="Open PDF"><FileText size={18} /></button>
                      <button className="icon-button" onClick={() => openFile(file.id, 'download')} title="Download PDF"><Download size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'logs' && (
        <section className="panel">
          <h2>Login Record / Activity Log for Candidates</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User Type</th>
                  <th>Name</th>
                  <th>ID/Index Number</th>
                  <th>Login Date</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Device Used</th>
                  <th>IP Address</th>
                  <th>Action</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.user_type}</td>
                    <td>{log.name || ''}</td>
                    <td>{log.identifier || ''}</td>
                    <td>{log.login_date}</td>
                    <td>{log.time_in ? new Date(log.time_in).toLocaleTimeString() : ''}</td>
                    <td>{log.time_out ? new Date(log.time_out).toLocaleTimeString() : ''}</td>
                    <td className="device-cell">{log.device_used}</td>
                    <td>{log.ip_address}</td>
                    <td>{log.action}</td>
                    <td><StatusPill value={log.outcome} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {viewerUrl && (
        <section className="panel pdf-panel">
          <iframe title="Care study PDF" src={viewerUrl} />
        </section>
      )}
    </section>
  );
}
