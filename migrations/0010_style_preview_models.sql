CREATE TABLE style_preview_models (
  style_id TEXT PRIMARY KEY REFERENCES style_entries(id) ON DELETE CASCADE,
  id TEXT NOT NULL UNIQUE,
  relative_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  created_at TEXT NOT NULL
) STRICT;
