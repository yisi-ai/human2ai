import { mkdtemp, readFile, rm, writeFile, mkdir, chmod, readdir, copyFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDatabase, applyMigrations, type DatabaseConnection } from "../../src/database/migrate.ts";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.ts";
import { CompositionSessionRepository } from "../../src/database/composition-session-repository.ts";
import { UiSketchSessionRepository } from "../../src/database/ui-sketch-session-repository.ts";
import { SpatialSessionRepository } from "../../src/database/spatial-session-repository.ts";
import { ImageAssetRepository } from "../../src/database/image-asset-repository.ts";
import { SessionStorageRepository } from "../../src/database/session-storage-repository.ts";
import { createDraft, addCompositionImage } from "../../src/domain/composition/index.ts";
import { createUiSketchDraft } from "../../src/domain/ui-sketch/index.ts";
import { createSpatialDraft } from "../../src/domain/spatial/index.ts";
import { applySpatialOperations, type SpatialOperation } from "../../src/domain/spatial/index.ts";
import { CanvasEditHistory } from "../../src/domain/session/canvas-edit-history.ts";
import { SpatialEditQueue } from "../../web/lib/spatial-edit-queue.ts";
import { UiSketchPngSplitRepository } from "../../src/database/ui-sketch-png-split-repository.ts";
import sharp from "sharp";
import { createHuman2AiServer } from "../../src/server/runtime.ts";
import { StyleLibraryRepository } from "../../src/database/style-library-repository.ts";

const day = 86_400_000;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
let directory: string, database: DatabaseConnection;
afterEach(async () => { vi.restoreAllMocks(); database?.close(); if (directory) await rm(directory, { recursive: true, force: true }); });

async function fixture() {
  directory = await mkdtemp(join(tmpdir(), "h2a-storage-"));
  const root = join(directory, "artifacts");
  database = openDatabase(join(directory, "test.db"), resolve("migrations"));
  const projects = new ProjectSessionRepository(database), assets = new ImageAssetRepository(database, root);
  let now = Date.now();
  const storage = new SessionStorageRepository(database, assets, root, () => now);
  return { projects, assets, storage, root, advance: (ms: number) => { now += ms; } };
}

describe.each([
  { type: "image-composition" as const, table: "composition_draft_versions", repository: (db: DatabaseConnection) => new CompositionSessionRepository(db), draft: createDraft },
  { type: "ui-layout" as const, table: "ui_sketch_draft_versions", repository: (db: DatabaseConnection) => new UiSketchSessionRepository(db), draft: createUiSketchDraft },
  { type: "spatial" as const, table: "spatial_draft_versions", repository: (db: DatabaseConnection) => new SpatialSessionRepository(db), draft: createSpatialDraft },
])("$type storage retention", ({ type, table, repository, draft }) => {
  it("bounds full snapshots, preserves pinned revisions, expires them after release and never reuses revision numbers", async () => {
    const f = await fixture(), session = f.projects.createSession({ title: type, sessionType: type }), versions = repository(database);
    versions.createDraftVersion(session.id, { expectedLatestRevision: 0, draft: draft() });
    f.storage.protect(session.id, "editor", { revisions: [1], assetIds: [] });
    for (let revision = 1; revision < 130; revision++) versions.createDraftVersion(session.id, { expectedLatestRevision: revision, draft: draft() });
    expect(versions.listDraftVersions(session.id).map(v => v.revision)).toEqual([1, ...Array.from({ length: 100 }, (_, i) => i + 31)]);
    f.storage.release(session.id, "editor");
    await f.storage.collect(session.id);
    expect(versions.listDraftVersions(session.id)).toHaveLength(100);
    expect(() => versions.getDraftVersion(session.id, 1)).toThrow(expect.objectContaining({ code: "DRAFT_VERSION_EXPIRED" }));
    expect(versions.createDraftVersion(session.id, { expectedLatestRevision: 130, draft: draft() }).revision).toBe(131);
    database.prepare(`UPDATE ${table} SET created_at = ? WHERE session_id = ?`).run(new Date(Date.now() - 8 * day).toISOString(), session.id);
    await f.storage.collect(session.id);
    expect(versions.listDraftVersions(session.id).map(v => v.revision)).toEqual([131]);
    expect(versions.createDraftVersion(session.id, { expectedLatestRevision: 131, draft: draft() }).revision).toBe(132);
  });
});

it("retains hidden nodes and retained history, then collects old uploads, replaced images and unused slices after a continuous grace period", async () => {
  const f = await fixture(), session = f.projects.createSession({ title: "Images", sessionType: "image-composition" });
  const versions = new CompositionSessionRepository(database);
  const used = await f.assets.create(session.id, { filename: "used.png", data: png });
  const old = await f.assets.create(session.id, { filename: "replaced.png", data: png });
  const unused = await f.assets.create(session.id, { filename: "unused-slice.png", data: png });
  const first = addCompositionImage(createDraft()).draft;
  first.images[0].assetId = old.id;
  versions.createDraftVersion(session.id, { expectedLatestRevision: 0, draft: first });
  const current = structuredClone(first); current.images[0].assetId = used.id; current.images[0].visible = false;
  versions.createDraftVersion(session.id, { expectedLatestRevision: 1, draft: current });
  await f.storage.collect(session.id);
  f.advance(day + 1);
  expect((await f.storage.collect(session.id)).imagesDeleted).toBe(1);
  expect(() => f.assets.get(session.id, unused.id)).toThrow();
  expect(f.assets.get(session.id, old.id).asset.id).toBe(old.id);
  database.prepare("UPDATE composition_draft_versions SET created_at = ? WHERE revision = 1").run(new Date(Date.now() - 8 * day).toISOString());
  await f.storage.collect(session.id); // Starts a new grace period after the last history reference disappears.
  f.storage.protect(session.id, "undo", { revisions: [], assetIds: [old.id] });
  f.advance(day + 1);
  // A disconnected editor's protection expires; a connected editor renews it.
  f.storage.protect(session.id, "undo", { revisions: [], assetIds: [old.id] });
  expect((await f.storage.collect(session.id)).imagesDeleted).toBe(0);
  f.storage.release(session.id, "undo");
  await f.storage.collect(session.id);
  f.advance(day + 1);
  const cleared = await f.storage.collect(session.id);
  expect(cleared).toMatchObject({ imagesDeleted: 1, bytesFreed: png.length });
  expect(f.assets.get(session.id, used.id).asset.id).toBe(used.id);
});

it("protects an in-flight image consumer and resets the grace period when an image becomes used again", async () => {
  const f = await fixture(), session = f.projects.createSession({ title: "In flight", sessionType: "ui-layout" });
  const asset = await f.assets.create(session.id, { filename: "upload.png", data: png });
  await f.storage.collect(session.id); f.advance(day + 1);
  await f.assets.withProtection([asset.id], async () => { expect((await f.storage.collect(session.id)).imagesDeleted).toBe(0); });
  await f.storage.collect(session.id); f.advance(day + 1);
  expect((await f.storage.collect(session.id)).imagesDeleted).toBe(1);
});

it("rechecks references introduced while filesystem work is awaiting", async () => {
  const f = await fixture(), session = f.projects.createSession({ title: "Concurrent save", sessionType: "image-composition" });
  const asset = await f.assets.create(session.id, { filename: "saved-late.png", data: png });
  await f.storage.collect(session.id); f.advance(day + 1);
  const cleanup = f.storage.collect(session.id);
  const draft = addCompositionImage(createDraft()).draft; draft.images[0].assetId = asset.id;
  new CompositionSessionRepository(database).createDraftVersion(session.id, { expectedLatestRevision: 0, draft });
  expect((await cleanup).imagesDeleted).toBe(0);
  expect(f.assets.get(session.id, asset.id).asset.id).toBe(asset.id);
});

it("leaves a failed file deletion readable and retries it on the next collection", async () => {
  const f = await fixture(), session = f.projects.createSession({ title: "Retry", sessionType: "ui-layout" });
  const asset = await f.assets.create(session.id, { filename: "retry.png", data: png });
  await f.storage.collect(session.id); f.advance(day + 1);
  const source = join(f.root, session.id, "source");
  await chmod(source, 0o500);
  try {
    expect((await f.storage.collect(session.id)).failedFiles).toHaveLength(1);
    expect(f.assets.get(session.id, asset.id).asset.id).toBe(asset.id);
  } finally { await chmod(source, 0o700); }
  expect((await f.storage.collect(session.id)).imagesDeleted).toBe(1);
});

it("reclaims session deletion and orphan files without deleting style-library images or unrelated files", async () => {
  const f = await fixture(), session = f.projects.createSession({ title: "Deleted", sessionType: "ui-layout" });
  const asset = await f.assets.create(session.id, { filename: "source.png", data: png });
  const file = f.assets.get(session.id, asset.id).filePath;
  const styles = new StyleLibraryRepository(database, f.root);
  const style = styles.createStyle({ name: "Keep", category: "ui", creatorType: "user", description: "Keep this reference", promptSummary: "Keep" });
  const updated = await styles.addReferenceImage(style.id, { expectedRevision: style.revision, filename: "keep.png", data: png });
  const orphan = join(f.root, session.id, "source", "00000000-0000-4000-8000-000000000001.png");
  await writeFile(orphan, png);
  await mkdir(join(f.root, "exports"), { recursive: true });
  const exportFile = join(f.root, "exports", "keep.png"); await writeFile(exportFile, png);
  f.projects.deleteSession(session.id, { expectedRevision: session.revision });
  await f.storage.collect(); f.advance(day + 1000);
  await f.storage.collect();
  expect(await readFile(file)).toEqual(png);
  f.advance(7 * day);
  await f.storage.collect();
  f.advance(day + 1000);
  await f.storage.collect();
  await expect(readFile(file)).rejects.toThrow(); await expect(readFile(orphan)).rejects.toThrow();
  expect(await readFile(exportFile)).toEqual(png);
  expect(styles.getReferenceImage(style.id, updated.referenceImages[0].id).reference.byteSize).toBe(png.length);
});

it("allows an owned preview snapshot to restore after its source revision expires, and rejects forged provenance", async () => {
  directory = await mkdtemp(join(tmpdir(), "h2a-preview-retention-"));
  const dbPath = join(directory, "test.db"), root = join(directory, "artifacts");
  const server = createHuman2AiServer({ databasePath: dbPath, artifactsDirectory: root });
  const post = (url: string, payload: object) => server.inject({ method: "POST", url, payload });
  try {
    const project = (await post("/api/v1/projects", { name: "Snapshots" })).json<{ id: string }>();
    const source = (await post("/api/v1/sessions", { title: "Source", sessionType: "ui-layout", projectId: project.id })).json<{ id: string }>();
    const target = (await post("/api/v1/sessions", { title: "Target", sessionType: "ui-layout", projectId: project.id })).json<{ id: string }>();
    await post(`/api/v1/sessions/${source.id}/ui-sketch/drafts`, { expectedLatestRevision: 0, draft: createUiSketchDraft() });
    const preview = (await post(`/api/v1/sessions/${target.id}/previews`, { sessionId: source.id, sessionType: "ui-layout", stateId: "start" })).json();
    const draft = createUiSketchDraft(); draft.images.push({ id: "preview", ...preview, previewReference: preview.reference, crop: null, x: 0, y: 0, width: 100, height: 100, visible: true, origin: "user", note: "", annotation: "", semanticType: "", weight: "auto" });
    expect((await post(`/api/v1/sessions/${target.id}/ui-sketch/drafts`, { expectedLatestRevision: 0, draft })).statusCode).toBe(201);
    for (let revision = 1; revision <= 101; revision++) await post(`/api/v1/sessions/${source.id}/ui-sketch/drafts`, { expectedLatestRevision: revision, draft: createUiSketchDraft() });
    expect((await server.inject(`/api/v1/sessions/${source.id}/ui-sketch/drafts/1`)).statusCode).toBe(410);
    expect((await post(`/api/v1/sessions/${target.id}/ui-sketch/drafts`, { expectedLatestRevision: 1, draft })).statusCode).toBe(201);
    const copied = (await post("/api/v1/sessions", { title: "Copied", sessionType: "ui-layout", projectId: project.id })).json<{ id: string }>();
    const content = await server.inject(`/api/v1/sessions/${target.id}/assets/${preview.assetId}/content`);
    const uploaded = await server.inject({ method: "POST", url: `/api/v1/sessions/${copied.id}/assets?filename=copy.svg`,
      headers: { "content-type": content.headers["content-type"] }, payload: content.rawPayload });
    expect(uploaded.statusCode).toBe(201);
    const transferred = structuredClone(draft); transferred.images[0].assetId = uploaded.json().id;
    expect((await post(`/api/v1/sessions/${copied.id}/ui-sketch/drafts`, { expectedLatestRevision: 0, draft: transferred })).statusCode).toBe(201);
    const otherProject = (await post("/api/v1/projects", { name: "Other project" })).json<{ id: string }>();
    const outside = (await post("/api/v1/sessions", { title: "Outside", sessionType: "ui-layout", projectId: otherProject.id })).json<{ id: string }>();
    const outsideAsset = await server.inject({ method: "POST", url: `/api/v1/sessions/${outside.id}/assets?filename=copy.svg`,
      headers: { "content-type": content.headers["content-type"] }, payload: content.rawPayload });
    const foreign = structuredClone(draft); foreign.images[0].assetId = outsideAsset.json().id;
    expect((await post(`/api/v1/sessions/${outside.id}/ui-sketch/drafts`, { expectedLatestRevision: 0, draft: foreign })).statusCode).toBe(400);
    draft.images[0].previewReference = { ...preview.reference, stateId: "forged" };
    expect((await post(`/api/v1/sessions/${target.id}/ui-sketch/drafts`, { expectedLatestRevision: 2, draft })).statusCode).toBe(400);
  } finally { await server.close(); }
});

it("protects each newly saved 3D operation during a large queue, and preserves all 100 actual undo targets", async () => {
  const f = await fixture(), session = f.projects.createSession({ title: "Queued", sessionType: "spatial" });
  const versions = new SpatialSessionRepository(database), initial = createSpatialDraft();
  versions.createDraftVersion(session.id, { expectedLatestRevision: 0, draft: initial });
  const queue = new SpatialEditQueue(initial, 1), history = new CanvasEditHistory(initial);
  for (let x = 1; x <= 110; x++) {
    const operation: SpatialOperation = { type: "put-object", object: { id: "box", name: "Box", kind: "box", position: [x, 0, 0], rotation: [0, 0, 0], size: [1, 1, 1], color: "#ffffff" } };
    const next = applySpatialOperations(queue.draft, [operation]).draft;
    history.record(next); queue.edit(operation, next);
  }
  const transport = {
    protect: async () => { queue.retainHistory(history.retainedDrafts()); f.storage.protect(session.id, "3D", { revisions: queue.protectedRevisions(), assetIds: [] }); },
    saveInitial: async () => { throw new Error("Already saved"); },
    apply: async (revision: number, operations: SpatialOperation[]) => versions.apply(session.id, revision, operations),
    restore: async (revision: number, targetRevision: number) => versions.restoreDraftVersion(session.id, { expectedLatestRevision: revision, targetRevision }),
  };
  await queue.flush(transport, () => undefined);
  for (let x = 109; x >= 10; x--) {
    queue.restore(history.undo()!.draft); await queue.flush(transport, () => undefined);
    expect(queue.draft.objects[0].position[0]).toBe(x);
  }
  expect(history.canUndo).toBe(false);
  expect(queue.protectedRevisions()).toHaveLength(101);
  f.storage.release(session.id, "3D"); await f.storage.collect(session.id);
  expect(versions.listDraftVersions(session.id)).toHaveLength(100);
});

it("regenerates only garbage-collected PNG pieces while preserving current nodes and split metadata", async () => {
  const f = await fixture(), session = f.projects.createSession({ title: "Slices", sessionType: "ui-layout" });
  const bytes = await sharp(Buffer.from('<svg width="30" height="10"><rect x="1" y="1" width="4" height="4" fill="red"/><rect x="20" y="1" width="4" height="4" fill="blue"/></svg>')).png().toBuffer();
  const source = await f.assets.create(session.id, { filename: "source.png", data: bytes });
  const splits = new UiSketchPngSplitRepository(database, f.assets), inputs = [{ nodeId: "source", assetId: source.id }], options = { alphaThreshold: 8, minSize: 0, gap: 12 };
  const batch = await splits.prepare(session.id, inputs, options);
  expect(batch.pieces).toHaveLength(2);
  const draft = createUiSketchDraft(); draft.pngSplits = [batch];
  for (const [id, assetId] of [["source", source.id], [batch.pieces[0].nodeId, batch.pieces[0].assetId!]]) {
    draft.images.push({ id, assetId, x: 0, y: 0, width: 10, height: 10, crop: null, visible: true, origin: "import", note: "", annotation: "", semanticType: "", weight: "auto" });
  }
  new UiSketchSessionRepository(database).createDraftVersion(session.id, { expectedLatestRevision: 0, draft });
  await f.storage.collect(session.id); f.advance(day + 1);
  expect((await f.storage.collect(session.id)).imagesDeleted).toBe(1);
  const uploads = vi.spyOn(f.assets, "create"), retry = await splits.prepare(session.id, inputs, options);
  expect(uploads).toHaveBeenCalledTimes(1);
  expect(retry.pieces[0].assetId).toBe(batch.pieces[0].assetId);
  expect(retry.pieces[1].assetId).not.toBe(batch.pieces[1].assetId);
});

it.each([0, 2])("reclaims free database pages with initial auto_vacuum mode %s", async mode => {
  const f = await fixture();
  expect(database.pragma("auto_vacuum", { simple: true })).toBe(2);
  if (mode === 0) { database.pragma("auto_vacuum = NONE"); database.exec("VACUUM"); }
  database.exec("CREATE TABLE retention_fixture(data BLOB); INSERT INTO retention_fixture VALUES (zeroblob(12582912)); DELETE FROM retention_fixture;");
  const before = database.pragma("page_count", { simple: true }) as number;
  f.storage.compact();
  expect(database.pragma("page_count", { simple: true })).toBeLessThan(before);
  expect(database.pragma("auto_vacuum", { simple: true })).toBe(2);
});

it("restarts the grace period when cached PNG pieces are retrieved while a collection is awaiting", async () => {
  const f = await fixture(), session = f.projects.createSession({ title: "Reused slice", sessionType: "ui-layout" });
  const bytes = await sharp(Buffer.from('<svg width="10" height="10"><rect x="1" y="1" width="4" height="4" fill="red"/></svg>')).png().toBuffer();
  const source = await f.assets.create(session.id, { filename: "source.png", data: bytes });
  const splits = new UiSketchPngSplitRepository(database, f.assets), inputs = [{ nodeId: "source", assetId: source.id }], options = { alphaThreshold: 8, minSize: 0, gap: 12 };
  const batch = await splits.prepare(session.id, inputs, options), draft = createUiSketchDraft();
  draft.images.push({ id: "source", assetId: source.id, x: 0, y: 0, width: 10, height: 10, crop: null, visible: true, origin: "import", note: "", annotation: "", semanticType: "", weight: "auto" });
  new UiSketchSessionRepository(database).createDraftVersion(session.id, { expectedLatestRevision: 0, draft });
  await f.storage.collect(session.id); f.advance(day + 1);
  const collection = f.storage.collect(session.id);
  const retry = await splits.prepare(session.id, inputs, options);
  expect((await collection).imagesDeleted).toBe(0);
  expect(retry.pieces[0].assetId).toBe(batch.pieces[0].assetId);
  expect(f.assets.get(session.id, batch.pieces[0].assetId!).asset.id).toBe(batch.pieces[0].assetId);
});

it("migrates existing preview provenance before pruning old source history", async () => {
  directory = await mkdtemp(join(tmpdir(), "h2a-retention-upgrade-"));
  const legacy = join(directory, "migrations"), root = join(directory, "artifacts");
  await mkdir(legacy);
  for (const name of (await readdir(resolve("migrations"))).filter(name => name.endsWith(".sql") && name < "0013")) {
    await copyFile(join("migrations", name), join(legacy, name));
  }
  database = openDatabase(join(directory, "upgrade.db"), legacy);
  const project = { id: randomUUID() }, source = { id: randomUUID() }, owner = { id: randomUUID() };
  const created = new Date().toISOString();
  database.prepare("INSERT INTO projects (id, name, revision, created_at, updated_at) VALUES (?, 'Legacy', 1, ?, ?)").run(project.id, created, created);
  for (const session of [source, owner]) {
    database.prepare("INSERT INTO sessions (id, project_id, session_type, title, lifecycle_stage, revision, created_at, updated_at) VALUES (?, ?, 'ui-layout', 'Legacy', 'draft', 1, ?, ?)").run(session.id, project.id, created, created);
    database.prepare("INSERT INTO ui_sessions (session_id) VALUES (?)").run(session.id);
  }
  const id = randomUUID(), relative = `${owner.id}/source/${id}.png`, timestamp = new Date(Date.now() - 8 * day).toISOString();
  await mkdir(join(root, owner.id, "source"), { recursive: true }); await writeFile(join(root, relative), png);
  database.prepare(`INSERT INTO image_assets (id, session_id, relative_path, original_filename, mime_type, byte_size, width, height, sha256, created_at)
    VALUES (?, ?, ?, 'preview.png', 'image/png', ?, 1, 1, ?, ?)`).run(id, owner.id, relative, png.length, createHash("sha256").update(png).digest("hex"), timestamp);
  const reference = { sessionId: source.id, sessionType: "ui-layout" as const, stateId: "start", renderedRevision: 1 };
  const draft = createUiSketchDraft();
  draft.images.push({ id: "preview", assetId: id, previewReference: reference, x: 0, y: 0, width: 10, height: 10, crop: null, visible: true, origin: "import", note: "", annotation: "", semanticType: "", weight: "auto" });
  for (const [sessionId, content] of [[source.id, createUiSketchDraft()], [owner.id, draft]] as const) {
    database.prepare("INSERT INTO ui_sketch_draft_versions (id, session_id, revision, draft_json, created_at) VALUES (?, ?, 1, ?, ?)")
      .run(randomUUID(), sessionId, JSON.stringify(content), timestamp);
  }
  expect(applyMigrations(database, resolve("migrations"))).toEqual(["0013_storage_retention.sql", "0014_workspace_settings_and_trash.sql"]);
  expect(JSON.parse(database.prepare<[string], { preview_reference_json: string }>("SELECT preview_reference_json FROM image_assets WHERE id = ?").get(id)!.preview_reference_json)).toEqual(reference);
  const versions = new UiSketchSessionRepository(database);
  versions.createDraftVersion(source.id, { expectedLatestRevision: 1, draft: createUiSketchDraft() });
  expect(() => versions.getDraftVersion(source.id, 1)).toThrow(expect.objectContaining({ code: "DRAFT_VERSION_EXPIRED" }));
  expect(versions.createDraftVersion(owner.id, { expectedLatestRevision: 1, draft }).draft.images[0].assetId).toBe(id);
});

it("records a validated uploaded preview reference so later source pruning cannot lock the current canvas", async () => {
  const f = await fixture(), project = f.projects.createProject({ name: "Uploaded previews" });
  const source = f.projects.createSession({ title: "Source", projectId: project.id, sessionType: "ui-layout" });
  const owner = f.projects.createSession({ title: "Owner", projectId: project.id, sessionType: "ui-layout" });
  const versions = new UiSketchSessionRepository(database), asset = await f.assets.create(owner.id, { filename: "preview.png", data: png });
  versions.createDraftVersion(source.id, { expectedLatestRevision: 0, draft: createUiSketchDraft() });
  const draft = createUiSketchDraft(); draft.images.push({ id: "preview", assetId: asset.id,
    previewReference: { sessionId: source.id, sessionType: "ui-layout", stateId: "start", renderedRevision: 1 },
    x: 0, y: 0, width: 10, height: 10, crop: null, visible: true, origin: "import", note: "", annotation: "", semanticType: "", weight: "auto" });
  versions.createDraftVersion(owner.id, { expectedLatestRevision: 0, draft });
  for (let revision = 1; revision <= 101; revision++) versions.createDraftVersion(source.id, { expectedLatestRevision: revision, draft: createUiSketchDraft() });
  expect(() => versions.getDraftVersion(source.id, 1)).toThrow(expect.objectContaining({ code: "DRAFT_VERSION_EXPIRED" }));
  expect(versions.createDraftVersion(owner.id, { expectedLatestRevision: 1, draft }).draft.images[0].assetId).toBe(asset.id);
});
