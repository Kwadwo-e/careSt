import express from 'express';
import crypto from 'node:crypto';
import { query } from '../config/db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, required } from '../utils/http.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { recordAudit } from '../services/audit.service.js';

export const authRouter = express.Router();

const publicUser = (role, row) => ({
  id: row.id,
  role,
  name: row.full_name,
  identifier: row.index_number || row.username || row.group_code || row.full_name,
  status: row.account_status || 'accepted',
  groupCode: row.group_code || null
});

const issueSession = async (req, res, role, row, identifier) => {
  const user = publicUser(role, row);
  const token = signToken({
    sub: user.id,
    role,
    name: user.name,
    identifier
  });

  await recordAudit({
    req,
    userType: role,
    userId: user.id,
    name: user.name,
    identifier,
    action: 'login',
    outcome: 'success',
    timeIn: new Date(),
    metadata: { role }
  });

  res.json({ token, user });
};

authRouter.post('/student/register', asyncHandler(async (req, res) => {
  const fullName = required(req.body.fullName, 'Full name');
  const indexNumber = required(req.body.indexNumber, 'Index number').toUpperCase();
  const password = required(req.body.password, 'Password');

  const passwordHash = await hashPassword(password);
  const result = await query(
    `INSERT INTO students (full_name, index_number, password_hash, supervisor_id, supervisor_status)
     VALUES ($1,$2,$3,NULL,'unassigned')
     RETURNING id, full_name, index_number, account_status, supervisor_status`,
    [fullName, indexNumber, passwordHash]
  );

  res.status(201).json({
    message: 'Student registration submitted for approval.',
    student: result.rows[0]
  });
}));

authRouter.post('/supervisor/register', asyncHandler(async (req, res) => {
  const fullName = required(req.body.fullName, 'Full name');
  const password = required(req.body.password, 'Password');
  const groupCode = (req.body.groupCode || `SUP-${crypto.randomBytes(3).toString('hex')}`).toUpperCase();
  const passwordHash = await hashPassword(password);

  const result = await query(
    `INSERT INTO supervisors (full_name, password_hash, group_code)
     VALUES ($1,$2,$3)
     RETURNING id, full_name, group_code, account_status`,
    [fullName, passwordHash, groupCode]
  );

  res.status(201).json({
    message: 'Supervisor registration submitted for approval.',
    supervisor: result.rows[0]
  });
}));

authRouter.post('/student/login', asyncHandler(async (req, res) => {
  const indexNumber = required(req.body.indexNumber, 'Index number').toUpperCase();
  const password = required(req.body.password, 'Password');
  const result = await query('SELECT * FROM students WHERE index_number = $1 AND deleted_at IS NULL', [indexNumber]);
  const student = result.rows[0];

  if (!student || !(await verifyPassword(password, student.password_hash))) {
    await recordAudit({
      req,
      userType: 'student',
      identifier: indexNumber,
      action: 'login',
      outcome: 'failed',
      metadata: { reason: 'invalid_credentials' }
    });
    throw new HttpError(401, 'Invalid index number or password.');
  }

  if (student.account_status !== 'accepted') {
    throw new HttpError(403, 'Your student account has not been accepted by the administrator.');
  }

  if (!student.supervisor_id) {
    throw new HttpError(403, 'You have not been assigned to a supervisor yet.');
  }

  if (student.supervisor_id && student.supervisor_status !== 'accepted') {
    throw new HttpError(403, 'Your supervisor has not accepted you into the group.');
  }

  await issueSession(req, res, 'student', student, student.index_number);
}));

authRouter.post('/supervisor/login', asyncHandler(async (req, res) => {
  const fullName = required(req.body.fullName, 'Full name');
  const password = required(req.body.password, 'Password');
  const result = await query(
    `SELECT *
     FROM supervisors
     WHERE LOWER(full_name) = LOWER($1) AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [fullName]
  );
  const supervisor = result.rows[0];

  if (!supervisor || !(await verifyPassword(password, supervisor.password_hash))) {
    await recordAudit({
      req,
      userType: 'supervisor',
      name: fullName,
      action: 'login',
      outcome: 'failed',
      metadata: { reason: 'invalid_credentials' }
    });
    throw new HttpError(401, 'Invalid supervisor name or password.');
  }

  if (supervisor.account_status !== 'accepted') {
    throw new HttpError(403, 'Your supervisor account has not been accepted by the administrator.');
  }

  await issueSession(req, res, 'supervisor', supervisor, supervisor.group_code);
}));

authRouter.post('/admin/login', asyncHandler(async (req, res) => {
  const username = required(req.body.username, 'Username');
  const password = required(req.body.password, 'Password');
  const result = await query('SELECT * FROM admins WHERE LOWER(username) = LOWER($1)', [username]);
  const admin = result.rows[0];

  if (!admin || !(await verifyPassword(password, admin.password_hash))) {
    await recordAudit({
      req,
      userType: 'admin',
      identifier: username,
      action: 'login',
      outcome: 'failed',
      metadata: { reason: 'invalid_credentials' }
    });
    throw new HttpError(401, 'Invalid administrator username or password.');
  }

  await issueSession(req, res, 'admin', admin, admin.username);
}));

authRouter.post('/logout', requireAuth(), asyncHandler(async (req, res) => {
  await recordAudit({
    req,
    userType: req.user.role,
    userId: req.user.sub,
    name: req.user.name,
    identifier: req.user.identifier,
    action: 'logout',
    outcome: 'success',
    timeOut: new Date()
  });
  res.json({ message: 'Logout recorded.' });
}));

authRouter.get('/me', requireAuth(), (req, res) => {
  res.json({ user: req.user });
});
