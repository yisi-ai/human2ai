import { describe, expect, it } from "vitest";
import {
  createUiSketchDraft, insertUiSketchStage, uiSketchDraftForStage,
  validateUiSketchDraft, cloneUiSketchDraft, updateUiSketchStageDraft,
} from "../../src/domain/ui-sketch/draft.ts";
import {
  uiSketchStateTabs, renameUiSketchState, deleteUiSketchState, reorderUiSketchStates,
} from "../../src/domain/ui-sketch/states.ts";

function fixture() {
  const draft = createUiSketchDraft();
  draft.rectangles.push({
    id: "box", x: 10, y: 20, width: 100, height: 50,
    note: "", annotation: "", semanticType: "", origin: "user",
    visible: true, weight: "auto",
  });
  const next = insertUiSketchStage(draft, "start", "end");
  next.stages[0].rectangles[0].x = 200;
  delete next.stateTabs;
  return next;
}

describe("UI interface state management", () => {
  it("reads legacy states without requiring new metadata", () => {
    expect(uiSketchStateTabs(fixture())).toEqual([
      { id: "start", number: 1 }, { id: "end", number: 2 },
    ]);
  });
  it("persists names and order without changing state identity or geometry", () => {
    const original = fixture();
    const renamed = renameUiSketchState(original, "end", "  激活  ");
    const next = reorderUiSketchStates(renamed, ["end", "start"]);
    expect(uiSketchStateTabs(validateUiSketchDraft(next))).toEqual([
      { id: "end", number: 2, name: "激活" }, { id: "start", number: 1 },
    ]);
    expect(uiSketchDraftForStage(next, "end").rectangles[0].x).toBe(200);
    expect(original.stateTabs).toBeUndefined();
    expect(() => renameUiSketchState(next, "end", "  ")).toThrow();
    expect(() => reorderUiSketchStates(next, ["end", "end"])).toThrow();
  });
  it("inserts a snapshot after its source in the displayed order", () => {
    const reordered = reorderUiSketchStates(fixture(), ["end", "start"]);
    const next = insertUiSketchStage(reordered, "end", "third");
    expect(uiSketchStateTabs(next).map(({ id }) => id)).toEqual(["end", "third", "start"]);
    expect(uiSketchDraftForStage(next, "third").rectangles[0].x).toBe(200);
    const cloned = cloneUiSketchDraft(next);
    cloned.stateTabs![0].name = "changed";
    expect(next.stateTabs![0].name).toBeUndefined();
  });
  it("deletes the original state without changing remaining snapshots and retains one state", () => {
    const next = deleteUiSketchState(fixture(), "start");
    expect(uiSketchStateTabs(validateUiSketchDraft(next)).map(({ id }) => id)).toEqual(["end"]);
    expect(uiSketchDraftForStage(next, "end").rectangles[0].x).toBe(200);
    expect(() => deleteUiSketchState(next, "end")).toThrow();
    const added = insertUiSketchStage(next, "end", "third");
    const removed = deleteUiSketchState(added, "end");
    expect(removed.stages.map(({ id }) => id)).toEqual(["third"]);
    expect(uiSketchDraftForStage(removed, "third").rectangles[0].x).toBe(200);
  });
  it("keeps explicit tabs valid when a legacy caller recreates the end stage", () => {
    const single = deleteUiSketchState(fixture(), "end");
    const next = updateUiSketchStageDraft(single, "end", single);
    expect(uiSketchStateTabs(validateUiSketchDraft(next)).map((tab) => tab.id)).toEqual(["start", "end"]);
  });
  it("rejects stale or duplicate state metadata", () => {
    const draft = fixture();
    expect(() => validateUiSketchDraft({ ...draft, stateTabs: [] })).toThrow();
    expect(() => validateUiSketchDraft({ ...draft, stateTabs: [{ id: "missing", number: 1 }] })).toThrow();
    expect(() => validateUiSketchDraft({ ...draft, stateTabs: [{ id: "start", number: 1 }] })).toThrow();
  });
});
