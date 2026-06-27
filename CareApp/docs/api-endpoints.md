# REST API Endpoints

Base URL: `/api`

## Authentication

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/auth/student/register` | Register student full name, index number, and password. |
| `POST` | `/auth/student/login` | Student login after administrator approval, supervisor assignment, and supervisor acceptance. |
| `POST` | `/auth/supervisor/register` | Register academic supervisor. |
| `POST` | `/auth/supervisor/login` | Supervisor login using full name and password. |
| `POST` | `/auth/admin/login` | Super administrator login. |
| `POST` | `/auth/logout` | Record logout activity. |
| `GET` | `/auth/me` | Return current JWT user. |

## Public App Info

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/network-info` | Return the LAN-friendly app URL used by the landing-page QR code. |

## Student

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/student/profile` | Get student profile, supervisor name, settings, and submission status. |
| `POST` | `/student/submission` | Upload one PDF care-study submission. |

## Supervisor

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/supervisor/students/pending` | List students awaiting supervisor decision. |
| `PATCH` | `/supervisor/students/:id/decision` | Accept or reject a student in the supervisor group. |
| `GET` | `/supervisor/students/assigned` | List assigned students and submission/file metadata. |
| `GET` | `/supervisor/submissions/export` | Download Excel export for supervisor's submitted students. |

## Administrator

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/admin/users` | List all students and supervisors. |
| `GET` | `/admin/pending-users` | List users waiting for super administrator approval. |
| `PATCH` | `/admin/users/:role/:id/status` | Accept or reject student/supervisor account. |
| `PUT` | `/admin/users/:role/:id` | Modify names, index numbers, passwords, supervisor assignment, and group codes. |
| `PATCH` | `/admin/students/:id/resubmission` | Allow or block a student resubmission. |
| `GET` | `/admin/settings` | Read system settings. |
| `PATCH` | `/admin/settings` | Set opening/closing date/time and file/submission controls. |
| `GET` | `/admin/files` | List all uploaded PDF files. |
| `GET` | `/admin/submissions/export` | Download Excel export for all successful submissions. |
| `GET` | `/admin/audit-logs` | View login/activity logs. |

## Files

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/files/:id/view` | Display PDF inside the browser when role is permitted. |
| `GET` | `/files/:id/download` | Download PDF when role is permitted. |
