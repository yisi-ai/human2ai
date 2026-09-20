export const CANVAS_LAYER_ACTIONS = ["bringToFront", "bringForward", "sendBackward", "sendToBack"] as const;
export type CanvasLayerAction = typeof CANVAS_LAYER_ACTIONS[number];

/** Back to front; legacy nodes keep their drawing order and new nodes follow saved nodes. */
export function resolveCanvasLayerOrder(ids: readonly string[], order?: readonly string[]): string[] {
  const remaining = new Set(ids);
  const result: string[] = [];
  for (const id of order ?? []) {
    if (remaining.delete(id)) result.push(id);
  }
  return [...result, ...remaining];
}

export function moveCanvasLayers(order: readonly string[], selectedIds: readonly string[], action: CanvasLayerAction): readonly string[] {
  const selected = new Set(selectedIds);
  let next = [...order];
  if (action === "bringToFront" || action === "sendToBack") {
    const moving = order.filter((id) => selected.has(id));
    const staying = order.filter((id) => !selected.has(id));
    next = action === "bringToFront" ? [...staying, ...moving] : [...moving, ...staying];
  } else if (action === "bringForward") {
    for (let index = next.length - 2; index >= 0; index -= 1) {
      if (selected.has(next[index]!) && !selected.has(next[index + 1]!)) {
        [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
      }
    }
  } else {
    for (let index = 1; index < next.length; index += 1) {
      if (selected.has(next[index]!) && !selected.has(next[index - 1]!)) {
        [next[index], next[index - 1]] = [next[index - 1]!, next[index]!];
      }
    }
  }
  return next.every((id, index) => id === order[index]) ? order : next;
}

export function sortCanvasLayers<T>(items: readonly T[], order: readonly string[] | undefined, id: (item: T) => string): T[] {
  const byId = new Map(items.map((item) => [id(item), item]));
  return resolveCanvasLayerOrder([...byId.keys()], order).map((key) => byId.get(key)!);
}
