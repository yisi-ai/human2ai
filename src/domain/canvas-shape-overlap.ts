export interface CanvasOutlinePoint { x: number; y: number }
export interface CanvasOverlapShape {
  id: string;
  tone: number;
  geometry: readonly unknown[];
  outline: () => readonly CanvasOutlinePoint[];
}
type Entry = CanvasOverlapShape & {
  points: readonly CanvasOutlinePoint[];
  bounds: { left: number; right: number; top: number; bottom: number };
  borders: Map<string, boolean>;
};

const EPSILON = 1e-7;

function contains(outer: readonly CanvasOutlinePoint[], inner: readonly CanvasOutlinePoint[]): boolean {
  return inner.every((point) => {
    let sign = 0;
    for (let i = 0; i < outer.length; i += 1) {
      const a = outer[i], b = outer[(i + 1) % outer.length];
      const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
      if (Math.abs(cross) <= EPSILON) continue;
      if (sign && Math.sign(cross) !== sign) return false;
      sign = Math.sign(cross);
    }
    return true;
  });
}

function intersects(a: readonly CanvasOutlinePoint[], b: readonly CanvasOutlinePoint[]): boolean {
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i += 1) {
      const start = polygon[i], end = polygon[(i + 1) % polygon.length];
      const nx = end.y - start.y, ny = start.x - end.x;
      const project = (points: readonly CanvasOutlinePoint[]) => {
        const values = points.map((point) => point.x * nx + point.y * ny);
        return [Math.min(...values), Math.max(...values)];
      };
      const [amin, amax] = project(a), [bmin, bmax] = project(b);
      if (Math.min(amax, bmax) - Math.max(amin, bmin) <= EPSILON) return false;
    }
  }
  return true;
}

// Recompute relations only for changed geometry. Deletion removes its incident
// relations; it never reconstructs surviving outlines or rechecks other pairs.
export function createCanvasShapeOverlap() {
  const entries = new Map<string, Entry>();
  return (shapes: readonly CanvasOverlapShape[]): ReadonlySet<string> => {
    const incoming = new Map(shapes.map((shape) => [shape.id, shape]));
    const changed = new Set<string>();
    for (const [id, old] of entries) {
      const next = incoming.get(id);
      if (next && old.tone === next.tone && old.geometry.length === next.geometry.length && old.geometry.every((value, index) => Object.is(value, next.geometry[index]))) continue;
      for (const peer of old.borders.keys()) entries.get(peer)?.borders.delete(id);
      entries.delete(id);
    }
    for (const shape of shapes) {
      if (entries.has(shape.id)) continue;
      const points = shape.outline();
      entries.set(shape.id, { ...shape, points, borders: new Map(), bounds: {
        left: Math.min(...points.map((point) => point.x)), right: Math.max(...points.map((point) => point.x)),
        top: Math.min(...points.map((point) => point.y)), bottom: Math.max(...points.map((point) => point.y)),
      } });
      changed.add(shape.id);
    }
    for (const id of changed) {
      const a = entries.get(id)!;
      for (const b of entries.values()) {
        if (a.id === b.id || a.tone !== b.tone || (changed.has(b.id) && b.id < a.id)) continue;
        if (a.bounds.right <= b.bounds.left || b.bounds.right <= a.bounds.left
          || a.bounds.bottom <= b.bounds.top || b.bounds.bottom <= a.bounds.top) continue;
        if (!intersects(a.points, b.points)) continue;
        const aContainsB = contains(a.points, b.points), bContainsA = contains(b.points, a.points);
        a.borders.set(b.id, !aContainsB || bContainsA);
        b.borders.set(a.id, !bContainsA || aContainsB);
      }
    }
    return new Set([...entries.values()].filter((entry) => [...entry.borders.values()].some(Boolean)).map(({ id }) => id));
  };
}

export function rectangleOutline(x: number, y: number, width: number, height: number): CanvasOutlinePoint[] {
  return [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
}
