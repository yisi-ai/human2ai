import { moveCanvasLayers, resolveCanvasLayerOrder, type CanvasLayerAction } from "../canvas-layer-order.ts";
import type { CompositionDraft } from "./types.ts";

export function compositionLayerOrder(draft: CompositionDraft): string[] {
  return resolveCanvasLayerOrder([
    ...draft.images, ...draft.areas, ...(draft.directionLine ? [draft.directionLine] : []), ...draft.focusPoints,
  ].map((node) => node.id), draft.layerOrder);
}

export function reorderCompositionLayers(draft: CompositionDraft, selectedIds: readonly string[], action: CanvasLayerAction): CompositionDraft {
  const order = compositionLayerOrder(draft);
  const next = moveCanvasLayers(order, selectedIds, action);
  return next === order ? draft : { ...draft, layerOrder: [...next] };
}
