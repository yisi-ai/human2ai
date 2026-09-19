ALTER TABLE style_entries ADD COLUMN prompt_summary TEXT;
ALTER TABLE sessions ADD COLUMN style_id TEXT REFERENCES style_entries(id) ON DELETE SET NULL;
CREATE INDEX sessions_style_idx ON sessions(style_id);

ALTER TABLE composition_draft_versions ADD COLUMN style_processing_json TEXT;
ALTER TABLE ui_sketch_draft_versions ADD COLUMN style_processing_json TEXT;
