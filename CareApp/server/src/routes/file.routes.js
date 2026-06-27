import express from 'express';
import path from 'node:path';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/http.js';

export const fileRouter = express.Router();

fileRouter.use(requireAuth(['student', 'supervisor', 'admin']));

const loadFileForUser = async (req) => {
  const result = await query(
    `SELECT f.*, s.full_name AS student_name, s.index_number
     FROM uploaded_files f
     JOIN students s ON s.id = f.student_id
     WHERE f.id = $1`,
    [req.params.id]
  );

  if (result.rowCount === 0) throw new HttpError(404, 'PDF file was not found.');
  const file = result.rows[0];

  if (req.user.role === 'admin') return file;
  if (req.user.role === 'supervisor' && file.supervisor_id === req.user.sub) return file;

  if (req.user.role === 'student' && file.student_id === req.user.sub) {
    const settings = await query('SELECT allow_student_file_view FROM app_settings WHERE id = true');
    if (settings.rows[0]?.allow_student_file_view) return file;
    throw new HttpError(403, 'Students can see the submitted file name, but file opening is disabled.');
  }

  throw new HttpError(403, 'You do not have access to this PDF file.');
};

fileRouter.get('/:id/view', asyncHandler(async (req, res) => {
  const file = await loadFileForUser(req);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
  res.sendFile(path.resolve(file.storage_path));
}));

fileRouter.get('/:id/download', asyncHandler(async (req, res) => {
  const file = await loadFileForUser(req);
  res.download(path.resolve(file.storage_path), file.original_name);
}));
