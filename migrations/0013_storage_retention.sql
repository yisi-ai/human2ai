ALTER TABLE image_assets ADD COLUMN unreferenced_since TEXT;
ALTER TABLE image_assets ADD COLUMN deleting INTEGER NOT NULL DEFAULT 0 CHECK (deleting IN (0, 1));
ALTER TABLE image_assets ADD COLUMN preview_reference_json TEXT;
CREATE INDEX image_assets_sha256 ON image_assets(sha256);

-- Existing destination-owned previews remain verifiable after source history expires.
UPDATE image_assets AS asset SET preview_reference_json = previews.reference
FROM (
  SELECT versions.session_id, json_extract(image.value, '$.assetId') AS asset_id,
    json_extract(image.value, '$.previewReference') AS reference,
    row_number() OVER (PARTITION BY versions.session_id, json_extract(image.value, '$.assetId') ORDER BY versions.revision) AS first_reference
  FROM ui_sketch_draft_versions versions, json_each(versions.draft_json, '$.images') image
  WHERE json_type(image.value, '$.previewReference') = 'object'
) previews
WHERE previews.first_reference = 1 AND previews.session_id = asset.session_id AND previews.asset_id = asset.id;

ALTER TABLE ui_sketch_png_splits ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
UPDATE ui_sketch_png_splits SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

CREATE TABLE session_storage_protections (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  revisions_json TEXT NOT NULL,
  asset_ids_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (session_id, client_id)
) STRICT;

CREATE TABLE storage_orphan_files (
  relative_path TEXT PRIMARY KEY,
  unreferenced_since TEXT NOT NULL
) STRICT;

-- Cascading session/project deletion must not lose the paths of source files.
CREATE TRIGGER image_asset_file_removed AFTER DELETE ON image_assets BEGIN
  INSERT OR IGNORE INTO storage_orphan_files VALUES (OLD.relative_path, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER style_image_file_removed AFTER DELETE ON style_reference_images BEGIN
  INSERT OR IGNORE INTO storage_orphan_files VALUES (OLD.relative_path, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER style_model_file_removed AFTER DELETE ON style_preview_models BEGIN
  INSERT OR IGNORE INTO storage_orphan_files VALUES (OLD.relative_path, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
