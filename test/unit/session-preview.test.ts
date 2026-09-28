import { expect, it } from "vitest";
import { previewWaveGroups, previewSourceKey } from "../../src/domain/session/preview.ts";
import { addUiSessionPreview, mergeUiPreviewRefresh } from "../../src/domain/ui-sketch/session-preview.ts";
import { createUiSketchDraft, insertUiSketchStage, uiSketchDraftForStage, updateUiSketchStageDraft } from "../../src/domain/ui-sketch/index.ts";

it("centers a dropped preview at its world position and preserves existing node identities", () => {
  const preview = { reference: { sessionId: "source", sessionType: "spatial" as const, cameraId: "camera", renderedRevision: 2 }, assetId: "preview", width: 800, height: 400 };
  const initial = addUiSessionPreview(createUiSketchDraft(), preview, "existing");
  const dropped = addUiSessionPreview(initial, preview, "dropped", { x: -120, y: 750 });
  expect(dropped.images[1]).toMatchObject({ x: -360, y: 630, width: 480, height: 240, previewReference: preview.reference });
  expect(dropped.images[0]).toBe(initial.images[0]);
  expect(dropped.rectangles).toBe(initial.rectangles);
  expect(dropped.layerOrder?.at(-1)).toBe("dropped");
  const portrait = addUiSessionPreview(initial, { ...preview, width: 100, height: 400 }, "portrait", { x: 50, y: 70 });
  expect(portrait.images[1]).toMatchObject({ x: 15, y: -70, width: 70, height: 280 });
});

it("bounds cycles and orders converging branches before their consumer", () => {
  const groups = previewWaveGroups("a", new Map([
    ["a", ["b"]], ["b", ["a"]], ["c", ["a"]], ["d", ["b", "c"]], ["unrelated", []],
  ]));
  expect(groups.flat().sort()).toEqual(["b", "c", "d"]);
  expect(groups.findIndex(g => g.includes("d"))).toBeGreaterThan(groups.findIndex(g => g.includes("b")));
  expect(groups.findIndex(g => g.includes("d"))).toBeGreaterThan(groups.findIndex(g => g.includes("c")));
  expect(previewWaveGroups("root", new Map([["a", ["root", "b"]], ["b", ["a"]]]))).toEqual([["a", "b"]]);
});

it("retains references across states and merges only preview content into concurrent local edits", () => {
  const reference = { sessionId: "source", sessionType: "ui-layout" as const, stateId: "start", renderedRevision: 1 };
  let base = addUiSessionPreview(createUiSketchDraft(), { reference, assetId: "old", width: 200, height: 100 }, "image");
  base = insertUiSketchStage(base, "start", "end");
  const staged = uiSketchDraftForStage(base, "end");
  staged.images[0].previewReference = { ...reference, stateId: "second" };
  expect(updateUiSketchStageDraft(base, "end", staged).images[0].previewReference).toMatchObject({ stateId: "second" });
  const remote = structuredClone(base);
  remote.images[0].assetId = "new";
  remote.images[0].previewReference!.renderedRevision = 2;
  const local = structuredClone(base);
  local.images[0].note = "final keystroke";
  local.images[0].x = 222;
  const merged = mergeUiPreviewRefresh(local, base, remote)!;
  expect(merged.images[0]).toMatchObject({ assetId: "new", x: 222, note: "final keystroke" });
  expect(merged.rectangles).toBe(local.rectangles);
  expect(mergeUiPreviewRefresh(local, base, base)).toBe(local);
  remote.overallNote = "external authored edit";
  expect(mergeUiPreviewRefresh(local, base, remote)).toBeNull();
  expect(previewSourceKey(reference)).not.toBe(previewSourceKey({ ...reference, stateId: "second" }));
});
