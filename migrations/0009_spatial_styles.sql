-- Rebuild the category constraint while keeping foreign keys enabled. Dropping
-- the old parent cascades its references and clears bindings; restore both
-- inside the migration transaction without changing session revisions.
CREATE TEMP TABLE spatial_style_references AS SELECT * FROM style_reference_images;
CREATE TEMP TABLE spatial_style_bindings AS
  SELECT id, style_id FROM sessions WHERE style_id IS NOT NULL;

CREATE TABLE style_entries_with_spatial (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  category TEXT NOT NULL CHECK (category IN ('visual', 'ui', 'spatial')),
  creator_type TEXT NOT NULL CHECK (creator_type IN ('user', 'agent')),
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  prompt_summary TEXT
) STRICT;

INSERT INTO style_entries_with_spatial SELECT * FROM style_entries;
DROP TABLE style_entries;
ALTER TABLE style_entries_with_spatial RENAME TO style_entries;
CREATE INDEX style_entries_updated_idx ON style_entries (updated_at DESC, id);

INSERT INTO style_reference_images SELECT * FROM spatial_style_references;
UPDATE sessions
SET style_id = (SELECT style_id FROM spatial_style_bindings WHERE id = sessions.id)
WHERE id IN (SELECT id FROM spatial_style_bindings);

DROP TABLE spatial_style_references;
DROP TABLE spatial_style_bindings;
