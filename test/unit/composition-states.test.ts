import { describe, expect, it } from "vitest";
import {
  addArea, addCompositionImage, addDirectionLine, addFocus, addTextRegion, changeFrame,
  compositionLayerOrder, createDraft, moveFrame, moveItem, removeItem, resizeFreeArea,
  rotateArea, reorderCompositionLayers, updateAreaMetadata, updateCompositionImage, validateDraft,
  compositionStates, createCompositionState, selectCompositionState,
  renameCompositionState, reorderCompositionStates, deleteCompositionState,
  draftFingerprint,
} from "../../src/domain/composition/index.ts";

function fixture() {
  let draft = addArea(createDraft(), { primitive: "quadrilateral", x: 0.2, y: 0.3 }).draft;
  draft = addTextRegion(draft, { x: 0.4, y: 0.5 }).draft;
  draft = addCompositionImage(draft, { x: 0.6, y: 0.7 }).draft;
  draft = addFocus(draft, { x: 0.2, y: 0.4 }).draft;
  return addDirectionLine(draft).draft;
}

describe("composition layout states", () => {
  it("exposes one state for legacy drafts without changing their stored representation", () => {
    const draft = fixture();
    expect(compositionStates(draft).map(({ id, number }) => ({ id, number })))
      .toEqual([{ id: "state-1", number: 1 }]);
    expect(validateDraft(draft)).toEqual(draft);
    expect(draft.states).toBeUndefined();
  });

  it("switches frame bounds, ratio, geometry and layers without leaking layouts", () => {
    const original = fixture();
    let draft = createCompositionState(original, "state-1", "portrait");
    expect(draft.activeStateId).toBe("portrait");
    draft = changeFrame(draft, { width: 900, height: 1600 });
    draft = moveFrame(draft, { x: 0.3, y: 0.2 });
    draft = moveItem(draft, "area-1", { x: 0.8, y: 0.6 });
    draft = resizeFreeArea(draft, "area-1", 0.3, 0.2);
    draft = rotateArea(draft, "area-1", 30);
    draft = moveItem(draft, "image-1", { x: 0.1, y: 0.2 });
    draft = moveItem(draft, "focus-1", { x: 0.7, y: 0.8 });
    draft = moveItem(draft, "direction-1", { x: 0.1, y: 0.3 });
    draft = reorderCompositionLayers(draft, ["area-1"], "bringToFront");
    const portrait = validateDraft(draft);
    const first = selectCompositionState(portrait, "state-1");
    expect(first.frame).toEqual(original.frame);
    expect(first.areas).toEqual(original.areas);
    expect(first.images).toEqual(original.images);
    expect(first.focusPoints).toEqual(original.focusPoints);
    expect(first.directionLine).toEqual(original.directionLine);
    expect(compositionLayerOrder(first)).toEqual(compositionLayerOrder(original));
    expect(selectCompositionState(first, "portrait")).toEqual(portrait);
    expect(original.states).toBeUndefined();
  });

  it("shares content, node creation and deletion while retaining existing state geometry", () => {
    let draft = createCompositionState(fixture(), "state-1", "second");
    draft = moveItem(draft, "area-2", { x: 0.9, y: 0.8 });
    draft = updateAreaMetadata(draft, "area-2", { displayText: "Shared text" });
    draft = updateCompositionImage(draft, "image-1", { assetId: "shared-image" });
    draft = addArea(draft, { primitive: "triangle", x: 0.15, y: 0.25 }).draft;
    draft = removeItem(draft, "area-1");
    const first = selectCompositionState(draft, "state-1");
    expect(first.areas.map(({ id }) => id)).toEqual(["area-2", "area-3"]);
    expect(first.areas[0]).toMatchObject({ x: 0.4, y: 0.5, displayText: "Shared text" });
    expect(first.areas[1]).toMatchObject({ x: 0.15, y: 0.25 });
    expect(first.images[0].assetId).toBe("shared-image");
    expect(selectCompositionState(first, "second").areas[0].x).toBe(0.9);
  });

  it("does not resurrect a deleted node layout when its id is reused", () => {
    let draft = createCompositionState(fixture(), "state-1", "second");
    draft = removeItem(draft, "direction-1");
    draft = addDirectionLine(draft).draft;
    draft = moveItem(draft, "direction-1", { x: 0.9, y: 0.8 });
    // New nodes inherit their initial placement; subsequent edits affect only the active state.
    expect(selectCompositionState(draft, "state-1").directionLine?.x).toBe(0.5);
  });

  it("copies the targeted state, preserves names and order, and deletes only its layout", () => {
    let draft = createCompositionState(fixture(), "state-1", "second");
    draft = moveItem(draft, "area-1", { x: 0.9, y: 0.8 });
    draft = renameCompositionState(draft, "second", "  竖版  ");
    draft = reorderCompositionStates(draft, ["second", "state-1"]);
    draft = createCompositionState(draft, "state-1", "third");
    expect(compositionStates(draft).map(({ id }) => id)).toEqual(["second", "state-1", "third"]);
    expect(draft.areas[0].x).toBe(0.2);
    draft = deleteCompositionState(draft, "third");
    expect(draft.activeStateId).toBe("state-1");
    draft = deleteCompositionState(draft, "state-1");
    expect(draft.activeStateId).toBe("second");
    expect(draft.areas[0].x).toBe(0.9);
    expect(compositionStates(draft)[0].name).toBe("竖版");
    expect(() => deleteCompositionState(draft, "second")).toThrow();
    expect(() => renameCompositionState(draft, "second", " ")).toThrow();
    expect(() => reorderCompositionStates(draft, ["missing"])).toThrow();
  });

  it("rejects invalid state metadata and malformed inactive layouts", () => {
    const draft = createCompositionState(fixture(), "state-1", "second");
    expect(() => validateDraft({ ...draft, states: [] })).toThrow();
    expect(() => validateDraft({ ...draft, activeStateId: "missing" })).toThrow();
    expect(() => validateDraft({ ...draft, states: [draft.states![0], draft.states![0]] })).toThrow();
    const malformed = structuredClone(draft);
    malformed.states![0].layout.frame.width = 1;
    expect(() => validateDraft(malformed)).toThrow();
    const content = structuredClone(draft);
    Object.assign(content.states![0].layout.areas[0], { note: "Must remain shared" });
    expect(() => validateDraft(content)).toThrow();
  });

  it("includes inactive layouts and names in the persisted draft fingerprint", () => {
    const draft = createCompositionState(fixture(), "state-1", "second");
    expect(draftFingerprint(renameCompositionState(draft, "second", "Renamed"))).not.toBe(draftFingerprint(draft));
    const changed = structuredClone(draft);
    changed.states![0].layout.areas[0].x = 0.99;
    expect(draftFingerprint(changed)).not.toBe(draftFingerprint(draft));
    expect(draftFingerprint(JSON.parse(JSON.stringify(draft)))).toBe(draftFingerprint(draft));
  });
});
