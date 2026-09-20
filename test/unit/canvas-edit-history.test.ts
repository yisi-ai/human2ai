import { describe, expect, it } from "vitest";
import { CanvasEditHistory } from "../../src/domain/session/canvas-edit-history.ts";

describe("canvas operation history", () => {
  it("undoes and redoes complete operations, discarding redo after a new edit", () => {
    const history = new CanvasEditHistory({ x: 0 });
    for (const x of [10, 20, 30]) history.record({ x });
    expect(history.undo()?.draft.x).toBe(20);
    expect(history.undo()?.draft.x).toBe(10);
    expect(history.redo()?.draft.x).toBe(20);
    history.record({ x: 40 });
    expect(history.canRedo).toBe(false);
    expect(history.undo()?.draft.x).toBe(20);
    expect(history.undo()?.draft.x).toBe(10);
    expect(history.undo()?.draft.x).toBe(0);
    expect(history.undo()).toBeNull();
  });

  it("groups a gesture and ignores no-op gestures without discarding redo", () => {
    const history = new CanvasEditHistory({ x: 0 });
    const drag = Symbol();
    for (const x of [1, 2, 3]) history.record({ x }, undefined, undefined, drag);
    expect(history.undo()?.draft.x).toBe(0);
    expect(history.canUndo).toBe(false);
    expect(history.record({ x: 0 })).toBe(false);
    expect(history.redo()?.draft.x).toBe(3);
    const returned = Symbol();
    history.record({ x: 10 }, undefined, undefined, returned);
    history.record({ x: 3 }, undefined, undefined, returned);
    expect(history.undo()?.draft.x).toBe(0);
  });

  it("restores state context and retains independent snapshots of deleted content", () => {
    const source = { nodes: [{ id: "a", x: 12 }], states: ["start", "end"] };
    const history = new CanvasEditHistory<typeof source, string>(source);
    history.record({ nodes: [], states: ["start"] }, "end", "start");
    source.nodes[0].x = 99;
    expect(history.undo()).toEqual({ draft: { nodes: [{ id: "a", x: 12 }], states: ["start", "end"] }, context: "end" });
    expect(history.redo()).toEqual({ draft: { nodes: [], states: ["start"] }, context: "start" });
  });

  it("limits history to 100 operations and resets at an external revision", () => {
    const history = new CanvasEditHistory({ x: 0 });
    for (let x = 1; x <= 110; x++) history.record({ x });
    for (let x = 109; x >= 10; x--) expect(history.undo()?.draft.x).toBe(x);
    expect(history.canUndo).toBe(false);
    history.reset({ x: 200 });
    expect(history.canRedo).toBe(false);
    history.record({ x: 201 });
    expect(history.undo()?.draft.x).toBe(200);
  });
});
