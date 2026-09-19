import { afterEach, describe, expect, it, vi } from "vitest";
import * as shared from "../../src/domain/canvas-states.ts";
import { createUiSketchDraft, insertUiSketchStage } from "../../src/domain/ui-sketch/draft.ts";
import { renameUiSketchState, reorderUiSketchStates, deleteUiSketchState } from "../../src/domain/ui-sketch/states.ts";
import { createDraft, createCompositionState, renameCompositionState, reorderCompositionStates, deleteCompositionState } from "../../src/domain/composition/index.ts";
import { registeredCapability } from "../helpers/domain-baseline.ts";

afterEach(() => vi.restoreAllMocks());

it("covers every registered state metadata adapter", () => {
  expect(registeredCapability("capture.named-states").implementations
    .filter(({ role }) => role === "adapter").map(({ path }) => path).sort())
    .toEqual(["src/domain/composition/states.ts", "src/domain/ui-sketch/states.ts"]);
});

describe.each([
  { name: "UI", make: () => insertUiSketchStage(createUiSketchDraft(), "start", "end"),
    rename: renameUiSketchState, reorder: reorderUiSketchStates, remove: deleteUiSketchState, id: "start", ids: ["end", "start"] },
  { name: "composition", make: () => createCompositionState(createDraft(), "state-1", "end"),
    rename: renameCompositionState, reorder: reorderCompositionStates, remove: deleteCompositionState, id: "state-1", ids: ["end", "state-1"] },
])("$name state metadata adapter", (adapter) => {
  it("delegates shared rename, order and minimum-state rules", () => {
    const draft = adapter.make();
    const failure = new Error("shared state boundary");
    for (const [method, operation, args] of [
      ["renameCanvasState", adapter.rename, [draft, adapter.id, "Name"]],
      ["reorderCanvasStates", adapter.reorder, [draft, adapter.ids]],
      ["removeCanvasState", adapter.remove, [draft, adapter.id]],
    ] as const) {
      const spy = vi.spyOn(shared, method).mockImplementation(() => { throw failure; });
      expect(() => Reflect.apply(operation, undefined, args)).toThrow(failure);
      expect(spy).toHaveBeenCalledOnce();
      spy.mockRestore();
    }
  });
});

it("renames immutably, accepts only an exact permutation, and retains one state", () => {
  const states = [{ id: "a", number: 1 }, { id: "b", number: 2 }];
  expect(shared.renameCanvasState(states, "a", "  Named  ")[0]).toEqual({ id: "a", number: 1, name: "Named" });
  expect(states[0]).not.toHaveProperty("name");
  expect(() => shared.renameCanvasState(states, "a", "a".repeat(101))).toThrow();
  expect(shared.reorderCanvasStates(states, ["b", "a"]).map(({ id }) => id)).toEqual(["b", "a"]);
  expect(() => shared.reorderCanvasStates(states, ["a", "a"])).toThrow();
  expect(() => shared.removeCanvasState([states[0]], "a")).toThrow();
});
