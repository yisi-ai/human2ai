CREATE TABLE style_entries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  category TEXT NOT NULL CHECK (category IN ('visual', 'ui')),
  creator_type TEXT NOT NULL CHECK (creator_type IN ('user', 'agent')),
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX style_entries_updated_idx
  ON style_entries (updated_at DESC, id);

CREATE TABLE style_reference_images (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL,
  relative_path TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (style_id, position),
  FOREIGN KEY (style_id) REFERENCES style_entries(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX style_reference_images_style_position_idx
  ON style_reference_images (style_id, position);
