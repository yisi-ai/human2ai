ALTER TABLE sessions ADD COLUMN deleted_at TEXT;
CREATE INDEX sessions_deleted_at ON sessions(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TABLE workspace_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  image_retention_days INTEGER NOT NULL CHECK (image_retention_days BETWEEN 1 AND 3650),
  history_retention_days INTEGER NOT NULL CHECK (history_retention_days BETWEEN 1 AND 3650),
  trash_retention_days INTEGER NOT NULL CHECK (trash_retention_days BETWEEN 1 AND 3650)
) STRICT;
INSERT INTO workspace_settings VALUES (1, 1, 1, 7, 7);
