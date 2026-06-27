import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-change-me';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DATA_FILE = path.join(DATA_DIR, 'local-dev-db.json');
const CLIENT_DIST_DIR = path.resolve(process.env.CLIENT_DIST_DIR || path.join(ROOT, '..', 'client', 'dist'));
const CLIENT_INDEX = path.join(CLIENT_DIST_DIR, 'index.html');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const nowIso = () => new Date().toISOString();
const id = () => crypto.randomUUID();

const defaultDb = () => ({
  admins: [],
  supervisors: [],
  students: [],
  settings: {
    submissions_open_at: null,
    submissions_close_at: null,
    allow_student_file_view: false,
    allow_global_resubmission: false,
    notice: ''
  },
  files: [],
  submissions: [],
  auditLogs: []
});

const readDb = () => {
  if (!fs.existsSync(DATA_FILE)) return defaultDb();
  return { ...defaultDb(), ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
};

const writeDb = (db) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
};

const seedAdmin = async () => {
  const db = readDb();
  if (db.admins.length) return;
  db.admins.push({
    id: id(),
    username: process.env.DEFAULT_ADMIN_USERNAME || 'superadmin',
    full_name: process.env.DEFAULT_ADMIN_NAME || 'Super Administrator',
    password_hash: await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMeNow!2026', 12),
    role: 'super_admin',
    created_at: nowIso(),
    updated_at: nowIso()
  });
  writeDb(db);
};

const publicUser = (role, row) => ({
  id: row.id,
  role,
  name: row.full_name,
  identifier: row.index_number || row.username || row.group_code || row.full_name,
  status: row.account_status || 'accepted',
  groupCode: row.group_code || null
});

const tokenFor = (role, row) =>
  jwt.sign(
    {
      sub: row.id,
      role,
      name: row.full_name,
      identifier: row.index_number || row.username || row.group_code || row.full_name
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

const audit = (db, req, fields) => {
  db.auditLogs.unshift({
    id: db.auditLogs.length + 1,
    user_type: fields.userType,
    user_id: fields.userId || null,
    name: fields.name || null,
    identifier: fields.identifier || null,
    action: fields.action,
    outcome: fields.outcome || 'success',
    login_date: new Date().toISOString().slice(0, 10),
    time_in: fields.timeIn || null,
    time_out: fields.timeOut || null,
    device_used: req.get('user-agent') || 'Unknown device',
    ip_address: req.ip,
    metadata: fields.metadata || {},
    created_at: nowIso()
  });
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const requireField = (value, label) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new HttpError(400, `${label} is required.`);
  }
  return String(value).trim();
};

const auth = (roles = []) => (req, _res, next) => {
  const expected = Array.isArray(roles) ? roles : [roles];
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next(new HttpError(401, 'Authentication is required.'));
  try {
    const user = jwt.verify(token, JWT_SECRET);
    if (expected.length && !expected.includes(user.role)) {
      throw new HttpError(403, 'You do not have permission to access this resource.');
    }
    req.user = user;
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, 'Invalid or expired session.'));
  }
};

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${id()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new HttpError(400, 'Only PDF files are allowed.'));
    cb(null, true);
  }
});

const app = express();

const firstLanIp = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .find((details) => details && details.family === 'IPv4' && !details.internal)?.address;

const appUrlForQr = (origin) => {
  const fallback = origin || 'http://localhost:5173';
  try {
    const url = new URL(fallback);
    if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
      const lanIp = firstLanIp();
      if (lanIp) url.hostname = lanIp;
    }
    return `${url.origin}/`;
  } catch {
    return fallback;
  }
};

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: true, credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (fs.existsSync(CLIENT_DIST_DIR)) {
  app.use(express.static(CLIENT_DIST_DIR));
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'CareApp local dev API' }));

app.get('/api/network-info', (req, res) => {
  res.json({ url: appUrlForQr(req.get('origin')) });
});

app.post('/api/auth/student/register', wrap(async (req, res) => {
  const db = readDb();
  const full_name = requireField(req.body.fullName, 'Full name');
  const index_number = requireField(req.body.indexNumber, 'Index number').toUpperCase();
  const password = requireField(req.body.password, 'Password');
  if (db.students.some((student) => student.index_number === index_number)) {
    throw new HttpError(409, 'This index number is already registered.');
  }
  const student = {
    id: id(),
    full_name,
    index_number,
    password_hash: await bcrypt.hash(password, 12),
    supervisor_id: null,
    supervisor_status: 'unassigned',
    account_status: 'pending',
    resubmission_allowed: false,
    created_at: nowIso(),
    updated_at: nowIso()
  };
  db.students.push(student);
  writeDb(db);
  res.status(201).json({ message: 'Student registration submitted for approval.', student });
}));

app.post('/api/auth/supervisor/register', wrap(async (req, res) => {
  const db = readDb();
  const full_name = requireField(req.body.fullName, 'Full name');
  const password = requireField(req.body.password, 'Password');
  const group_code = (req.body.groupCode || `SUP-${crypto.randomBytes(3).toString('hex')}`).toUpperCase();
  if (db.supervisors.some((item) => item.group_code === group_code)) {
    throw new HttpError(409, 'This group code is already in use.');
  }
  const supervisor = {
    id: id(),
    full_name,
    password_hash: await bcrypt.hash(password, 12),
    group_code,
    account_status: 'pending',
    created_at: nowIso(),
    updated_at: nowIso()
  };
  db.supervisors.push(supervisor);
  writeDb(db);
  res.status(201).json({ message: 'Supervisor registration submitted for approval.', supervisor });
}));

app.post('/api/auth/student/login', wrap(async (req, res) => {
  const db = readDb();
  const index_number = requireField(req.body.indexNumber, 'Index number').toUpperCase();
  const password = requireField(req.body.password, 'Password');
  const student = db.students.find((item) => item.index_number === index_number);
  if (!student || !(await bcrypt.compare(password, student.password_hash))) {
    audit(db, req, { userType: 'student', identifier: index_number, action: 'login', outcome: 'failed' });
    writeDb(db);
    throw new HttpError(401, 'Invalid index number or password.');
  }
  if (student.deleted_at) throw new HttpError(403, 'This student account has been deleted by the administrator.');
  if (student.account_status !== 'accepted') throw new HttpError(403, 'Your student account has not been accepted by the administrator.');
  if (!student.supervisor_id) throw new HttpError(403, 'You have not been assigned to a supervisor yet.');
  if (student.supervisor_id && student.supervisor_status !== 'accepted') throw new HttpError(403, 'Your supervisor has not accepted you into the group.');
  audit(db, req, { userType: 'student', userId: student.id, name: student.full_name, identifier: student.index_number, action: 'login', timeIn: nowIso() });
  writeDb(db);
  res.json({ token: tokenFor('student', student), user: publicUser('student', student) });
}));

app.post('/api/auth/supervisor/login', wrap(async (req, res) => {
  const db = readDb();
  const fullName = requireField(req.body.fullName, 'Full name');
  const password = requireField(req.body.password, 'Password');
  const supervisor = db.supervisors.find((item) => item.full_name.toLowerCase() === fullName.toLowerCase());
  if (!supervisor || !(await bcrypt.compare(password, supervisor.password_hash))) {
    audit(db, req, { userType: 'supervisor', name: fullName, action: 'login', outcome: 'failed' });
    writeDb(db);
    throw new HttpError(401, 'Invalid supervisor name or password.');
  }
  if (supervisor.deleted_at) throw new HttpError(403, 'This supervisor account has been deleted by the administrator.');
  if (supervisor.account_status !== 'accepted') throw new HttpError(403, 'Your supervisor account has not been accepted by the administrator.');
  audit(db, req, { userType: 'supervisor', userId: supervisor.id, name: supervisor.full_name, identifier: supervisor.group_code, action: 'login', timeIn: nowIso() });
  writeDb(db);
  res.json({ token: tokenFor('supervisor', supervisor), user: publicUser('supervisor', supervisor) });
}));

app.post('/api/auth/admin/login', wrap(async (req, res) => {
  const db = readDb();
  const username = requireField(req.body.username, 'Username');
  const password = requireField(req.body.password, 'Password');
  const admin = db.admins.find((item) => item.username.toLowerCase() === username.toLowerCase());
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    audit(db, req, { userType: 'admin', identifier: username, action: 'login', outcome: 'failed' });
    writeDb(db);
    throw new HttpError(401, 'Invalid administrator username or password.');
  }
  audit(db, req, { userType: 'admin', userId: admin.id, name: admin.full_name, identifier: admin.username, action: 'login', timeIn: nowIso() });
  writeDb(db);
  res.json({ token: tokenFor('admin', admin), user: publicUser('admin', admin) });
}));

app.post('/api/auth/logout', auth(), wrap(async (req, res) => {
  const db = readDb();
  audit(db, req, { userType: req.user.role, userId: req.user.sub, name: req.user.name, identifier: req.user.identifier, action: 'logout', timeOut: nowIso() });
  writeDb(db);
  res.json({ message: 'Logout recorded.' });
}));

app.get('/api/auth/me', auth(), (req, res) => res.json({ user: req.user }));

app.get('/api/student/profile', auth('student'), wrap(async (req, res) => {
  const db = readDb();
  const student = db.students.find((item) => item.id === req.user.sub && !item.deleted_at);
  if (!student) throw new HttpError(404, 'Student profile was not found.');
  const supervisor = db.supervisors.find((item) => item.id === student.supervisor_id);
  const submission = db.submissions.find((item) => item.student_id === student.id);
  const file = submission ? db.files.find((item) => item.id === submission.pdf_file_id) : null;
  const mayResubmit = db.settings.allow_global_resubmission || student.resubmission_allowed;
  res.json({
    student: { ...student, supervisor_name: supervisor?.full_name || null },
    settings: db.settings,
    submission: submission && file ? { ...submission, file_id: file.id, original_name: file.original_name, size_bytes: file.size_bytes } : null,
    permissions: {
      canSubmit: !submission || mayResubmit,
      canViewOwnPdf: db.settings.allow_student_file_view
    }
  });
}));

app.post('/api/student/submission', auth('student'), upload.single('pdf'), wrap(async (req, res) => {
  const db = readDb();
  const student = db.students.find((item) => item.id === req.user.sub && !item.deleted_at);
  if (!student) throw new HttpError(404, 'Student profile was not found.');
  if (!req.file) throw new HttpError(400, 'A PDF file is required.');
  const existing = db.submissions.find((item) => item.student_id === student.id);
  const mayResubmit = db.settings.allow_global_resubmission || student.resubmission_allowed;
  if (existing && !mayResubmit) throw new HttpError(409, 'A care study has already been submitted. Resubmission is disabled.');
  const file = {
    id: id(),
    student_id: student.id,
    supervisor_id: student.supervisor_id,
    original_name: req.file.originalname,
    stored_name: req.file.filename,
    mime_type: req.file.mimetype,
    size_bytes: req.file.size,
    storage_path: req.file.path,
    uploaded_at: nowIso()
  };
  db.files.push(file);
  const submission = existing || { id: id(), student_id: student.id, created_at: nowIso() };
  Object.assign(submission, {
    supervisor_id: student.supervisor_id,
    pdf_file_id: file.id,
    student_entered_at: nowIso(),
    submitted_at: nowIso(),
    updated_at: nowIso()
  });
  if (!existing) db.submissions.push(submission);
  file.submission_id = submission.id;
  audit(db, req, { userType: 'student', userId: student.id, name: student.full_name, identifier: student.index_number, action: 'submit_care_study', metadata: { fileName: file.original_name } });
  writeDb(db);
  res.status(201).json({ message: 'Care study submitted successfully.', submission, file });
}));

app.get('/api/supervisor/students/pending', auth('supervisor'), (req, res) => {
  const db = readDb();
  res.json({ students: db.students.filter((item) => item.supervisor_id === req.user.sub && item.account_status === 'accepted' && item.supervisor_status === 'pending' && !item.deleted_at) });
});

app.patch('/api/supervisor/students/:id/decision', auth('supervisor'), wrap(async (req, res) => {
  const decision = req.body.decision;
  if (!['accepted', 'rejected'].includes(decision)) throw new HttpError(400, 'Decision must be accepted or rejected.');
  const db = readDb();
  const student = db.students.find((item) => item.id === req.params.id && item.supervisor_id === req.user.sub && !item.deleted_at);
  if (!student) throw new HttpError(404, 'Student was not found in your supervisor group.');
  student.supervisor_status = decision;
  student.updated_at = nowIso();
  audit(db, req, { userType: 'supervisor', userId: req.user.sub, name: req.user.name, identifier: req.user.identifier, action: `${decision}_student`, metadata: { studentId: student.id } });
  writeDb(db);
  res.json({ student });
}));

app.get('/api/supervisor/students/assigned', auth('supervisor'), (req, res) => {
  const db = readDb();
  const students = db.students
    .filter((student) => student.supervisor_id === req.user.sub && !student.deleted_at)
    .map((student) => {
      const submission = db.submissions.find((item) => item.student_id === student.id);
      const file = submission ? db.files.find((item) => item.id === submission.pdf_file_id) : null;
      return {
        ...student,
        submission_id: submission?.id || null,
        submitted_at: submission?.submitted_at || null,
        file_id: file?.id || null,
        original_name: file?.original_name || null,
        size_bytes: file?.size_bytes || null
      };
    });
  res.json({ students });
});

const submissionRows = (db, supervisorId = null) =>
  db.submissions
    .filter((submission) => !supervisorId || submission.supervisor_id === supervisorId)
    .map((submission) => {
      const student = db.students.find((item) => item.id === submission.student_id);
      const supervisor = db.supervisors.find((item) => item.id === submission.supervisor_id);
      const file = db.files.find((item) => item.id === submission.pdf_file_id);
      return {
        'Name of student': student?.full_name || '',
        'Index number': student?.index_number || '',
        Supervisor: supervisor?.full_name || '',
        'Date and time of submission': submission.submitted_at,
        'Attached PDF name': file?.original_name || ''
      };
    });

const sendWorkbook = (res, rows, fileName) => {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Care Study Submissions');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
};

app.get('/api/supervisor/submissions/export', auth('supervisor'), (req, res) => {
  sendWorkbook(res, submissionRows(readDb(), req.user.sub), 'care-study-submissions.xlsx');
});

app.get('/api/admin/users', auth('admin'), (_req, res) => {
  const db = readDb();
  const includeDeleted = String(_req.query.includeDeleted).toLowerCase() === 'true';
  const students = db.students
    .filter((student) => includeDeleted || !student.deleted_at)
    .map(({ password_hash, ...student }) => ({
      ...student,
      supervisor_name: db.supervisors.find((item) => item.id === student.supervisor_id)?.full_name || null
    }));
  res.json({
    students,
    supervisors: db.supervisors
      .filter((supervisor) => includeDeleted || !supervisor.deleted_at)
      .map(({ password_hash, ...supervisor }) => supervisor)
  });
});

app.get('/api/admin/pending-users', auth('admin'), (_req, res) => {
  const db = readDb();
  res.json({
    students: db.students
      .filter((item) => item.account_status === 'pending' && !item.deleted_at)
      .map(({ password_hash, ...student }) => student),
    supervisors: db.supervisors
      .filter((item) => item.account_status === 'pending' && !item.deleted_at)
      .map(({ password_hash, ...supervisor }) => supervisor)
  });
});

app.patch('/api/admin/users/:role/:id/status', auth('admin'), wrap(async (req, res) => {
  const status = req.body.accountStatus || req.body.status;
  if (!['pending', 'accepted', 'rejected'].includes(status)) throw new HttpError(400, 'Status must be pending, accepted, or rejected.');
  const db = readDb();
  const list = req.params.role.startsWith('supervisor') ? db.supervisors : db.students;
  const user = list.find((item) => item.id === req.params.id && !item.deleted_at);
  if (!user) throw new HttpError(404, 'User was not found.');
  user.account_status = status;
  user.updated_at = nowIso();
  audit(db, req, { userType: 'admin', userId: req.user.sub, name: req.user.name, identifier: req.user.identifier, action: `${status}_${req.params.role}`, metadata: { targetId: user.id } });
  writeDb(db);
  res.json({ user });
}));

app.put('/api/admin/users/:role/:id', auth('admin'), wrap(async (req, res) => {
  const db = readDb();
  const list = req.params.role.startsWith('supervisor') ? db.supervisors : db.students;
  const user = list.find((item) => item.id === req.params.id && !item.deleted_at);
  if (!user) throw new HttpError(404, 'User was not found.');
  if (req.body.fullName) user.full_name = String(req.body.fullName).trim();
  if (req.body.password) user.password_hash = await bcrypt.hash(req.body.password, 12);
  if ('indexNumber' in req.body) user.index_number = String(req.body.indexNumber).trim().toUpperCase();
  if ('groupCode' in req.body) user.group_code = String(req.body.groupCode).trim().toUpperCase();
  if ('supervisorId' in req.body) {
    user.supervisor_id = req.body.supervisorId || null;
    user.supervisor_status = req.body.supervisorId ? 'pending' : 'unassigned';
  }
  user.updated_at = nowIso();
  writeDb(db);
  res.json({ user });
}));

app.delete('/api/admin/users/:role/:id', auth('admin'), wrap(async (req, res) => {
  const db = readDb();
  const list = req.params.role.startsWith('supervisor') ? db.supervisors : db.students;
  const user = list.find((item) => item.id === req.params.id);
  if (!user) throw new HttpError(404, 'User was not found.');

  user.account_status = 'rejected';
  user.deleted_at = user.deleted_at || nowIso();
  user.deleted_by = user.deleted_by || req.user.sub;
  user.deletion_reason = user.deletion_reason || 'Deleted by super administrator; uploaded files retained.';
  user.updated_at = nowIso();

  if (req.params.role.startsWith('supervisor')) {
    db.students.forEach((student) => {
      if (student.supervisor_id === user.id && !student.deleted_at) {
        student.supervisor_id = null;
        student.supervisor_status = 'unassigned';
        student.updated_at = nowIso();
      }
    });
  }

  audit(db, req, {
    userType: 'admin',
    userId: req.user.sub,
    name: req.user.name,
    identifier: req.user.identifier,
    action: `deleted_${req.params.role.startsWith('supervisor') ? 'supervisor' : 'student'}`,
    metadata: { targetId: user.id, filesRetained: true }
  });
  writeDb(db);
  res.json({ user, message: 'User deleted. Uploaded file records were retained.' });
}));

app.patch('/api/admin/users/:role/:id/restore', auth('admin'), wrap(async (req, res) => {
  const db = readDb();
  const list = req.params.role.startsWith('supervisor') ? db.supervisors : db.students;
  const user = list.find((item) => item.id === req.params.id);
  if (!user) throw new HttpError(404, 'User was not found.');

  user.deleted_at = null;
  user.deleted_by = null;
  user.deletion_reason = null;
  user.updated_at = nowIso();

  audit(db, req, {
    userType: 'admin',
    userId: req.user.sub,
    name: req.user.name,
    identifier: req.user.identifier,
    action: `retained_${req.params.role.startsWith('supervisor') ? 'supervisor' : 'student'}`,
    metadata: { targetId: user.id, filesRetained: true }
  });
  writeDb(db);
  res.json({ user, message: 'User retained in active records.' });
}));

app.patch('/api/admin/students/:id/resubmission', auth('admin'), (req, res) => {
  const db = readDb();
  const student = db.students.find((item) => item.id === req.params.id && !item.deleted_at);
  if (!student) throw new HttpError(404, 'Student was not found.');
  student.resubmission_allowed = Boolean(req.body.allowed);
  student.updated_at = nowIso();
  writeDb(db);
  res.json({ student });
});

app.get('/api/admin/settings', auth('admin'), (_req, res) => res.json({ settings: readDb().settings }));

app.patch('/api/admin/settings', auth('admin'), (req, res) => {
  const db = readDb();
  db.settings = {
    submissions_open_at: req.body.submissionsOpenAt || null,
    submissions_close_at: req.body.submissionsCloseAt || null,
    allow_student_file_view: Boolean(req.body.allowStudentFileView),
    allow_global_resubmission: Boolean(req.body.allowGlobalResubmission),
    notice: req.body.notice || ''
  };
  audit(db, req, { userType: 'admin', userId: req.user.sub, name: req.user.name, identifier: req.user.identifier, action: 'updated_settings' });
  writeDb(db);
  res.json({ settings: db.settings });
});

app.get('/api/admin/files', auth('admin'), (_req, res) => {
  const db = readDb();
  const files = db.files.map((file) => {
    const student = db.students.find((item) => item.id === file.student_id);
    const supervisor = db.supervisors.find((item) => item.id === file.supervisor_id);
    const submission = db.submissions.find((item) => item.pdf_file_id === file.id);
    return {
      ...file,
      student_name: student?.full_name || '',
      index_number: student?.index_number || '',
      supervisor_name: supervisor?.full_name || null,
      submitted_at: submission?.submitted_at || null
    };
  });
  res.json({ files });
});

app.get('/api/admin/submissions/export', auth('admin'), (_req, res) => {
  sendWorkbook(res, submissionRows(readDb()), 'all-care-study-submissions.xlsx');
});

app.get('/api/admin/audit-logs', auth('admin'), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  res.json({ logs: readDb().auditLogs.slice(0, limit) });
});

const loadFileForUser = (req) => {
  const db = readDb();
  const file = db.files.find((item) => item.id === req.params.id);
  if (!file) throw new HttpError(404, 'PDF file was not found.');
  if (req.user.role === 'admin') return file;
  if (req.user.role === 'supervisor' && file.supervisor_id === req.user.sub) return file;
  if (req.user.role === 'student' && file.student_id === req.user.sub && db.settings.allow_student_file_view) return file;
  throw new HttpError(403, 'You do not have access to this PDF file.');
};

app.get('/api/files/:id/view', auth(['student', 'supervisor', 'admin']), (req, res) => {
  const file = loadFileForUser(req);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
  res.sendFile(path.resolve(file.storage_path));
});

app.get('/api/files/:id/download', auth(['student', 'supervisor', 'admin']), (req, res) => {
  const file = loadFileForUser(req);
  res.download(path.resolve(file.storage_path), file.original_name);
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  if (!fs.existsSync(CLIENT_INDEX)) return next();
  return res.sendFile(CLIENT_INDEX);
});

app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` }));
app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  if (status === 500) console.error(error);
  res.status(status).json({ error: status === 500 ? 'The server could not complete the request.' : error.message });
});

await seedAdmin();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CareApp local dev API listening on http://0.0.0.0:${PORT}`);
});
