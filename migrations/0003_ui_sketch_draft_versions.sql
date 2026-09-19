CREATE TABLE ui_sketch_draft_versions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  draft_json TEXT NOT NULL CHECK (json_valid(draft_json)),
  created_at TEXT NOT NULL,
  UNIQUE (session_id, revision),
  FOREIGN KEY (session_id) REFERENCES ui_sessions(session_id) ON DELETE CASCADE
) STRICT;

CREATE INDEX ui_sketch_draft_versions_session_created_idx
  ON ui_sketch_draft_versions (session_id, revision DESC);
