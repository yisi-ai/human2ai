CREATE TABLE image_assets_with_svg (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  relative_path TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) STRICT;

INSERT INTO image_assets_with_svg SELECT * FROM image_assets;
DROP TABLE image_assets;
ALTER TABLE image_assets_with_svg RENAME TO image_assets;
CREATE INDEX image_assets_session_created_idx
  ON image_assets (session_id, created_at DESC);
