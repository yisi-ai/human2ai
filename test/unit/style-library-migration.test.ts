import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

import { applyMigrations, openDatabase } from "../../src/database/migrate.ts";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.ts";
import { SpatialSessionRepository } from "../../src/database/spatial-session-repository.ts";
import { StyleLibraryRepository } from "../../src/database/style-library-repository.ts";
import { createSpatialDraft } from "../../src/domain/spatial/index.ts";

it("upgrades style categories while preserving references, session bindings and spatial history", async () => {
  const directory = mkdtempSync(join(tmpdir(), "human2ai-style-upgrade-"));
  for (const name of readdirSync(resolve("migrations")).filter(name => name.endsWith(".sql") && name < "0009")) {
    copyFileSync(join("migrations", name), join(directory, name));
  }
  const database = openDatabase(":memory:", directory);
  try {
    const styles = new StyleLibraryRepository(database, join(directory, "artifacts"));
    const sessions = new ProjectSessionRepository(database);
    const spatial = new SpatialSessionRepository(database);
    const style = styles.createStyle({ name: "Quiet", category: "visual", creatorType: "user", description: "Matte surfaces.", promptSummary: "Soft matte forms." });
    const otherStyle = styles.createStyle({ name: "UI", category: "ui", creatorType: "agent", description: "Quiet controls." });
    const reference = await styles.addReferenceImage(style.id, {
      expectedRevision: 1, filename: "reference.png",
      data: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    });
    for (const sessionType of ["image-composition", "ui-layout", "spatial"] as const) {
      const session = sessions.createSession({ sessionType, title: sessionType });
      styles.bindSessionStyle(session.id, { styleId: style.id, expectedRevision: 1 });
      if (sessionType === "spatial") spatial.createDraftVersion(session.id, { expectedLatestRevision: 0, draft: createSpatialDraft() });
    }
    sessions.createSession({ sessionType: "spatial", title: "Unbound" });
    const tables = ["style_entries", "style_reference_images", "sessions", "spatial_draft_versions"];
    const before = tables.map(table => database.prepare(`SELECT * FROM ${table} ORDER BY id`).all());

    expect(applyMigrations(database, resolve("migrations"))).toContain("0009_spatial_styles.sql");
    expect(tables.map(table => database.prepare(`SELECT * FROM ${table} ORDER BY id`).all())).toEqual(before);
    expect(styles.getStyle(style.id)).toEqual(reference);
    expect(styles.getStyle(otherStyle.id)).toEqual(otherStyle);
    expect(styles.getReferenceImage(style.id, reference.referenceImages[0].id).reference).toEqual(reference.referenceImages[0]);
    expect(database.pragma("foreign_key_check")).toEqual([]);
    expect(database.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(applyMigrations(database, resolve("migrations"))).toEqual([]);

    expect(styles.createStyle({ name: "3D", category: "spatial", creatorType: "agent", description: "Low-poly geometry." })).toMatchObject({ category: "spatial" });
    expect(() => database.prepare("UPDATE style_entries SET category = 'unsupported' WHERE id = ?").run(style.id)).toThrow();
    await styles.deleteStyle(style.id, { expectedRevision: reference.revision });
    expect(database.prepare("SELECT * FROM style_reference_images").all()).toEqual([]);
    expect(database.prepare("SELECT * FROM sessions WHERE style_id IS NOT NULL").all()).toEqual([]);
    expect(database.prepare("SELECT * FROM spatial_draft_versions").all()).toHaveLength(1);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
