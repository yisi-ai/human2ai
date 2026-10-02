CREATE TABLE ui_sketch_png_splits (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  record_json TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) STRICT;
