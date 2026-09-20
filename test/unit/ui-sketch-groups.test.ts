import { describe, expect, it } from "vitest";
import {
  cloneUiSketchDraft,
  createUiSketchDraft,
  groupUiSketchItems,
  retainUiSketchGroups,
  uiSketchDraftForStage,
  uiSketchSelectionWithGroups,
  ungroupUiSketchItems,
  updateUiSketchStageDraft,
  validateUiSketchDraft,
} from "../../src/domain/ui-sketch/index.js";

function buttonDraft() {
  return validateUiSketchDraft({
    ...createUiSketchDraft(),
    rectangles: [{ id: "button", x: 100, y: 80, width: 120, height: 40 }],
    texts: [{ id: "label", x: 120, y: 90, fontSize: 14, text: "Save" }],
    images: [{ id: "icon", x: 108, y: 90, width: 16, height: 16 }],
  });
}

describe("UI sketch groups", () => {
  it("retains editable members and geometry when grouping, cloning, selecting and ungrouping", () => {
    const original = buttonDraft();
    const grouped = groupUiSketchItems(original, ["button", "label"], "button-group");
    expect(grouped.groups).toEqual([{ id: "button-group", itemIds: ["button", "label"] }]);
    expect(uiSketchSelectionWithGroups(grouped, ["label"])).toEqual(["label", "button"]);
    expect(validateUiSketchDraft(grouped)).toEqual(grouped);
    const clone = cloneUiSketchDraft(grouped);
    clone.groups[0]!.itemIds.push("icon");
    expect(grouped.groups[0]!.itemIds).toEqual(["button", "label"]);
    expect(ungroupUiSketchItems(grouped, ["label"])).toEqual(original);
  });

  it("flattens existing groups when joining selections and removes orphan membership after deletion", () => {
    const grouped = groupUiSketchItems(buttonDraft(), ["button", "label"], "button-group");
    const joined = groupUiSketchItems(grouped, ["label", "icon"], "joined");
    expect(joined.groups).toHaveLength(1);
    expect(new Set(joined.groups[0]!.itemIds)).toEqual(new Set(["button", "label", "icon"]));
    expect(retainUiSketchGroups(joined.groups, ["button", "label"]))
      .toEqual([{ id: "joined", itemIds: ["label", "button"] }]);
    expect(retainUiSketchGroups(joined.groups, ["label"])).toEqual([]);
  });

  it("shares membership across motion stages while keeping geometry isolated", () => {
    const original = buttonDraft();
    const end = uiSketchDraftForStage(original, "end");
    end.rectangles[0]!.x += 60;
    end.texts[0]!.x += 60;
    const grouped = groupUiSketchItems(end, ["button", "label"], "button-group");
    const saved = updateUiSketchStageDraft(original, "end", grouped);
    expect(saved.groups).toEqual(grouped.groups);
    expect(saved.rectangles[0]!.x).toBe(100);
    expect(uiSketchDraftForStage(saved, "end").rectangles[0]!.x).toBe(160);
    expect(validateUiSketchDraft(saved)).toEqual(saved);
  });

  it("accepts legacy drafts and rejects ambiguous or invalid membership", () => {
    const { groups: _groups, ...legacy } = buttonDraft();
    expect(validateUiSketchDraft(legacy).groups).toEqual([]);
    for (const groups of [
      null,
      [{ id: "g", itemIds: ["button"] }],
      [{ id: "g", itemIds: ["button", "button"] }],
      [{ id: "g", itemIds: ["button", "missing"] }],
      [{ id: "button", itemIds: ["button", "label"] }],
      [{ id: "g", itemIds: ["button", "label"] }, { id: "other", itemIds: ["label", "icon"] }],
      [{ id: "g", itemIds: ["button", "label"] }, { id: "g", itemIds: ["button", "icon"] }],
    ]) {
      expect(() => validateUiSketchDraft({ ...legacy, groups })).toThrow();
    }
    expect(() => groupUiSketchItems(buttonDraft(), ["button"], "g")).toThrow();
    expect(() => groupUiSketchItems(buttonDraft(), ["button", "missing"], "g")).toThrow();
  });
});
