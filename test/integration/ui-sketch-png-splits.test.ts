import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { afterEach, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { openDatabase, type DatabaseConnection } from "../../src/database/migrate.ts";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.ts";
import { ImageAssetRepository } from "../../src/database/image-asset-repository.ts";
import { UiSketchSessionRepository } from "../../src/database/ui-sketch-session-repository.ts";
import { UiSketchPngSplitRepository } from "../../src/database/ui-sketch-png-split-repository.ts";
import { buildServer } from "../../src/server/app.ts";
import { appendPngSplit, type PngSplitBatch } from "../../src/domain/ui-sketch/png-split.ts";
import { createUiSketchDraft, insertUiSketchStage, validateUiSketchDraft } from "../../src/domain/ui-sketch/index.ts";
import { CanvasEditHistory } from "../../src/domain/session/canvas-edit-history.ts";
import type { PngSplitRegion } from "../../src/domain/ui-sketch/png-split-regions.ts";

const options = { alphaThreshold: 8, minSize: 16, gap: 12 };
let server: FastifyInstance, database: DatabaseConnection, directory: string;
afterEach(async () => { vi.restoreAllMocks(); await server?.close(); database?.close(); if (directory) await rm(directory, { recursive: true, force: true }); });

async function png(rects = [[1, 1, 15, 15], [20, 1, 16, 1], [40, 1, 1, 16], [45, 1, 17, 17]]) {
  const rgba = Buffer.alloc(70 * 24 * 4);
  for (const [x, y, w, h] of rects) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) rgba.set([12, 34, 56, 255], (yy * 70 + xx) * 4);
  return sharp(rgba, { raw: { width: 70, height: 24, channels: 4 } }).png().toBuffer();
}

async function fixture(count = 1, bytes?: Buffer) {
  directory = await mkdtemp(join(tmpdir(), "h2a-png-splits-"));
  database = openDatabase(join(directory, "test.db"), resolve("migrations"));
  const projects = new ProjectSessionRepository(database), assets = new ImageAssetRepository(database, join(directory, "assets"));
  const sessions = new UiSketchSessionRepository(database), splits = new UiSketchPngSplitRepository(database, assets);
  server = buildServer({}, { projectSessions: projects, imageAssets: assets, uiSketchSessions: sessions, pngSplits: splits });
  const session = projects.createSession({ title: "PNG", sessionType: "ui-layout" });
  const draft = createUiSketchDraft(); draft.layerOrder = [];
  for (let index = 0; index < count; index++) {
    const asset = await assets.create(session.id, { filename: "source.png", data: bytes ?? await png() });
    draft.images.push({ id: `source-${index}`, assetId: asset.id, x: index * 90, y: 5, width: 7, height: 2.4,
      crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }, visible: true, origin: "import", note: "source note", annotation: "", semanticType: "", weight: "auto" });
    draft.layerOrder!.push(`source-${index}`);
  }
  const sources = draft.images.map(image => ({ nodeId: image.id, assetId: image.assetId! }));
  const request = (params = options) => server.inject({ method: "POST", url: `/api/v1/sessions/${session.id}/ui-sketch/png-splits`, payload: { sources, options: params } });
  return { projects, assets, sessions, splits, session, draft, sources, request };
}

it("uses original asset bytes, filters before uploads and packs multiple originals into one dissolvable group", async () => {
  const f = await fixture(2), originals = structuredClone(f.draft.images);
  const uploads = vi.spyOn(f.assets, "create");
  const response = await f.request(); expect(response.statusCode, response.body).toBe(200);
  const batch = response.json<PngSplitBatch>();
  expect(uploads).toHaveBeenCalledTimes(6);
  expect(batch.sources.map(source => source.discarded)).toEqual([1, 1]);
  expect(batch.pieces.map(piece => [piece.width, piece.height])).toEqual([[16, 1], [1, 16], [17, 17], [16, 1], [1, 16], [17, 17]]);
  const draft = appendPngSplit(insertUiSketchStage(f.draft, "start", "second"), batch, { x: -100, y: 200 });
  expect(validateUiSketchDraft(draft)).toEqual(draft);
  expect(draft.images.slice(0, 2)).toEqual(originals);
  expect(draft.texts).toEqual([]);
  expect(draft.groups).toEqual([{ id: batch.groupId, itemIds: batch.pieces.map(piece => piece.nodeId) }]);
  expect(draft.stages[0].images).toHaveLength(8);
  for (const source of batch.sources) {
    expect(await readFile(f.assets.get(f.session.id, source.assetId).filePath)).toEqual(await png());
    expect(source.sha256).toBe(f.assets.get(f.session.id, source.assetId).asset.sha256);
  }
  for (const piece of batch.pieces) expect(f.assets.get(f.session.id, piece.assetId!).asset).toMatchObject({ width: piece.width, height: piece.height, sha256: piece.sha256 });
  const retained = draft.images.slice(2);
  for (const a of retained) for (const b of retained) if (a !== b) expect(a.x + a.width + 12 <= b.x || b.x + b.width + 12 <= a.x || a.y + a.height + 12 <= b.y || b.y + b.height + 12 <= a.y).toBe(true);
});

it("previews exact retained bounds without creating assets, checkpoints or drafts", async () => {
  const f = await fixture(2);
  const uploads = vi.spyOn(f.assets, "create");
  const preview = await server.inject({ method: "POST", url: `/api/v1/sessions/${f.session.id}/ui-sketch/png-splits/preview`,
    payload: { sources: f.sources, options } });
  expect(preview.statusCode, preview.body).toBe(200);
  expect(uploads).not.toHaveBeenCalled();
  expect(database.prepare("SELECT * FROM ui_sketch_png_splits").all()).toEqual([]);
  expect(f.sessions.getLatestDraftVersion(f.session.id)).toBeNull();
  const batch = (await f.request()).json<PngSplitBatch>();
  expect(preview.json().sources).toEqual(batch.sources.map(source => ({
    nodeId: source.nodeId, width: source.width, height: source.height, discarded: source.discarded,
    rects: batch.pieces.filter(piece => piece.sourceNodeId === source.nodeId).map(piece => piece.sourceRect),
  })));
  const invalid = await server.inject({ method: "POST", url: `/api/v1/sessions/${f.session.id}/ui-sketch/png-splits/preview`,
    payload: { sources: f.sources, options: { ...options, alphaThreshold: 255 } } });
  expect(invalid.statusCode).toBe(400);
});

it("uses the same manual masks in preview and splitting, persists them and isolates retry identities", async () => {
  const f = await fixture();
  const regions: PngSplitRegion[] = [[[0, 0], [18, 0], [18, 18], [0, 18]]];
  const sources = [{ ...f.sources[0], regions }];
  const params = { ...options, minSize: 100 };
  const send = (preview: boolean, selected = sources, values = params) => server.inject({ method: "POST",
    url: `/api/v1/sessions/${f.session.id}/ui-sketch/png-splits${preview ? "/preview" : ""}`, payload: { sources: selected, options: values } });
  const uploads = vi.spyOn(f.assets, "create");
  const preview = await send(true);
  expect(preview.statusCode, preview.body).toBe(200);
  expect(preview.json().sources[0].rects).toEqual([[1, 1, 15, 15]]);
  expect(uploads).not.toHaveBeenCalled();
  const response = await send(false), batch = response.json<PngSplitBatch>();
  expect(response.statusCode, response.body).toBe(200);
  expect(batch.pieces.map(piece => piece.sourceRect)).toEqual(preview.json().sources[0].rects);
  expect(batch.sources[0].regions).toEqual(regions);
  expect(uploads).toHaveBeenCalledTimes(1);
  expect((await send(false)).json()).toEqual(batch);
  expect(uploads).toHaveBeenCalledTimes(1);
  const placed = appendPngSplit(f.draft, batch, { x: 0, y: 0 });
  expect(placed.images).toHaveLength(2);
  f.sessions.createDraftVersion(f.session.id, { expectedLatestRevision: 0, draft: placed });
  const loaded = f.sessions.getLatestDraftVersion(f.session.id)!.draft;
  expect(loaded.pngSplits![0].sources[0].regions).toEqual(regions);
  expect(appendPngSplit(loaded, batch, { x: 0, y: 0 })).toBe(loaded);
  const changed = (await send(false, [{ ...f.sources[0], regions: [[[44, 0], [64, 0], [64, 20], [44, 20]]] }])).json<PngSplitBatch>();
  expect(changed.id).not.toBe(batch.id);
  expect(appendPngSplit(loaded, changed, { x: 0, y: 0 }).images).toHaveLength(3);
  const malformed = await send(true, [{ ...f.sources[0], regions: [[[0, 0], [1, 1], [2, 2]]] }]);
  expect(malformed.statusCode).toBe(400);
  const missingPoint = await send(false, [{ ...f.sources[0], regions: [[[0, 0], [1, 1]]] }]);
  expect(missingPoint.statusCode).toBe(400);
});

it("repeats with no new uploads or restored deletions, and preserves edits and dissolved groups after save/reload", async () => {
  const f = await fixture(), first = (await f.request()).json<PngSplitBatch>();
  const next = appendPngSplit(f.draft, first, { x: 500, y: 300 });
  next.images.pop(); next.groups = []; next.layerOrder = next.layerOrder!.filter(id => next.images.some(image => image.id === id));
  Object.assign(next.images[1], { x: 888, y: -5, note: "edited", visible: false, crop: { x: 0, y: 0, width: 0.5, height: 1 } });
  const saved = f.sessions.createDraftVersion(f.session.id, { expectedLatestRevision: 0, draft: next });
  const uploads = vi.spyOn(f.assets, "create");
  const repeat = (await f.request({ ...options, gap: 24 })).json<PngSplitBatch>();
  expect(uploads).not.toHaveBeenCalled();
  const loaded = f.sessions.getLatestDraftVersion(f.session.id)!.draft;
  expect(appendPngSplit(loaded, repeat, { x: 9999, y: 9999 })).toBe(loaded);
  expect(loaded).toEqual(saved.draft);
});

it("retries a failed upload from persistent checkpoints without publishing partial canvas content", async () => {
  const f = await fixture();
  const create = f.assets.create.bind(f.assets); let calls = 0;
  vi.spyOn(f.assets, "create").mockImplementation(async (...args) => { if (++calls === 2) throw new Error("asset storage failed"); return create(...args); });
  expect((await f.request()).statusCode).toBe(500);
  expect(f.sessions.getLatestDraftVersion(f.session.id)).toBeNull();
  const checkpoint = JSON.parse(database.prepare<[], { record_json: string }>("SELECT record_json FROM ui_sketch_png_splits").get()!.record_json) as PngSplitBatch;
  expect(checkpoint.pieces.filter(piece => piece.assetId)).toHaveLength(1);
  vi.restoreAllMocks(); const uploads = vi.spyOn(f.assets, "create");
  const restarted = new UiSketchPngSplitRepository(database, f.assets);
  const batch = await restarted.prepare(f.session.id, f.sources, options);
  expect(uploads).toHaveBeenCalledTimes(2);
  expect(batch.pieces[0].assetId).toBe(checkpoint.pieces[0].assetId);
  expect(appendPngSplit(f.draft, batch, { x: 0, y: 0 }).images).toHaveLength(4);
});

it("shares prepared assets for overlapping selections and concurrent requests without deduplicating identical components", async () => {
  const f = await fixture(2); const uploads = vi.spyOn(f.assets, "create");
  const [a, b] = await Promise.all([f.splits.prepare(f.session.id, f.sources, options), f.splits.prepare(f.session.id, [...f.sources].reverse(), options)]);
  expect(a).toEqual(b); expect(uploads).toHaveBeenCalledTimes(6);
  const first = await f.splits.prepare(f.session.id, [f.sources[0]], options);
  const draft = appendPngSplit(f.draft, first, { x: 10, y: 10 });
  const mixed = appendPngSplit(draft, a, { x: 200, y: 200 });
  expect(mixed.images).toHaveLength(8); expect(mixed.groups).toHaveLength(2);
  expect(mixed.images[2]).toBe(draft.images[2]); expect(uploads).toHaveBeenCalledTimes(6);
});

it("zero retained pieces complete normally; a single piece stays independent; each operation undoes and redoes as a whole", async () => {
  const f = await fixture(1, await png([[1, 1, 15, 15]]));
  const uploads = vi.spyOn(f.assets, "create");
  const zero = (await f.request()).json<PngSplitBatch>(); expect(zero.pieces).toEqual([]); expect(uploads).not.toHaveBeenCalled();
  const single = (await f.request({ ...options, minSize: 0 })).json<PngSplitBatch>();
  const placed = appendPngSplit(f.draft, single, { x: 10, y: 20 });
  expect(placed.images).toHaveLength(2); expect(placed.groups).toEqual([]);
  const history = new CanvasEditHistory(f.draft); history.record(placed);
  expect(history.undo()!.draft).toEqual(f.draft); expect(history.redo()!.draft).toEqual(placed);
  const empty = appendPngSplit(f.draft, zero, { x: 0, y: 0 });
  expect(empty.images).toEqual(f.draft.images); expect(appendPngSplit(empty, zero, { x: 0, y: 0 })).toBe(empty);
});

it("round-trips provenance and supports saved multi-image operation undo without deleting source assets", async () => {
  const f = await fixture(2); f.sessions.createDraftVersion(f.session.id, { expectedLatestRevision: 0, draft: f.draft });
  const batch = (await f.request()).json<PngSplitBatch>();
  const placed = appendPngSplit(f.draft, batch, { x: 0, y: 0 });
  f.sessions.createDraftVersion(f.session.id, { expectedLatestRevision: 1, draft: placed });
  expect(f.sessions.getLatestDraftVersion(f.session.id)!.draft.pngSplits).toEqual([batch]);
  const undone = f.sessions.undoDraftVersion(f.session.id, { changeRevision: 2, expectedLatestRevision: 2 });
  expect(undone.draft).toEqual(f.draft);
  for (const source of f.sources) expect(f.assets.get(f.session.id, source.assetId).asset.mimeType).toBe("image/png");
});

it("rejects invalid numbers, duplicate source nodes, wrong sessions and foreign or opaque assets", async () => {
  const f = await fixture();
  for (const invalid of [{ ...options, alphaThreshold: 255 }, { ...options, minSize: -1 }, { ...options, minSize: 1.5 }, { ...options, gap: -1 }]) expect((await f.request(invalid)).statusCode).toBe(400);
  const inject = (sessionId: string, sources = f.sources) => server.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/ui-sketch/png-splits`, payload: { sources, options } });
  expect((await inject(f.session.id, [f.sources[0], { ...f.sources[0], assetId: "different" }])).statusCode).toBe(400);
  const other = f.projects.createSession({ title: "other", sessionType: "ui-layout" });
  expect((await inject(other.id)).statusCode).toBe(404);
  const composition = f.projects.createSession({ title: "wrong", sessionType: "image-composition" });
  expect((await inject(composition.id)).statusCode).toBe(400);
  expect((await inject("missing")).statusCode).toBe(404);
  for (const data of [await sharp({ create: { width: 2, height: 2, channels: 4, background: "red" } }).png().toBuffer(), await sharp(await png()).jpeg().toBuffer()]) {
    const asset = await f.assets.create(f.session.id, { filename: "invalid", data });
    expect((await inject(f.session.id, [{ nodeId: "invalid", assetId: asset.id }])).statusCode).toBe(400);
  }
});

it("retains unrelated identities and metadata while adding to every stage without altering source crop or scale", async () => {
  const f = await fixture(); const batch = (await f.request()).json<PngSplitBatch>();
  const staged = insertUiSketchStage(f.draft, "start", "other"); staged.overallNote = "latest unsaved note";
  const result = appendPngSplit(staged, batch, { x: 7, y: 9 });
  expect(result.images[0]).toBe(staged.images[0]); expect(result.stages[0].images[0]).toBe(staged.stages[0].images[0]);
  expect(result.rectangles).toBe(staged.rectangles); expect(result.texts).toBe(staged.texts); expect(result.overallNote).toBe("latest unsaved note");
  expect(result.images.slice(1).map(image => [image.width, image.height])).toEqual([[16, 1], [1, 16], [17, 17]]);
});

it("adjusted connectivity and minimum-size parameters create separate results and keep earlier user edits", async () => {
  const rgba = Buffer.alloc(7 * 3 * 4);
  rgba.set([12, 34, 56, 255], (7 + 1) * 4); rgba.set([12, 34, 56, 255], (7 + 5) * 4);
  for (let x = 2; x < 5; x++) rgba.set([1, 2, 3, 8], (7 + x) * 4);
  const f = await fixture(1, await sharp(rgba, { raw: { width: 7, height: 3, channels: 4 } }).png().toBuffer());
  const one = (await f.request({ alphaThreshold: 0, minSize: 0, gap: 12 })).json<PngSplitBatch>();
  const two = (await f.request({ alphaThreshold: 8, minSize: 0, gap: 5 })).json<PngSplitBatch>();
  expect(one.pieces).toHaveLength(1); expect(two.pieces).toHaveLength(2); expect(two.id).not.toBe(one.id);
  const first = appendPngSplit(f.draft, one, { x: -50, y: 0 }); first.images[1].note = "user choice";
  const next = appendPngSplit(first, two, { x: 200, y: 200 });
  expect(next.images[1]).toBe(first.images[1]); expect(next.images[1].note).toBe("user choice");
  expect(next.groups).toHaveLength(1); expect(next.pngSplits).toHaveLength(2);
  expect(validateUiSketchDraft(next)).toEqual(next);
});

it("a save conflict leaves the latest external edits intact and prepared assets remain available for retry", async () => {
  const f = await fixture();
  f.sessions.createDraftVersion(f.session.id, { expectedLatestRevision: 0, draft: f.draft });
  const batch = (await f.request()).json<PngSplitBatch>();
  const external = { ...f.draft, overallNote: "external edit" };
  f.sessions.createDraftVersion(f.session.id, { expectedLatestRevision: 1, draft: external });
  const rejected = await server.inject({ method: "POST", url: `/api/v1/sessions/${f.session.id}/ui-sketch/drafts`,
    payload: { expectedLatestRevision: 1, draft: appendPngSplit(f.draft, batch, { x: 20, y: 30 }) } });
  expect(rejected.statusCode).toBe(409); expect(f.sessions.getLatestDraftVersion(f.session.id)!.draft).toEqual(external);
  const uploads = vi.spyOn(f.assets, "create");
  const resumed = (await f.request()).json<PngSplitBatch>(); expect(uploads).not.toHaveBeenCalled();
  const saved = f.sessions.createDraftVersion(f.session.id, { expectedLatestRevision: 2, draft: appendPngSplit(external, resumed, { x: 20, y: 30 }) });
  expect(saved.draft.overallNote).toBe("external edit"); expect(saved.draft.images).toHaveLength(4);
});
