import { describe, expect, it } from "vitest";
import {
  addArea, addCompositionImage, addDirectionLine, addFocus, createDraft,
  createCompositionState, selectCompositionState, updateItemMetadata, validateDraft,
  renderCompositionSvg, renderCompositionReferenceSvg, inspectComposition, draftFingerprint,
} from "../../src/domain/composition/index.ts";

function fixture() {
  let draft = addArea(createDraft(), { primitive: "quadrilateral" }).draft;
  draft = addFocus(draft, { x: 0.2, y: 0.3 }).draft;
  draft = addDirectionLine(draft).draft;
  return addCompositionImage(draft, { x: 0.7, y: 0.8 }).draft;
}

describe("composition state visibility", () => {
  it("keeps legacy nodes visible and saves independent visibility for every node kind", () => {
    const original = fixture();
    expect(validateDraft(original)).toEqual(original);
    let draft = createCompositionState(original, "state-1", "second");
    for (const id of ["area-1", "focus-1", "direction-1", "image-1"]) {
      draft = updateItemMetadata(draft, id, { visible: false });
    }
    const saved = validateDraft(JSON.parse(JSON.stringify(draft)));
    expect(draftFingerprint(saved)).not.toBe(draftFingerprint(createCompositionState(original, "state-1", "second")));
    expect(saved.areas[0].visible).toBe(false);
    expect(saved.focusPoints[0].visible).toBe(false);
    expect(saved.directionLine?.visible).toBe(false);
    expect(saved.images[0].visible).toBe(false);
    const first = selectCompositionState(saved, "state-1");
    expect([first.areas[0], first.focusPoints[0], first.directionLine!, first.images[0]].every((node) => node.visible !== false)).toBe(true);
    expect(selectCompositionState(first, "second").areas[0].visible).toBe(false);
    expect(createCompositionState(saved, "second", "copy").images[0].visible).toBe(false);
    expect(updateItemMetadata(saved, "area-1", { visible: true }).areas[0].visible).toBe(true);
    expect(() => updateItemMetadata(saved, "missing", { visible: false })).toThrow();
    const invalid = structuredClone(saved);
    Object.assign(invalid.states![0].layout.areas[0], { visible: "false" });
    expect(() => validateDraft(invalid)).toThrow();
  });

  it("omits hidden content from both SVG outputs and inspection without deleting saved nodes", () => {
    let draft = fixture();
    for (const id of ["area-1", "focus-1", "direction-1", "image-1"]) {
      draft = updateItemMetadata(draft, id, { visible: false });
    }
    const empty = createDraft();
    expect(renderCompositionSvg(draft)).toBe(renderCompositionSvg(empty));
    expect(renderCompositionReferenceSvg(draft)).toBe(renderCompositionReferenceSvg(empty));
    expect(inspectComposition(draft).areas).toEqual([]);
    expect(inspectComposition(draft).sourceFingerprint).toBe(draftFingerprint(draft));
    expect(draftFingerprint(draft)).not.toBe(draftFingerprint(fixture()));
    expect(draft.areas).toHaveLength(1);
    expect(draft.images).toHaveLength(1);
  });
});
