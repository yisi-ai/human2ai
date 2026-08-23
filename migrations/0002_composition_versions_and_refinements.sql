CREATE TABLE composition_draft_versions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  fingerprint TEXT NOT NULL,
  draft_json TEXT NOT NULL CHECK (json_valid(draft_json)),
  created_at TEXT NOT NULL,
  UNIQUE (session_id, revision),
  FOREIGN KEY (session_id) REFERENCES composition_sessions(session_id) ON DELETE CASCADE
) STRICT;

CREATE INDEX composition_draft_versions_session_created_idx
  ON composition_draft_versions (session_id, revision DESC);

CREATE TABLE composition_refinement_runs (
  id TEXT PRIMARY KEY,
  source_draft_version_id TEXT NOT NULL,
  plan_json TEXT NOT NULL CHECK (json_valid(plan_json)),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (source_draft_version_id)
    REFERENCES composition_draft_versions(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX composition_refinement_runs_source_created_idx
  ON composition_refinement_runs (source_draft_version_id, created_at DESC);
