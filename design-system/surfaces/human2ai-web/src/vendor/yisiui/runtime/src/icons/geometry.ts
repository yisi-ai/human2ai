/** Internal, original construction inspired by curvature-continuous corner research.
 * Two cubics per corner: zero endpoint curvature and matching midpoint derivatives.
 * See docs/migrations/2026-09-06-animated-icons.md for equations and references.
 */
export type Point = readonly [number, number];
export type Cubic = readonly [Point, Point, Point, Point];
const add = (p: Point, v: Point, scale: number): Point => [p[0] + v[0] * scale, p[1] + v[1] * scale];
const length = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const pointText = (p: Point) => p.map(n => Number(n.toFixed(6))).join(" ");

export function smoothCorner(previous: Point, vertex: Point, next: Point, requestedTrim: number, handleRatio = 0.72) {
  const incoming = length(previous, vertex);
  const outgoing = length(vertex, next);
  // Each adjacent corner can consume at most half the shared edge.
  const d = Math.max(0, Math.min(requestedTrim, incoming * 0.49, outgoing * 0.49));
  if (incoming === 0 || outgoing === 0 || d === 0) {
    return { start: vertex, end: vertex, middle: vertex, curves: [] as Cubic[] };
  }
  const u: Point = [(vertex[0] - previous[0]) / incoming, (vertex[1] - previous[1]) / incoming];
  const v: Point = [(next[0] - vertex[0]) / outgoing, (next[1] - vertex[1]) / outgoing];
  const b = handleRatio * d;
  const a = 2 * b - d; // Identical second derivatives at the midpoint.
  const start = add(vertex, u, -d);
  const end = add(vertex, v, d);
  const left = add(start, u, b);
  const right = add(end, v, -b);
  const middle: Point = [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2];
  return {
    start, end, middle,
    curves: [[start, add(start, u, a), left, middle], [middle, right, add(end, v, -a), end]] as Cubic[],
  };
}

export function smoothPath(points: readonly Point[], trims: number | readonly number[], closed = true, handleRatio = 0.72) {
  const corners = points.map((vertex, index) => {
    const trim = !closed && (index === 0 || index === points.length - 1) ? 0
      : typeof trims === "number" ? trims : trims[index] ?? 0;
    return smoothCorner(points[(index + points.length - 1) % points.length], vertex,
      points[(index + 1) % points.length], trim, handleRatio);
  });
  const d = corners.map((corner, index) => `${index === 0 ? "M" : "L"}${pointText(corner.start)}${corner.curves.map(curve =>
    `C${curve.slice(1).map(pointText).join(" ")}`).join("")}`).join("") + (closed ? "Z" : "");
  return { d, corners };
}

export function starVertices(outer = 9.5, inner = 4.8): Point[] {
  return Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const radius = index % 2 === 0 ? outer : inner;
    return [12 + radius * Math.cos(angle), 12.3 + radius * Math.sin(angle)];
  });
}
