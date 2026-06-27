import express from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, normalizeDecision } from '../utils/http.js';
import { recordAudit } from '../services/audit.service.js';
import { buildSubmissionWorkbook } from '../services/export.service.js';

export const supervisorRouter = express.Router();

supervisorRouter.use(requireAuth('supervisor'));

supervisorRouter.get('/students/pending', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, full_name, index_number, account_status, supervisor_status, created_at
     FROM students
     WHERE supervisor_id = $1 AND account_status = 'accepted' AND supervisor_status = 'pending' AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [req.user.sub]
  );
  res.json({ students: result.rows });
}));

supervisorRouter.patch('/students/:id/decision', asyncHandler(async (req, res) => {
  const decision = normalizeDecision(req.body.decision);
  const result = await query(
    `UPDATE students
     SET supervisor_status = $1, updated_at = now()
     WHERE id = $2 AND supervisor_id = $3 AND deleted_at IS NULL
     RETURNING id, full_name, index_number, supervisor_status`,
    [decision, req.params.id, req.user.sub]
  );

  if (result.rowCount === 0) {
    throw new HttpError(404, 'Student was not found in your supervisor group.');
  }

  const student = result.rows[0];
  await recordAudit({
    req,
    userType: 'supervisor',
    userId: req.user.sub,
    name: req.user.name,
    identifier: req.user.identifier,
    action: `${decision}_student`,
    outcome: 'success',
    metadata: {
      studentId: student.id,
      studentName: student.full_name,
      indexNumber: student.index_number
    }
  });

  res.json({ student });
}));

supervisorRouter.get('/students/assigned', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT s.id, s.full_name, s.index_number, s.account_status, s.supervisor_status,
            sub.id AS submission_id, sub.submitted_at, f.id AS file_id, f.original_name, f.size_bytes
     FROM students s
     LEFT JOIN submissions sub ON sub.student_id = s.id
     LEFT JOIN uploaded_files f ON f.id = sub.pdf_file_id
     WHERE s.supervisor_id = $1 AND s.deleted_at IS NULL
     ORDER BY s.full_name ASC`,
    [req.user.sub]
  );
  res.json({ students: result.rows });
}));

supervisorRouter.get('/submissions/export', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT s.full_name AS student_name, s.index_number, sup.full_name AS supervisor_name,
            sub.submitted_at, f.original_name
     FROM submissions sub
     JOIN students s ON s.id = sub.student_id
     LEFT JOIN supervisors sup ON sup.id = sub.supervisor_id
     JOIN uploaded_files f ON f.id = sub.pdf_file_id
     WHERE sub.supervisor_id = $1
     ORDER BY sub.submitted_at DESC`,
    [req.user.sub]
  );

  const workbook = buildSubmissionWorkbook(result.rows);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="care-study-submissions.xlsx"');
  res.send(workbook);
}));
