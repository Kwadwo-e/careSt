import * as XLSX from 'xlsx';

export const buildSubmissionWorkbook = (rows) => {
  const data = rows.map((row) => ({
    'Name of student': row.student_name,
    'Index number': row.index_number,
    Supervisor: row.supervisor_name || '',
    'Date and time of submission': row.submitted_at,
    'Attached PDF name': row.original_name
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Care Study Submissions');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};
