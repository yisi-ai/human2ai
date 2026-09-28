import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import sharp from "sharp";
import { SessionPreviewService } from "../../src/server/session-preview-service.ts";
import { createHuman2AiServer } from "../../src/server/runtime.ts";
import { createUiSketchDraft, renderUiSketchSvg } from "../../src/domain/ui-sketch/index.ts";
import { insertUiSketchStage, updateUiSketchStageDraft, uiSketchDraftForStage } from "../../src/domain/ui-sketch/index.ts";
import { createDraft, addArea, addTextRegion, updateAreaMetadata, createCompositionState, renderCompositionReferenceSvg } from "../../src/domain/composition/index.ts";
import { compositionSvgForRaster } from "../../src/domain/composition/raster.ts";
import { createSpatialDraft } from "../../src/domain/spatial/index.ts";
import type { UiSketchDraftVersion } from "../../src/domain/ui-sketch/types.ts";
import { addUiSessionPreview } from "../../src/domain/ui-sketch/session-preview.ts";

it("refreshes embedded composition fidelity and display text while retaining placement and history", async () => {
  const directory = await mkdtemp(join(tmpdir(), "human2ai-preview-mode-"));
  const server = createHuman2AiServer({ databasePath: ":memory:", artifactsDirectory: directory });
  const post = (url: string, payload: object) => server.inject({ method: "POST", url, payload });
  try {
    const project = (await post("/api/v1/projects", { name: "Preview modes" })).json<{ id: string }>();
    const create = async (sessionType: string) => (await post("/api/v1/sessions", { title: sessionType, sessionType, projectId: project.id })).json<{ id: string }>().id;
    const source = await create("image-composition"), target = await create("ui-layout");
    const draft = addTextRegion(addArea(createDraft(), { primitive: "triangle", rotation: 20 }).draft).draft;
    const sourceUrl = `/api/v1/sessions/${source}/composition/drafts`;
    const targetUrl = `/api/v1/sessions/${target}/ui-sketch/drafts`;
    const selector = { sessionId: source, sessionType: "image-composition", stateId: "state-1" };
    expect((await post(sourceUrl, { draft, expectedLatestRevision: 0 })).statusCode).toBe(201);
    const preview = (await post(`/api/v1/sessions/${target}/previews`, selector)).json();
    const embedded = addUiSessionPreview(createUiSketchDraft(), preview, "reference");
    expect((await post(targetUrl, { draft: embedded, expectedLatestRevision: 0 })).statusCode).toBe(201);
    const latest = async () => (await server.inject(`${targetUrl}/latest`)).json<{ draftVersion: UiSketchDraftVersion }>().draftVersion;
    const changes = [
      { ...draft, previewMode: "soft" as const },
      { ...draft, previewMode: "precise" as const },
      updateAreaMetadata(draft, "area-2", { displayText: "静观自得\nCanvas Agjpy" }),
      updateAreaMetadata(draft, "area-2", { displayText: "静观自得\nCanvas Agjpy" }),
      updateAreaMetadata(draft, "area-2", { displayText: "" }),
    ];
    changes[3].areas[1].corners = [{ x: 0.2, y: 0 }, { x: 1, y: 0.1 }, { x: 0.85, y: 1 }, { x: 0, y: 0.8 }];
    for (const [index, changed] of changes.entries()) {
      expect((await post(sourceUrl, { draft: changed, expectedLatestRevision: index + 1 })).statusCode).toBe(201);
      await expect.poll(async () => (await latest()).revision).toBe(index + 2);
      const node = (await latest()).draft.images[0];
      expect(node).toEqual({ ...embedded.images[0], assetId: node.assetId, previewReference: node.previewReference });
      expect(node.previewReference?.renderedRevision).toBe(index + 2);
      const svg = await server.inject(`/api/v1/sessions/${target}/assets/${node.assetId}/content`);
      expect(svg.body).toBe(renderCompositionReferenceSvg(changed));
      const native = await server.inject(`/api/v1/sessions/${target}/preview?${new URLSearchParams(selector)}`);
      expect(native.body).toBe(svg.body);
      if (changed.areas[1].displayText) {
        expect(native.body).toContain("静观自得</text>");
        if (changed.areas[1].corners) expect(native.body).toContain("data-text-warp-patch");
        const png = await server.inject(`/api/v1/sessions/${target}/preview.png?${new URLSearchParams(selector)}`);
        expect(png.rawPayload).toEqual(await sharp(Buffer.from(await compositionSvgForRaster(svg.body))).png().toBuffer());
      }
    }
    const historical = (await server.inject(`${targetUrl}/1`)).json<UiSketchDraftVersion>();
    expect(historical.draft).toEqual(embedded);
  } finally { await server.close(); await rm(directory, { recursive: true, force: true }); }
});

it.each(["ui-layout", "image-composition"] as const)("upgrades existing %s preview PNGs once on startup without changing history or source drafts", async sourceType => {
  const directory = await mkdtemp(join(tmpdir(), "human2ai-preview-upgrade-"));
  const options = { databasePath: join(directory, "data.sqlite"), artifactsDirectory: directory };
  let server = createHuman2AiServer(options);
  const post = (url: string, payload: object) => server.inject({ method: "POST", url, payload });
  const latest = async (id: string, route = "ui-sketch") => (await server.inject(`/api/v1/sessions/${id}/${route}/drafts/latest`)).json<{ draftVersion: UiSketchDraftVersion }>().draftVersion;
  try {
    const project = (await post("/api/v1/projects", { name: "Upgrade" })).json<{ id: string }>();
    const create = async (title: string, sessionType = "ui-layout") => (await post("/api/v1/sessions", { title, projectId: project.id, sessionType })).json<{ id: string }>().id;
    const source = await create("Source", sourceType), target = await create("Target");
    const route = sourceType === "ui-layout" ? "ui-sketch" : "composition";
    const draft = sourceType === "ui-layout" ? createUiSketchDraft() : createDraft();
    const svg = sourceType === "ui-layout" ? renderUiSketchSvg(createUiSketchDraft()) : renderCompositionReferenceSvg(createDraft());
    await post(`/api/v1/sessions/${source}/${route}/drafts`, { expectedLatestRevision: 0, draft });
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const oldAsset = (await server.inject({ method: "POST", url: `/api/v1/sessions/${target}/assets?filename=preview.png`, headers: { "content-type": "image/png" }, payload: png })).json<{ id: string }>();
    const targetDraft = addUiSessionPreview(createUiSketchDraft(), { assetId: oldAsset.id, width: 960, height: 560,
      reference: { sessionId: source, sessionType: sourceType, stateId: sourceType === "ui-layout" ? "start" : "state-1", renderedRevision: 1 } }, "reference");
    targetDraft.images[0].note = "Keep this edit";
    await post(`/api/v1/sessions/${target}/ui-sketch/drafts`, { expectedLatestRevision: 0, draft: targetDraft });
    await server.close(); server = createHuman2AiServer(options);
    await expect.poll(async () => (await latest(target)).revision).toBe(2);
    const image = (await latest(target)).draft.images[0];
    expect(image).toEqual({ ...targetDraft.images[0], assetId: image.assetId });
    const content = await server.inject(`/api/v1/sessions/${target}/assets/${image.assetId}/content`);
    expect(content.headers["content-type"]).toContain("image/svg+xml");
    expect(content.body).toBe(svg);
    expect((await latest(source, route)).revision).toBe(1);
    const historical = (await server.inject(`/api/v1/sessions/${target}/ui-sketch/drafts/1`)).json<UiSketchDraftVersion>();
    expect(historical.draft.images[0].assetId).toBe(oldAsset.id);
    expect((await server.inject(`/api/v1/sessions/${target}/assets/${oldAsset.id}/content`)).rawPayload).toEqual(png);
    await server.close(); server = createHuman2AiServer(options);
    await new Promise(resolve => setTimeout(resolve, 100));
    expect((await latest(target)).revision).toBe(2);
  } finally { await server.close(); await rm(directory, { recursive: true, force: true }); }
});

it("omits notes from session previews while retaining text content and source metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "human2ai-preview-notes-"));
  const server = createHuman2AiServer({ databasePath: ":memory:", artifactsDirectory: directory });
  const post = async (url: string, payload: object) => server.inject({ method: "POST", url, payload });
  try {
    const project = (await post("/api/v1/projects", { name: "Notes" })).json<{ id: string }>();
    const create = async (title: string) => (await post("/api/v1/sessions", { title, projectId: project.id, sessionType: "ui-layout" })).json<{ id: string }>().id;
    const source = await create("Source"), target = await create("Target");
    const draft = createUiSketchDraft();
    const metadata = { note: "Do not render this note", annotation: "Description", semanticType: "", origin: "user" as const, visible: true, weight: "auto" as const };
    draft.rectangles.push({ ...metadata, id: "region", x: 20, y: 20, width: 300, height: 100 });
    draft.texts.push({ ...metadata, id: "text", x: 20, y: 180, text: "Visible content", fontSize: 24 });
    const expected = structuredClone(draft); expected.rectangles[0].note = "";
    const expectedPng = await sharp(Buffer.from(renderUiSketchSvg(expected))).png().toBuffer();
    expect(expectedPng).not.toEqual(await sharp(Buffer.from(renderUiSketchSvg({ ...expected, texts: [] }))).png().toBuffer());
    const versions = `/api/v1/sessions/${source}/ui-sketch/drafts`;
    await post(versions, { expectedLatestRevision: 0, draft });
    const selector = { sessionId: source, sessionType: "ui-layout", stateId: "start" };
    const preview = (await post(`/api/v1/sessions/${target}/previews`, selector)).json();
    const image = await server.inject(`/api/v1/sessions/${target}/assets/${preview.assetId}/content`);
    expect(image.headers["content-type"]).toContain("image/svg+xml");
    expect(image.body).toBe(renderUiSketchSvg(expected));
    const native = await server.inject(`/api/v1/sessions/${target}/preview?${new URLSearchParams(selector)}`);
    expect(native.headers["content-type"]).toContain("image/svg+xml");
    expect(native.body).toBe(image.body);
    draft.rectangles[0].note = "Edited note"; draft.texts[0].note = "Edited text note";
    await post(versions, { expectedLatestRevision: 1, draft });
    const refreshed = await server.inject(`/api/v1/sessions/${target}/preview.png?${new URLSearchParams(selector)}`);
    expect(refreshed.rawPayload.equals(expectedPng)).toBe(true);
    expect((await server.inject(`/api/v1/sessions/${target}/preview?${new URLSearchParams(selector)}`)).body).toBe(image.body);
    const saved = (await server.inject(`${versions}/latest`)).json<{ draftVersion: UiSketchDraftVersion }>().draftVersion;
    expect(saved.draft.rectangles[0].note).toBe("Edited note");
    expect(saved.draft.texts[0].text).toBe("Visible content");
  } finally { await server.close(); await rm(directory, { recursive: true, force: true }); }
});

it("does not overwrite a newer binding when an older preview finishes late", async () => {
  const directory = await mkdtemp(join(tmpdir(), "human2ai-preview-race-"));
  const server = createHuman2AiServer({ databasePath: ":memory:", artifactsDirectory: directory });
  const post = async (url: string, payload: object) => server.inject({ method: "POST", url, payload });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let entered = false, processedNewerWave = false;
  const original = SessionPreviewService.prototype.render;
  const render = vi.spyOn(SessionPreviewService.prototype, "render").mockImplementation(async function (this: SessionPreviewService, owner, source, revision) {
    if (revision === 2) { entered = true; await gate; }
    if (revision === 3) processedNewerWave = true;
    return original.call(this, owner, source, revision);
  });
  try {
    const project = (await post("/api/v1/projects", { name: "Race" })).json<{ id: string }>();
    const create = async (title: string) => (await post("/api/v1/sessions", { title, projectId: project.id, sessionType: "ui-layout" })).json<{ id: string }>().id;
    const source = await create("Source"), target = await create("Target");
    const save = (id: string, expectedLatestRevision: number, draft: unknown) => post(`/api/v1/sessions/${id}/ui-sketch/drafts`, { expectedLatestRevision, draft });
    const materialize = async () => (await post(`/api/v1/sessions/${target}/previews`, { sessionId: source, sessionType: "ui-layout", stateId: "start" })).json();
    const draft = createUiSketchDraft();
    draft.texts.push({ id: "text", x: 10, y: 10, text: "First", fontSize: 20, origin: "user", visible: true, weight: "auto", note: "", annotation: "", semanticType: "" });
    await save(source, 0, draft);
    const targetDraft = addUiSessionPreview(createUiSketchDraft(), await materialize(), "reference");
    await save(target, 0, targetDraft);
    draft.texts[0].text = "Second";
    await save(source, 1, draft);
    await expect.poll(() => entered).toBe(true);
    draft.texts[0].text = "Third";
    await save(source, 2, draft);
    const latestPreview = await materialize();
    targetDraft.images[0] = { ...targetDraft.images[0], assetId: latestPreview.assetId, previewReference: latestPreview.reference };
    expect((await save(target, 1, targetDraft)).statusCode).toBe(201);
    release();
    await expect.poll(() => processedNewerWave).toBe(true);
    const latest = (await server.inject(`/api/v1/sessions/${target}/ui-sketch/drafts/latest`)).json<{ draftVersion: UiSketchDraftVersion }>().draftVersion;
    expect(latest.revision).toBe(2);
    expect(latest.draft.images[0].previewReference?.renderedRevision).toBe(3);
    expect(latest.draft.images[0].assetId).toBe(latestPreview.assetId);
  } finally { release(); render.mockRestore(); await server.close(); await rm(directory, { recursive: true, force: true }); }
});

it("refreshes cross references once per wave, rejects self references and preserves immutable history", async () => {
  const directory = await mkdtemp(join(tmpdir(), "human2ai-session-preview-"));
  const server = createHuman2AiServer({ databasePath: ":memory:", artifactsDirectory: directory });
  const post = async (url: string, payload: unknown) => server.inject({ method: "POST", url, payload: payload as object });
  try {
    const project = (await post("/api/v1/projects", { name: "Previews" })).json<{ id: string }>();
    const create = async (title: string) => (await post("/api/v1/sessions", { title, projectId: project.id, sessionType: "ui-layout" })).json<{ id: string }>().id;
    const a = await create("A"), b = await create("B");
    const latest = async (id: string) => (await server.inject(`/api/v1/sessions/${id}/ui-sketch/drafts/latest`)).json<{ draftVersion: UiSketchDraftVersion }>().draftVersion;
    const save = async (id: string, revision: number, draft: unknown) => post(`/api/v1/sessions/${id}/ui-sketch/drafts`, { expectedLatestRevision: revision, draft });
    const source = (id: string) => ({ sessionId: id, sessionType: "ui-layout", stateId: "start" });
    const materialize = async (target: string, from: string) => (await post(`/api/v1/sessions/${target}/previews`, source(from))).json();
    const initialB = createUiSketchDraft();
    initialB.texts.push({ id: "b-title", x: 10, y: 10, text: "B", fontSize: 20, visible: true, weight: "auto", origin: "user", note: "", annotation: "", semanticType: "" });
    await save(a, 0, createUiSketchDraft()); await save(b, 0, initialB);
    expect((await post(`/api/v1/sessions/${a}/previews`, source(a))).statusCode).toBe(400);
    const previewA = await materialize(b, a);
    expect(previewA).toHaveProperty("assetId");
    const b1 = await latest(b);
    expect((await save(b, b1.revision, addUiSessionPreview(b1.draft, previewA, "from-a"))).statusCode).toBe(201);
    const previewB = await materialize(a, b);
    const a1 = await latest(a);
    expect((await save(a, a1.revision, addUiSessionPreview(a1.draft, previewB, "from-b"))).statusCode).toBe(201);
    await expect.poll(async () => (await latest(b)).draft.images[0].previewReference?.renderedRevision).toBe(2);
    const beforeA = await latest(a), beforeB = await latest(b);
    const oldAsset = beforeB.draft.images[0].assetId;
    const draft = structuredClone(beforeA.draft);
    draft.texts.push({ id: "text", x: 10, y: 10, text: "Changed", fontSize: 20, visible: true, weight: "auto", origin: "user", note: "", annotation: "", semanticType: "" });
    expect((await save(a, beforeA.revision, draft)).statusCode).toBe(201);
    await expect.poll(async () => (await latest(b)).draft.images[0].assetId).not.toBe(oldAsset);
    const afterA = await latest(a), afterB = await latest(b);
    expect(afterA.revision).toBe(beforeA.revision + 1);
    expect(afterB.revision).toBe(beforeB.revision + 1);
    expect(afterA.draft.images[0].assetId).toBe(beforeA.draft.images[0].assetId);
    const historical = (await server.inject(`/api/v1/sessions/${b}/ui-sketch/drafts/${beforeB.revision}`)).json<UiSketchDraftVersion>();
    expect(historical.draft.images[0].assetId).toBe(oldAsset);
    const invalid = structuredClone(afterA.draft);
    invalid.images[0].previewReference = { ...source(a), sessionType: "ui-layout", renderedRevision: 1 };
    expect((await save(a, afterA.revision, invalid)).statusCode).toBe(400);
    // A nonvisual edit must not create another derived B version.
    const unchanged = structuredClone(afterA.draft); unchanged.overallNote = "metadata";
    await save(a, afterA.revision, unchanged);
    await new Promise(resolve => setTimeout(resolve, 100));
    expect((await latest(b)).revision).toBe(afterB.revision);
  } finally { await server.close(); await rm(directory, { recursive: true, force: true }); }
});

it("selects stable UI/composition states and cameras, enforces projects, and restores deleted-source snapshots", async () => {
  const directory = await mkdtemp(join(tmpdir(), "human2ai-preview-sources-"));
  const server = createHuman2AiServer({ databasePath: ":memory:", artifactsDirectory: directory });
  const post = async (url: string, payload: unknown) => server.inject({ method: "POST", url, payload: payload as object });
  try {
    const project = (await post("/api/v1/projects", { name: "Sources" })).json<{ id: string }>();
    const create = async (sessionType: string, projectId: string | null = project.id) => (await post("/api/v1/sessions", { title: sessionType, sessionType, projectId })).json<{ id: string }>().id;
    const target = await create("ui-layout"), ui = await create("ui-layout"), composition = await create("image-composition"), spatial = await create("spatial"), outside = await create("ui-layout", null);
    const save = async (id: string, kind: string, draft: unknown, expectedLatestRevision = 0) => post(`/api/v1/sessions/${id}/${kind}/drafts`, { draft, expectedLatestRevision });
    const materialize = async (source: object) => post(`/api/v1/sessions/${target}/previews`, source);
    const u = createUiSketchDraft();
    u.texts.push({ id: "text", x: 10, y: 10, text: "State", fontSize: 30, origin: "user", visible: true, weight: "auto", note: "", annotation: "", semanticType: "" });
    const staged = insertUiSketchStage(u, "start", "second"), second = uiSketchDraftForStage(staged, "second");
    second.texts[0].x = 300;
    await save(ui, "ui-sketch", updateUiSketchStageDraft(staged, "second", second));
    let c = addArea(createDraft(), { primitive: "circle", x: .2, y: .2 }).draft;
    c = createCompositionState(c, "state-1", "second"); c.areas[0].x = .8;
    await save(composition, "composition", c);
    const space = createSpatialDraft(); space.cameras[0].width = 128; space.cameras[0].height = 128;
    expect((await save(spatial, "spatial", space)).statusCode).toBe(201); await save(outside, "ui-sketch", u);
    const outputs = [];
    for (const [id, type] of [[ui, "ui-layout"], [composition, "image-composition"]]) {
      const a = await materialize({ sessionId: id, sessionType: type, stateId: type === "ui-layout" ? "start" : "state-1" });
      const b = await materialize({ sessionId: id, sessionType: type, stateId: "second" });
      expect(a.statusCode, a.body).toBe(200); expect(b.statusCode, b.body).toBe(200);
      const imageA = await server.inject(`/api/v1/sessions/${target}/assets/${a.json().assetId}/content`);
      const imageB = await server.inject(`/api/v1/sessions/${target}/assets/${b.json().assetId}/content`);
      expect(imageA.rawPayload).not.toEqual(imageB.rawPayload);
      outputs.push(a.json());
    }
    const camera = await materialize({ sessionId: spatial, sessionType: "spatial", cameraId: "camera-1" });
    expect(camera.statusCode, camera.body).toBe(200); outputs.push(camera.json());
    const draft = outputs.reduce((d, preview, i) => addUiSessionPreview(d, preview, `preview-${i}`), createUiSketchDraft());
    expect((await save(target, "ui-sketch", draft)).statusCode).toBe(201);
    expect((await materialize({ sessionId: outside, sessionType: "ui-layout", stateId: "start" })).statusCode).toBe(400);
    expect((await materialize({ sessionId: ui, sessionType: "ui-layout", stateId: "deleted" })).statusCode).toBe(400);
    const deleted = await server.inject({ method: "DELETE", url: `/api/v1/sessions/${ui}`, payload: { expectedRevision: 1 } });
    expect(deleted.statusCode, deleted.body).toBe(204);
    expect((await save(target, "ui-sketch", { ...draft, images: [] }, 1)).statusCode).toBe(201);
    expect((await save(target, "ui-sketch", draft, 2)).statusCode).toBe(201);
    const restored = await server.inject({ method: "POST", url: `/api/v1/sessions/${target}/ui-sketch/drafts/restore`, payload: { targetRevision: 1, expectedLatestRevision: 3 } });
    expect(restored.statusCode, restored.body).toBe(201);
    const content = await server.inject(`/api/v1/sessions/${target}/assets/${outputs[0].assetId}/content`);
    expect(content.statusCode).toBe(200);
  } finally { await server.close(); await rm(directory, { recursive: true, force: true }); }
});
