export interface CollapsePanelSize {
  key: string;
  weight: number;
  minHeight: number;
}

/** Proportional allocation with minimum heights; overflow stays inside the group. */
export function allocateCollapseHeights(panels: readonly CollapsePanelSize[], available: number): Record<string, number> {
  const heights: Record<string, number> = Object.create(null);
  let remaining = Math.max(available, panels.reduce((sum, panel) => sum + panel.minHeight, 0));
  let pending = [...panels];
  while (pending.length) {
    // Normalize first so large, valid weights cannot overflow their sum.
    const largest = Math.max(...pending.map((panel) => panel.weight));
    const total = pending.reduce((sum, panel) => sum + panel.weight / largest, 0);
    const constrained = pending.filter((panel) => remaining * (panel.weight / largest) / total < panel.minHeight);
    if (!constrained.length) {
      pending.forEach((panel) => { heights[panel.key] = remaining * (panel.weight / largest) / total; });
      break;
    }
    const constrainedKeys = new Set(constrained.map((panel) => panel.key));
    constrained.forEach((panel) => {
      heights[panel.key] = panel.minHeight;
      remaining -= panel.minHeight;
    });
    pending = pending.filter((panel) => !constrainedKeys.has(panel.key));
  }
  return heights;
}

/** Preserve other visible heights and the remembered weights of collapsed panels. */
export function resizeCollapsePair(
  panels: readonly CollapsePanelSize[],
  heights: Readonly<Record<string, number>>,
  weights: Readonly<Record<string, number>>,
  upperKey: string,
  lowerKey: string,
  requestedHeight: number,
): Record<string, number> {
  const upper = panels.find((panel) => panel.key === upperKey)!;
  const lower = panels.find((panel) => panel.key === lowerKey)!;
  const pairHeight = heights[upperKey] + heights[lowerKey];
  const upperHeight = Math.min(pairHeight - lower.minHeight, Math.max(upper.minHeight, requestedHeight));
  const largest = Math.max(...panels.map((panel) => panel.weight));
  const totalWeight = panels.reduce((sum, panel) => sum + panel.weight / largest, 0);
  const totalHeight = panels.reduce((sum, panel) => sum + heights[panel.key], 0);
  // Normalize all weights together, retaining the proportions of hidden panels.
  const next = Object.fromEntries(Object.entries(weights).map(([key, weight]) => [key, weight / largest]));
  for (const panel of panels) {
    const height = panel.key === upperKey ? upperHeight
      : panel.key === lowerKey ? pairHeight - upperHeight : heights[panel.key];
    next[panel.key] = height / totalHeight * totalWeight;
  }
  return next;
}
