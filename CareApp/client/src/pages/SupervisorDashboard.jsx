import { useEffect, useState } from 'react';
import { Check, Download, FileText, RefreshCcw, X } from 'lucide-react';
import StatusPill from '../components/StatusPill.jsx';
import { api, exportExcel, openFile } from '../services/api.js';

export default function SupervisorDashboard() {
  const [pending, setPending] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [error, setError] = useState('');
  const [viewerUrl, setViewerUrl] = useState('');

  const load = async () => {
    setError('');
    const [pendingPayload, assignedPayload] = await Promise.all([
      api('/supervisor/students/pending'),
      api('/supervisor/students/assigned')
    ]);
    setPending(pendingPayload.students);
    setAssigned(assignedPayload.students);
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const decide = async (studentId, decision) => {
    try {
      await api(`/supervisor/students/${studentId}/decision`, {
        method: 'PATCH',
        body: { decision }
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="page-stack">
      <div className="section-heading">
        <div>
          <h1>Academic Supervisor Dashboard</h1>
          <p>Accept students, review assigned submissions, and export submitted care studies.</p>
        </div>
        <button className="secondary" onClick={() => load().catch((err) => setError(err.message))}>
          <RefreshCcw size={18} />
          Refresh
        </button>
      </div>

      {error && <p className="notice error">{error}</p>}

      <section className="panel">
        <h2>Pending Students</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Index number</th>
                <th>Status</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((student) => (
                <tr key={student.id}>
                  <td>{student.full_name}</td>
                  <td>{student.index_number}</td>
                  <td><StatusPill value={student.supervisor_status} /></td>
                  <td className="row-actions">
                    <button className="icon-button ok" onClick={() => decide(student.id, 'accepted')} title="Accept">
                      <Check size={18} />
                    </button>
                    <button className="icon-button danger" onClick={() => decide(student.id, 'rejected')} title="Reject">
                      <X size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {!pending.length && (
                <tr>
                  <td colSpan="4" className="empty">No pending students.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Assigned Students</h2>
          <button className="secondary" onClick={() => exportExcel('/supervisor/submissions/export', 'care-study-submissions.xlsx')}>
            <Download size={18} />
            Export Excel
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Index number</th>
                <th>Account</th>
                <th>Supervisor status</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {assigned.map((student) => (
                <tr key={student.id}>
                  <td>{student.full_name}</td>
                  <td>{student.index_number}</td>
                  <td><StatusPill value={student.account_status} /></td>
                  <td><StatusPill value={student.supervisor_status} /></td>
                  <td>
                    {student.file_id ? (
                      <div className="row-actions">
                        <button className="icon-button" onClick={async () => setViewerUrl(await openFile(student.file_id, 'view'))} title="Open PDF">
                          <FileText size={18} />
                        </button>
                        <button className="icon-button" onClick={() => openFile(student.file_id, 'download')} title="Download PDF">
                          <Download size={18} />
                        </button>
                      </div>
                    ) : (
                      <span className="muted">No file</span>
                    )}
                  </td>
                </tr>
              ))}
              {!assigned.length && (
                <tr>
                  <td colSpan="5" className="empty">No assigned students.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {viewerUrl && (
        <section className="panel pdf-panel">
          <iframe title="Care study PDF" src={viewerUrl} />
        </section>
      )}
    </section>
  );
}
