CREATE TABLE session_groups (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  UNIQUE (project_id, name)
) STRICT;

CREATE TABLE session_group_members (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES session_groups(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX session_group_members_group_idx ON session_group_members(group_id);

CREATE TRIGGER clear_session_group_on_project_move
AFTER UPDATE OF project_id ON sessions
WHEN OLD.project_id IS NOT NEW.project_id
BEGIN
  DELETE FROM session_group_members WHERE session_id = NEW.id;
END;
