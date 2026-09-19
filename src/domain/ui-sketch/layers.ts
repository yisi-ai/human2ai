import { moveCanvasLayers, resolveCanvasLayerOrder, type CanvasLayerAction } from "../canvas-layer-order.ts";
import { uiSketchSelectionWithGroups } from "./groups.ts";
import type { UiSketchDraft } from "./types.ts";

export function uiSketchLayerOrder(draft: UiSketchDraft): string[] {
  return resolveCanvasLayerOrder([...draft.images, ...draft.rectangles, ...draft.texts].map((node) => node.id), draft.layerOrder);
}

export function reorderUiSketchLayers(draft: UiSketchDraft, selectedIds: readonly string[], action: CanvasLayerAction): UiSketchDraft {
  const order = uiSketchLayerOrder(draft);
  const next = moveCanvasLayers(order, uiSketchSelectionWithGroups(draft, selectedIds), action);
  return next === order ? draft : { ...draft, layerOrder: [...next] };
}
