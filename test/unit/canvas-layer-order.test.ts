import { describe, expect, it } from "vitest";
import { moveCanvasLayers, resolveCanvasLayerOrder, sortCanvasLayers } from "../../src/domain/canvas-layer-order.ts";

describe("canvas layer order", () => {
  it("preserves legacy order and reconciles removed and newly added nodes", () => {
    expect(resolveCanvasLayerOrder(["image", "region", "text"])).toEqual(["image", "region", "text"]);
    expect(resolveCanvasLayerOrder(["image", "region", "new"], ["region", "removed", "image"]))
      .toEqual(["region", "image", "new"]);
  });

  it.each([
    ["bringToFront", ["b", "d", "a", "c"]],
    ["bringForward", ["b", "a", "d", "c"]],
    ["sendBackward", ["a", "c", "b", "d"]],
    ["sendToBack", ["a", "c", "b", "d"]],
  ] as const)("%s preserves both selected and unselected relative order", (action, expected) => {
    const order = ["a", "b", "c", "d"];
    expect(moveCanvasLayers(order, ["c", "a"], action)).toEqual(expected);
    expect(order).toEqual(["a", "b", "c", "d"]);
  });

  it("moves adjacent selections together and treats boundary actions as no-ops", () => {
    const order = ["a", "b", "c", "d"];
    expect(moveCanvasLayers(order, ["b", "c"], "bringForward")).toEqual(["a", "d", "b", "c"]);
    expect(moveCanvasLayers(order, ["b", "c"], "sendBackward")).toEqual(["b", "c", "a", "d"]);
    expect(moveCanvasLayers(order, ["c", "d"], "bringForward")).toBe(order);
    expect(moveCanvasLayers(order, ["a", "b"], "sendToBack")).toBe(order);
    expect(moveCanvasLayers(order, order, "bringToFront")).toBe(order);
    expect(moveCanvasLayers(order, ["frame"], "bringToFront")).toBe(order);
  });

  it("sorts rendered content without changing source arrays or dropping hidden-order references", () => {
    const nodes = [{ id: "a" }, { id: "c" }];
    expect(sortCanvasLayers(nodes, ["c", "hidden", "a"], (node) => node.id)).toEqual([nodes[1], nodes[0]]);
    expect(nodes.map((node) => node.id)).toEqual(["a", "c"]);
  });
});
