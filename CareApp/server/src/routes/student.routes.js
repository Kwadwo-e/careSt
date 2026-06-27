import express from 'express';
import { query, transaction } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { pdfUpload } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/http.js';
import { recordAudit } from '../services/audit.service.js';

export const studentRouter = express.Router();

studentRouter.use(requireAuth('student'));

const getSettings = async (runner = { query }) => {
  const result = await runner.query('SELECT * FROM app_settings WHERE id = true');
  return result.rows[0];
};

const assertSubmissionWindow = (settings) => {
  const now = new Date();
  if (settings.submissions_open_at && now < new Date(settings.submissions_open_at)) {
    throw new HttpError(403, 'Care study submission is not open yet.');
  }
  if (settings.submissions_close_at && now > new Date(settings.submissions_close_at)) {
    throw new HttpError(403, 'Care study submission is closed.');
  }
};

studentRouter.get('/profile', asyncHandler(async (req, res) => {
  const studentResult = await query(
    `SELECT s.id, s.full_name, s.index_number, s.account_status, s.supervisor_status,
            s.resubmission_allowed, sup.full_name AS supervisor_name
     FROM students s
     LEFT JOIN supervisors sup ON sup.id = s.supervisor_id
     WHERE s.id = $1 AND s.deleted_at IS NULL`,
    [req.user.sub]
  );

  if (studentResult.rowCount === 0) {
    throw new HttpError(404, 'Student profile was not found.');
  }

  const submissionResult = await query(
    `SELECT sub.id, sub.student_entered_at, sub.submitted_at,
            f.id AS file_id, f.original_name, f.size_bytes
     FROM submissions sub
     JOIN uploaded_files f ON f.id = sub.pdf_file_id
     WHERE sub.student_id = $1`,
    [req.user.sub]
  );

  const settings = await getSettings();
  const student = studentResult.rows[0];
  const hasSubmission = submissionResult.rowCount > 0;
  const mayResubmit = settings.allow_global_resubmission || student.resubmission_allowed;

  res.json({
    student,
    settings,
    submission: submissionResult.rows[0] || null,
    permissions: {
      canSubmit: !hasSubmission || mayResubmit,
      canViewOwnPdf: settings.allow_student_file_view
    }
  });
}));

studentRouter.post('/submission', pdfUpload.single('pdf'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new HttpError(400, 'A PDF file is required.');
  }

  const result = await transaction(async (client) => {
    const studentResult = await client.query(
      `SELECT id, full_name, index_number, supervisor_id, account_status, supervisor_status, resubmission_allowed
       FROM students
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [req.user.sub]
    );

    const student = studentResult.rows[0];
    if (!student) throw new HttpError(404, 'Student profile was not found.');
    if (student.account_status !== 'accepted') throw new HttpError(403, 'Student account is not accepted.');
    if (student.supervisor_id && student.supervisor_status !== 'accepted') {
      throw new HttpError(403, 'Supervisor acceptance is required before submission.');
    }

    const settings = await getSettings(client);
    assertSubmissionWindow(settings);

    const existing = await client.query('SELECT id FROM submissions WHERE student_id = $1', [student.id]);
    const mayResubmit = settings.allow_global_resubmission || student.resubmission_allowed;
    if (existing.rowCount > 0 && !mayResubmit) {
      throw new HttpError(409, 'A care study has already been submitted. Resubmission is disabled.');
    }

    const fileResult = await client.query(
      `INSERT INTO uploaded_files
        (student_id, supervisor_id, original_name, stored_name, mime_type, size_bytes, storage_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, original_name, size_bytes, uploaded_at`,
      [
        student.id,
        student.supervisor_id,
        req.file.originalname,
        req.file.filename,
        req.file.mimetype,
        req.file.size,
        req.file.path
      ]
    );

    const studentEnteredAt = new Date();
    let submission;

    if (existing.rowCount > 0) {
      const updated = await client.query(
        `UPDATE submissions
         SET pdf_file_id = $1, supervisor_id = $2, student_entered_at = $3, submitted_at = now(), updated_at = now()
         WHERE student_id = $4
         RETURNING id, submitted_at`,
        [fileResult.rows[0].id, student.supervisor_id, studentEnteredAt, student.id]
      );
      submission = updated.rows[0];
    } else {
      const inserted = await client.query(
        `INSERT INTO submissions (student_id, supervisor_id, pdf_file_id, student_entered_at)
         VALUES ($1,$2,$3,$4)
         RETURNING id, submitted_at`,
        [student.id, student.supervisor_id, fileResult.rows[0].id, studentEnteredAt]
      );
      submission = inserted.rows[0];
    }

    await client.query('UPDATE uploaded_files SET submission_id = $1 WHERE id = $2', [
      submission.id,
      fileResult.rows[0].id
    ]);

    await recordAudit({
      client,
      req,
      userType: 'student',
      userId: student.id,
      name: student.full_name,
      identifier: student.index_number,
      action: 'submit_care_study',
      outcome: 'success',
      metadata: {
        submissionId: submission.id,
        fileName: req.file.originalname
      }
    });

    return { submission, file: fileResult.rows[0] };
  });

  res.status(201).json({
    message: 'Care study submitted successfully.',
    ...result
  });
}));
