CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'core_user_role') THEN
    CREATE TYPE core_user_role AS ENUM ('administrator', 'student', 'supervisor');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'core_user_status') THEN
    CREATE TYPE core_user_status AS ENUM ('pending', 'accepted', 'rejected', 'disabled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'core_submission_status') THEN
    CREATE TYPE core_submission_status AS ENUM ('draft', 'submitted', 'resubmitted', 'locked');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role core_user_role NOT NULL,
  full_name TEXT NOT NULL,
  username TEXT UNIQUE,
  index_number TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  status core_user_status NOT NULL DEFAULT 'pending',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_identifier_by_role CHECK (
    (role = 'student' AND index_number IS NOT NULL)
    OR (role IN ('administrator', 'supervisor') AND username IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS administrators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  admin_level TEXT NOT NULL DEFAULT 'super_admin',
  can_manage_users BOOLEAN NOT NULL DEFAULT true,
  can_manage_settings BOOLEAN NOT NULL DEFAULT true,
  can_export_submissions BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students_core (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  index_number TEXT NOT NULL UNIQUE,
  supervisor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  supervisor_status core_user_status NOT NULL DEFAULT 'pending',
  resubmission_allowed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT students_supervisor_must_be_supervisor CHECK (supervisor_user_id IS NULL OR supervisor_user_id <> user_id)
);

CREATE TABLE IF NOT EXISTS submissions_core (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supervisor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status core_submission_status NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_original_name TEXT NOT NULL,
  pdf_stored_name TEXT NOT NULL,
  pdf_mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  pdf_size_bytes BIGINT NOT NULL CHECK (pdf_size_bytes >= 0),
  pdf_storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_core_one_locked_per_student
  ON submissions_core(student_user_id)
  WHERE status IN ('submitted', 'locked');

CREATE TABLE IF NOT EXISTS audit_logs_core (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_role core_user_role,
  user_name TEXT,
  identifier TEXT,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'success',
  login_date DATE DEFAULT CURRENT_DATE,
  time_in TIMESTAMPTZ,
  time_out TIMESTAMPTZ,
  device_used TEXT,
  ip_address INET,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  submissions_open_at TIMESTAMPTZ,
  submissions_close_at TIMESTAMPTZ,
  allow_student_file_view BOOLEAN NOT NULL DEFAULT false,
  allow_global_resubmission BOOLEAN NOT NULL DEFAULT false,
  login_notice TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_system_settings_row CHECK (id = true)
);

INSERT INTO system_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_students_core_supervisor ON students_core(supervisor_user_id, supervisor_status);
CREATE INDEX IF NOT EXISTS idx_submissions_core_submitted_at ON submissions_core(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_core_user ON audit_logs_core(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_core_action ON audit_logs_core(action, outcome, created_at DESC);
