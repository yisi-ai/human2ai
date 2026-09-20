CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE session_types (
  code TEXT PRIMARY KEY
) STRICT;

INSERT INTO session_types (code)
VALUES ('image-composition'), ('ui-layout');

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  session_type TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  lifecycle_stage TEXT NOT NULL DEFAULT 'draft'
    CHECK (lifecycle_stage IN ('draft', 'interpreted', 'approved', 'exported')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (session_type) REFERENCES session_types(code)
) STRICT;

CREATE INDEX sessions_project_updated_idx
  ON sessions (project_id, updated_at DESC);

CREATE INDEX sessions_type_updated_idx
  ON sessions (session_type, updated_at DESC);

CREATE TABLE composition_sessions (
  session_id TEXT PRIMARY KEY,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE ui_sessions (
  session_id TEXT PRIMARY KEY,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) STRICT;
