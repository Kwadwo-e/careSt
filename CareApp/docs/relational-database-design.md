# Relational Database Design

This is the requested logical database design for CareApp. The SQL implementation is in `database/migrations/002_relational_core_design.sql`, while the current app-compatible operational tables remain in `database/migrations/001_init.sql`.

## Tables

| Table | Primary Key | Main Fields | Relationships |
| --- | --- | --- | --- |
| `users` | `id` | `role`, `full_name`, `username`, `index_number`, `password_hash`, `status`, `last_login_at` | Parent identity table for administrators, students, and supervisors. |
| `administrators` | `id` | `user_id`, `admin_level`, `can_manage_users`, `can_manage_settings`, `can_export_submissions` | One administrator profile belongs to one `users` row. |
| `students` | `id` | `user_id`, `index_number`, `supervisor_user_id`, `supervisor_status`, `resubmission_allowed` | One student profile belongs to one `users` row; supervisor assignment references a supervisor user. |
| `submissions` | `id` | `student_user_id`, `supervisor_user_id`, `status`, `submitted_at`, PDF metadata and storage path | One student can have one locked/submitted care-study PDF unless resubmission is enabled. |
| `audit_logs` | `id` | `user_id`, `user_role`, `action`, `outcome`, `login_date`, `time_in`, `time_out`, `device_used`, `ip_address`, `metadata` | Tracks logins, failed attempts, submissions, approvals, rejections, settings changes, and exports. |
| `system_settings` | `id` | `submissions_open_at`, `submissions_close_at`, `allow_student_file_view`, `allow_global_resubmission`, `login_notice`, `updated_by` | Singleton settings row controlled by administrators. |

## Rules

- Every login-capable person is represented in `users`.
- Students cannot log in until accepted, assigned to a supervisor, and accepted by that supervisor.
- Submission date/time is created by the server when the PDF is submitted.
- Audit logs retain device and IP details for student, supervisor, and administrator activity.
- System settings control opening/closing time, PDF visibility, and resubmission.
