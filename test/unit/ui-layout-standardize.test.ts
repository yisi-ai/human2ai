import { describe, expect, it } from "vitest";
import {
  createUiSketchDraft,
  standardizeUiSketchDraft,
  uiSketchDraftFingerprint,
  uiSketchDraftForStage,
  updateUiSketchStageDraft,
  validateUiSketchDraft,
} from "../../src/domain/ui-sketch/index.js";

function fixture() {
  const draft = validateUiSketchDraft({
    ...createUiSketchDraft(),
    rectangles: [
      { id: "anchor", x: 98, y: 10, width: 120, height: 40 },
      { id: "button", x: 100.2, y: 80.3, width: 120.3, height: 40.1, origin: "import", note: "保留按钮位置关系" },
      { id: "parked", x: -100.7, y: -90.6, width: 50.3, height: 40.1, visible: false },
    ],
    texts: [{ id: "label", x: 120.2, y: 90.3, fontSize: 14.2, text: "Save", origin: "import" }],
    images: [{ id: "image", x: 400.1, y: 300.6, width: 200.4, height: 150.1, assetId: "asset", crop: { x: 0.1, y: 0.2, width: 0.8, height: 0.5 } }],
    groups: [{ id: "button-group", itemIds: ["button", "label"] }],
  });
  const end = uiSketchDraftForStage(draft, "end");
  end.rectangles[1]!.x += 20;
  end.texts[0]!.x += 20;
  return updateUiSketchStageDraft(draft, "end", end);
}

function plan(draft: unknown, changes = {}) {
  return {
    sourceFingerprint: uiSketchDraftFingerprint(draft),
    alignments: [{ stageId: "start", axis: "x", edge: "start", anchorId: "anchor", itemIds: ["button-group"], ...changes }],
  };
}

describe("UI layout standardization", () => {
  it("rounds geometry in every stage, preserves content, crop fractions and parked nodes, and is idempotent", () => {
    const source = fixture();
    const untouched = structuredClone(source);
    const result = standardizeUiSketchDraft(source);
    expect(result.draft.rectangles[1]).toMatchObject({ x: 100, y: 80, width: 120, height: 40, origin: "import", note: source.rectangles[1]!.note });
    expect(result.draft.rectangles[2]).toMatchObject({ x: -101, y: -91, visible: false });
    expect(result.draft.texts[0]).toMatchObject({ x: 120, y: 90, fontSize: 14, text: "Save" });
    expect(result.draft.images[0]!.crop).toEqual(source.images[0]!.crop);
    expect(result.draft.images[0]!.assetId).toBe("asset");
    expect(result.draft.groups).toEqual(source.groups);
    expect(result.draft.stages[0]!.rectangles[1]!.x).toBe(120);
    expect(result.changes).toEqual(expect.arrayContaining([expect.objectContaining({ stageId: "end", id: "label" })]));
    expect(standardizeUiSketchDraft(result.draft).changes).toEqual([]);
    expect(source).toEqual(untouched);
  });

  it("aligns a group rigidly in the requested stage and treats a member as its whole group", () => {
    const source = fixture();
    const result = standardizeUiSketchDraft(source, plan(source, { itemIds: ["label"] }));
    expect(result.draft.rectangles[1]!.x).toBe(98);
    expect(result.draft.texts[0]!.x).toBe(118);
    expect(result.draft.texts[0]!.x - result.draft.rectangles[1]!.x).toBe(20);
    expect(result.draft.stages[0]!.rectangles[1]!.x).toBe(120);
    expect(result.draft.rectangles[2]!.x).toBe(-101);
    expect(standardizeUiSketchDraft(result.draft, plan(result.draft)).changes).toEqual([]);
  });

  it("rounds positions relative to the interface frame instead of the viewport", () => {
    const source = fixture();
    source.frame.x = 0.6;
    source.frame.y = -0.6;
    source.frame.width = 960.1;
    const result = standardizeUiSketchDraft(source).draft;
    expect(result.frame).toMatchObject({ x: 1, y: -1, width: 960 });
    expect(result.rectangles[1]!.x - result.frame.x).toBe(100);
    expect(result.rectangles[1]!.y - result.frame.y).toBe(81);
  });

  it("supports nearby right-edge and center alignment without copying fractional coordinates", () => {
    const source = fixture();
    source.rectangles[0]!.width = 121;
    const right = standardizeUiSketchDraft(source, plan(source, { edge: "end" })).draft;
    expect(right.rectangles[1]!.x).toBe(99);
    const center = standardizeUiSketchDraft(source, plan(source, { edge: "center" })).draft;
    expect(Number.isInteger(center.rectangles[1]!.x)).toBe(true);
    expect(Math.abs(center.rectangles[1]!.x + 60 - (98 + 60.5))).toBeLessThanOrEqual(0.5);
  });

  it("rejects stale plans, excessive movement, unknown targets, self alignment and incompatible constraints", () => {
    const source = fixture();
    expect(() => standardizeUiSketchDraft(source, { ...plan(source), sourceFingerprint: "stale" })).toThrow("stale");
    expect(() => standardizeUiSketchDraft(source, plan(source, { stageId: "end" }))).toThrow("exceeds 3px");
    expect(() => standardizeUiSketchDraft(source, plan(source, { stageId: "missing" }))).toThrow("Unknown");
    expect(() => standardizeUiSketchDraft(source, plan(source, { itemIds: ["missing"] }))).toThrow("Unknown");
    expect(() => standardizeUiSketchDraft(source, plan(source, { anchorId: "label" }))).toThrow("anchor group");
    expect(() => standardizeUiSketchDraft(source, plan(source, { axis: "z" }))).toThrow("Invalid");
    source.rectangles.push({ ...source.rectangles[0]!, id: "second-anchor", x: 97 });
    source.stages = [];
    const first = plan(source).alignments[0]!;
    expect(() => standardizeUiSketchDraft(source, {
      sourceFingerprint: uiSketchDraftFingerprint(source),
      alignments: [first, { ...first, anchorId: "second-anchor" }],
    })).toThrow("conflict");
    source.rectangles[3]!.x = 95;
    expect(() => standardizeUiSketchDraft(source, {
      sourceFingerprint: uiSketchDraftFingerprint(source),
      alignments: [first, { ...first, anchorId: "second-anchor" }],
    })).toThrow();
  });
});
