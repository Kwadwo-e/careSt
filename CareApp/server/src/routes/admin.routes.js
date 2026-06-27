import express from 'express';
import { query, transaction } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, normalizeStatus } from '../utils/http.js';
import { hashPassword } from '../utils/password.js';
import { recordAudit } from '../services/audit.service.js';
import { buildSubmissionWorkbook } from '../services/export.service.js';

export const adminRouter = express.Router();

adminRouter.use(requireAuth('admin'));

const userTableForRole = (role) => {
  if (role === 'students' || role === 'student') return 'students';
  if (role === 'supervisors' || role === 'supervisor') return 'supervisors';
  throw new HttpError(400, 'Role must be student or supervisor.');
};

const includeDeletedFilter = (req, alias = '') => {
  if (String(req.query.includeDeleted).toLowerCase() === 'true') return '';
  return `WHERE ${alias}deleted_at IS NULL`;
};

adminRouter.get('/users', asyncHandler(async (req, res) => {
  const studentDeletedFilter = includeDeletedFilter(req, 's.');
  const supervisorDeletedFilter = includeDeletedFilter(req);
  const [students, supervisors] = await Promise.all([
    query(
      `SELECT s.id, s.full_name, s.index_number, s.supervisor_id, s.account_status, s.supervisor_status,
              s.resubmission_allowed, s.deleted_at, s.deletion_reason,
              sup.full_name AS supervisor_name, s.created_at
       FROM students s
       LEFT JOIN supervisors sup ON sup.id = s.supervisor_id
       ${studentDeletedFilter}
       ORDER BY s.created_at DESC`
    ),
    query(
      `SELECT id, full_name, group_code, account_status, deleted_at, deletion_reason, created_at
       FROM supervisors
       ${supervisorDeletedFilter}
       ORDER BY created_at DESC`
    )
  ]);
  res.json({ students: students.rows, supervisors: supervisors.rows });
}));

adminRouter.get('/pending-users', asyncHandler(async (_req, res) => {
  const [students, supervisors] = await Promise.all([
    query(
      `SELECT id, full_name, index_number, account_status, supervisor_status, created_at
       FROM students
       WHERE account_status = 'pending' AND deleted_at IS NULL
       ORDER BY created_at ASC`
    ),
    query(
      `SELECT id, full_name, group_code, account_status, created_at
       FROM supervisors
       WHERE account_status = 'pending' AND deleted_at IS NULL
       ORDER BY created_at ASC`
    )
  ]);
  res.json({ students: students.rows, supervisors: supervisors.rows });
}));

adminRouter.patch('/users/:role/:id/status', asyncHandler(async (req, res) => {
  const table = userTableForRole(req.params.role);
  const status = normalizeStatus(req.body.accountStatus || req.body.status);
  const result = await query(
    `UPDATE ${table}
     SET account_status = $1,
         accepted_by = CASE WHEN $1 = 'accepted' THEN $2 ELSE accepted_by END,
         accepted_at = CASE WHEN $1 = 'accepted' THEN now() ELSE accepted_at END,
         updated_at = now()
     WHERE id = $3 AND deleted_at IS NULL
     RETURNING id, full_name, account_status`,
    [status, req.user.sub, req.params.id]
  );

  if (result.rowCount === 0) throw new HttpError(404, 'User was not found.');

  await recordAudit({
    req,
    userType: 'admin',
    userId: req.user.sub,
    name: req.user.name,
    identifier: req.user.identifier,
    action: `${status}_${table.slice(0, -1)}`,
    outcome: 'success',
    metadata: { targetId: req.params.id, table }
  });

  res.json({ user: result.rows[0] });
}));

adminRouter.put('/users/:role/:id', asyncHandler(async (req, res) => {
  const table = userTableForRole(req.params.role);
  const updates = [];
  const values = [];

  const add = (column, value) => {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  };

  if (req.body.fullName) add('full_name', String(req.body.fullName).trim());
  if (req.body.password) add('password_hash', await hashPassword(req.body.password));

  if (table === 'students') {
    if (req.body.indexNumber) add('index_number', String(req.body.indexNumber).trim().toUpperCase());
    if (Object.prototype.hasOwnProperty.call(req.body, 'supervisorId')) {
      add('supervisor_id', req.body.supervisorId || null);
      add('supervisor_status', req.body.supervisorId ? 'pending' : 'unassigned');
    }
  }

  if (table === 'supervisors' && req.body.groupCode) {
    add('group_code', String(req.body.groupCode).trim().toUpperCase());
  }

  if (updates.length === 0) {
    throw new HttpError(400, 'No supported fields were provided.');
  }

  add('updated_at', new Date());
  values.push(req.params.id);

  const result = await query(
    `UPDATE ${table}
     SET ${updates.join(', ')}
     WHERE id = $${values.length} AND deleted_at IS NULL
     RETURNING id, full_name, account_status`,
    values
  );

  if (result.rowCount === 0) throw new HttpError(404, 'User was not found.');

  await recordAudit({
    req,
    userType: 'admin',
    userId: req.user.sub,
    name: req.user.name,
    identifier: req.user.identifier,
    action: `updated_${table.slice(0, -1)}`,
    outcome: 'success',
    metadata: { targetId: req.params.id, fields: Object.keys(req.body) }
  });

  res.json({ user: result.rows[0] });
}));

adminRouter.delete('/users/:role/:id', asyncHandler(async (req, res) => {
  const table = userTableForRole(req.params.role);
  const singularRole = table.slice(0, -1);
  const deletionReason = req.body?.reason || 'Deleted by super administrator; uploaded files retained.';

  const result = await transaction(async (client) => {
    const deleted = await client.query(
      `UPDATE ${table}
       SET account_status = 'rejected',
           deleted_at = COALESCE(deleted_at, now()),
           deleted_by = COALESCE(deleted_by, $1),
           deletion_reason = COALESCE(deletion_reason, $2),
           updated_at = now()
       WHERE id = $3
       RETURNING id, full_name, account_status, deleted_at`,
      [req.user.sub, deletionReason, req.params.id]
    );

    if (deleted.rowCount === 0) throw new HttpError(404, 'User was not found.');

    if (table === 'supervisors') {
      await client.query(
        `UPDATE students
         SET supervisor_id = NULL, supervisor_status = 'unassigned', updated_at = now()
         WHERE supervisor_id = $1 AND deleted_at IS NULL`,
        [req.params.id]
      );
    }

    await recordAudit({
      client,
      req,
      userType: 'admin',
      userId: req.user.sub,
      name: req.user.name,
      identifier: req.user.identifier,
      action: `deleted_${singularRole}`,
      outcome: 'success',
      metadata: {
        targetId: req.params.id,
        table,
        filesRetained: true
      }
    });

    return deleted.rows[0];
  });

  res.json({ user: result, message: `${singularRole} deleted. Uploaded file records were retained.` });
}));

adminRouter.patch('/users/:role/:id/restore', asyncHandler(async (req, res) => {
  const table = userTableForRole(req.params.role);
  const singularRole = table.slice(0, -1);

  const result = await query(
    `UPDATE ${table}
     SET deleted_at = NULL,
         deleted_by = NULL,
         deletion_reason = NULL,
         updated_at = now()
     WHERE id = $1
     RETURNING id, full_name, account_status, deleted_at`,
    [req.params.id]
  );

  if (result.rowCount === 0) throw new HttpError(404, 'User was not found.');

  await recordAudit({
    req,
    userType: 'admin',
    userId: req.user.sub,
    name: req.user.name,
    identifier: req.user.identifier,
    action: `retained_${singularRole}`,
    outcome: 'success',
    metadata: {
      targetId: req.params.id,
      table,
      filesRetained: true
    }
  });

  res.json({ user: result.rows[0], message: `${singularRole} retained in active records.` });
}));

adminRouter.patch('/students/:id/resubmission', asyncHandler(async (req, res) => {
  const allowed = Boolean(req.body.allowed);
  const result = await query(
    `UPDATE students
     SET resubmission_allowed = $1, updated_at = now()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id, full_name, index_number, resubmission_allowed`,
    [allowed, req.params.id]
  );
  if (result.rowCount === 0) throw new HttpError(404, 'Student was not found.');
  res.json({ student: result.rows[0] });
}));

adminRouter.get('/settings', asyncHandler(async (_req, res) => {
  const result = await query('SELECT * FROM app_settings WHERE id = true');
  res.json({ settings: result.rows[0] });
}));

adminRouter.patch('/settings', asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE app_settings
     SET submissions_open_at = $1,
         submissions_close_at = $2,
         allow_student_file_view = $3,
         allow_global_resubmission = $4,
         notice = $5,
         updated_by = $6,
         updated_at = now()
     WHERE id = true
     RETURNING *`,
    [
      req.body.submissionsOpenAt || null,
      req.body.submissionsCloseAt || null,
      Boolean(req.body.allowStudentFileView),
      Boolean(req.body.allowGlobalResubmission),
      req.body.notice || '',
      req.user.sub
    ]
  );

  await recordAudit({
    req,
    userType: 'admin',
    userId: req.user.sub,
    name: req.user.name,
    identifier: req.user.identifier,
    action: 'updated_settings',
    outcome: 'success'
  });

  res.json({ settings: result.rows[0] });
}));

adminRouter.get('/files', asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT f.id, f.original_name, f.size_bytes, f.uploaded_at,
            s.full_name AS student_name, s.index_number,
            sup.full_name AS supervisor_name,
            sub.submitted_at
     FROM uploaded_files f
     JOIN students s ON s.id = f.student_id
     LEFT JOIN supervisors sup ON sup.id = f.supervisor_id
     LEFT JOIN submissions sub ON sub.pdf_file_id = f.id
     ORDER BY f.uploaded_at DESC`
  );
  res.json({ files: result.rows });
}));

adminRouter.get('/submissions/export', asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT s.full_name AS student_name, s.index_number, sup.full_name AS supervisor_name,
            sub.submitted_at, f.original_name
     FROM submissions sub
     JOIN students s ON s.id = sub.student_id
     LEFT JOIN supervisors sup ON sup.id = sub.supervisor_id
     JOIN uploaded_files f ON f.id = sub.pdf_file_id
     ORDER BY sub.submitted_at DESC`
  );

  const workbook = buildSubmissionWorkbook(result.rows);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="all-care-study-submissions.xlsx"');
  res.send(workbook);
}));

adminRouter.get('/audit-logs', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const result = await query(
    `SELECT id, user_type, user_id, name, identifier, action, outcome,
            login_date, time_in, time_out, device_used, ip_address, metadata, created_at
     FROM audit_logs
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  res.json({ logs: result.rows });
}));
