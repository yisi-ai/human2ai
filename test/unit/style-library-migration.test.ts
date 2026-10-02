import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

import { applyMigrations, openDatabase } from "../../src/database/migrate.ts";
import { StyleLibraryRepository } from "../../src/database/style-library-repository.ts";
import { createSpatialDraft } from "../../src/domain/spatial/index.ts";

it("upgrades style categories while preserving references, session bindings and spatial history", async () => {
  const directory = mkdtempSync(join(tmpdir(), "human2ai-style-upgrade-"));
  for (const name of readdirSync(resolve("migrations")).filter(name => name.endsWith(".sql") && name < "0009")) {
    copyFileSync(join("migrations", name), join(directory, name));
  }
  const database = openDatabase(":memory:", directory);
  try {
    const seedSession = (sessionType: "image-composition" | "ui-layout" | "spatial", id: string) => {
      database.prepare("INSERT INTO sessions (id, session_type, title, lifecycle_stage, revision, created_at, updated_at) VALUES (?, ?, ?, 'draft', 1, ?, ?)").run(id, sessionType, id, timestamp, timestamp);
      const table = sessionType === "image-composition" ? "composition_sessions" : sessionType === "ui-layout" ? "ui_sessions" : "spatial_sessions";
      database.prepare(`INSERT INTO ${table} (session_id) VALUES (?)`).run(id);
      return { id };
    };
    const style = { id: "old-visual" };
    const otherStyle = { id: "old-ui" };
    const timestamp = "2026-09-01T00:00:00.000Z";
    database.prepare(`INSERT INTO style_entries (id, name, category, creator_type, description, prompt_summary, revision, created_at, updated_at)
      VALUES (?, ?, ?, 'user', 'Matte surfaces.', 'Soft matte forms.', ?, ?, ?)`)
      .run(style.id, "Quiet", "visual", 2, timestamp, timestamp);
    database.prepare(`INSERT INTO style_entries (id, name, category, creator_type, description, revision, created_at, updated_at)
      VALUES (?, 'UI', 'ui', 'agent', 'Quiet controls.', 1, ?, ?)`)
      .run(otherStyle.id, timestamp, timestamp);
    mkdirSync(join(directory, "artifacts", "styles", style.id), { recursive: true });
    writeFileSync(join(directory, "artifacts", "styles", style.id, "reference.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
    database.prepare(`INSERT INTO style_reference_images (id, style_id, relative_path, original_filename, mime_type, byte_size, width, height, position, created_at)
      VALUES ('old-reference', ?, ?, 'reference.png', 'image/png', 68, 1, 1, 0, ?)`)
      .run(style.id, `styles/${style.id}/reference.png`, timestamp);
    for (const sessionType of ["image-composition", "ui-layout", "spatial"] as const) {
      const session = seedSession(sessionType, `legacy-${sessionType}`);
      database.prepare("UPDATE sessions SET style_id = ?, revision = revision + 1 WHERE id = ?").run(style.id, session.id);
      if (sessionType === "spatial") database.prepare(`INSERT INTO spatial_draft_versions (id, session_id, revision, draft_json, created_at)
        VALUES ('old-spatial-draft', ?, 1, ?, ?)`).run(session.id, JSON.stringify(createSpatialDraft()), timestamp);
    }
    seedSession("spatial", "unbound");
    const tables = ["style_entries", "style_reference_images", "sessions", "spatial_draft_versions"];
    const before = tables.map(table => database.prepare(`SELECT * FROM ${table} ORDER BY id`).all().map(row => table === "sessions" ? { ...row as Record<string, unknown>, deleted_at: null } : row));

    expect(applyMigrations(database, resolve("migrations"))).toContain("0009_spatial_styles.sql");
    expect(tables.map(table => database.prepare(`SELECT * FROM ${table} ORDER BY id`).all())).toEqual(before);
    const styles = new StyleLibraryRepository(database, join(directory, "artifacts"));
    expect(styles.getStyle(style.id)).toMatchObject({ id: style.id, revision: 2, referenceImages: [{ id: "old-reference" }] });
    expect(styles.getStyle(style.id).previewModel).toBeUndefined();
    expect(styles.getStyle(otherStyle.id)).toMatchObject({ id: otherStyle.id, revision: 1 });
    expect(styles.getReferenceImage(style.id, "old-reference").reference.id).toBe("old-reference");
    expect(database.pragma("foreign_key_check")).toEqual([]);
    expect(database.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(applyMigrations(database, resolve("migrations"))).toEqual([]);

    expect(styles.createStyle({ name: "3D", category: "spatial", creatorType: "agent", description: "Low-poly geometry." })).toMatchObject({ category: "spatial" });
    expect(() => database.prepare("UPDATE style_entries SET category = 'unsupported' WHERE id = ?").run(style.id)).toThrow();
    await styles.deleteStyle(style.id, { expectedRevision: 2 });
    expect(database.prepare("SELECT * FROM style_reference_images").all()).toEqual([]);
    expect(database.prepare("SELECT * FROM sessions WHERE style_id IS NOT NULL").all()).toEqual([]);
    expect(database.prepare("SELECT * FROM spatial_draft_versions").all()).toHaveLength(1);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
