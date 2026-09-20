INSERT INTO session_types (code) VALUES ('spatial');

CREATE TABLE spatial_sessions (
  session_id TEXT PRIMARY KEY,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE spatial_draft_versions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  draft_json TEXT NOT NULL CHECK (json_valid(draft_json)),
  created_at TEXT NOT NULL,
  style_processing_json TEXT CHECK (style_processing_json IS NULL OR json_valid(style_processing_json)),
  UNIQUE (session_id, revision),
  FOREIGN KEY (session_id) REFERENCES spatial_sessions(session_id) ON DELETE CASCADE
) STRICT;

CREATE INDEX spatial_draft_versions_session_revision_idx
  ON spatial_draft_versions (session_id, revision DESC);
