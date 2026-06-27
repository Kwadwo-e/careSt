# Database Schema

The operational schema is defined in `database/migrations/001_init.sql` with follow-up migrations in the same folder. The complete relational core design requested for long-term production normalization is in `database/migrations/002_relational_core_design.sql`.

## Tables

### Relational Core Design

| Table | Purpose |
| --- | --- |
| `users` | Unified identity table for administrators, students, and supervisors, with role, credentials, status, and login timestamps. |
| `administrators` | Administrator profile and permissions linked one-to-one to `users`. |
| `students_core` | Student academic profile, index number, supervisor assignment, and resubmission control linked one-to-one to `users`. |
| `submissions_core` | Care-study PDF submission records linked to student and supervisor users. |
| `audit_logs_core` | Login and activity records tied back to `users`. |
| `system_settings` | Opening/closing windows, resubmission controls, file-view controls, and login notices. |

### Current App Tables

| Table | Purpose |
| --- | --- |
| `admins` | Super administrator credentials and profile. |
| `supervisors` | Academic supervisor accounts, group codes, approval state, and soft-delete metadata. |
| `students` | Student accounts, index numbers, supervisor assignment, approval state, resubmission flag, and soft-delete metadata. |
| `app_settings` | Opening/closing dates, student file-view permission, global resubmission permission, admin notice. |
| `uploaded_files` | PDF metadata and server storage paths. |
| `submissions` | One active care-study submission per student. |
| `audit_logs` | Login/activity records for candidates, supervisors, and administrators. |

## Key Relationships

- One `users` row represents each person who can log in.
- One administrator profile links to one `users` row.
- One student profile links to one `users` row.
- One supervisor user can be assigned to many students.
- One student can have one locked/submitted care-study record unless resubmission is enabled.
- Audit logs reference the acting `users` row when available.

## Approval Model

- Supervisors and students start with pending status.
- Super administrator changes status to accepted, rejected, disabled, or pending.
- Students assigned to a supervisor also carry `supervisor_status`.
- Students can log in and submit only after account acceptance, supervisor assignment, and supervisor acceptance.

## User Deletion And Record Retention

- Super administrators delete students and supervisors through a soft-delete/archive action.
- Deleted users are hidden from normal user management and cannot log in.
- Uploaded PDF rows, submission rows, audit logs, and stored PDF files are retained for records.
- Restoring/retaining a deleted user clears the soft-delete metadata and returns the user to active management.
