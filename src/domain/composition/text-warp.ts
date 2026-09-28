import type { Point } from "./types.ts";

export interface TextWarpPatch {
  source: Point[];
  target: Point[];
  matrix: number[];
}

/** Portable SVG uses affine patches to approximate the four-corner projective mapping. */
export function textRegionWarp(points: readonly Point[], width: number, height: number): TextWarpPatch[] {
  const [p0, p1, p2, p3] = points;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y;
  const dx = p0.x - p1.x + p2.x - p3.x;
  const dy = p0.y - p1.y + p2.y - p3.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  const g = (dx * dy2 - dx2 * dy) / determinant;
  const h = (dx1 * dy - dx * dy1) / determinant;
  const project = ({ x, y }: Point): Point => {
    const u = x / width, v = y / height;
    const denominator = g * u + h * v + 1;
    return {
      x: ((p1.x - p0.x + g * p1.x) * u + (p3.x - p0.x + h * p3.x) * v + p0.x) / denominator,
      y: ((p1.y - p0.y + g * p1.y) * u + (p3.y - p0.y + h * p3.y) * v + p0.y) / denominator,
    };
  };
  const source = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  // Rectangles and parallelograms need only one exact transform.
  if (Math.abs(g) + Math.abs(h) < 1e-10) {
    return [{ source, target: [...points], matrix: triangleMatrix(source, points) }];
  }
  const patches: TextWarpPatch[] = [];
  const split = (triangle: Point[], depth: number) => {
    const target = triangle.map(project);
    const middle = triangle.map((point, i) => midpoint(point, triangle[(i + 1) % 3]));
    const error = Math.max(...middle.map((point, i) => {
      const actual = project(point), linear = midpoint(target[i], target[(i + 1) % 3]);
      return Math.hypot(actual.x - linear.x, actual.y - linear.y);
    }));
    // Bound both the geometric error for normal canvas sizes and worst-case DOM work.
    if (error > 0.3 && depth < 5) {
      split([triangle[0], middle[0], middle[2]], depth + 1);
      split([middle[0], triangle[1], middle[1]], depth + 1);
      split([middle[2], middle[1], triangle[2]], depth + 1);
      split([middle[0], middle[1], middle[2]], depth + 1);
    } else patches.push({ source: triangle, target, matrix: triangleMatrix(triangle, target) });
  };
  split([source[0], source[1], source[2]], 0);
  split([source[0], source[2], source[3]], 0);
  return patches;
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function triangleMatrix(source: readonly Point[], target: readonly Point[]): number[] {
  const sx1 = source[1].x - source[0].x, sy1 = source[1].y - source[0].y;
  const sx2 = source[2].x - source[0].x, sy2 = source[2].y - source[0].y;
  const tx1 = target[1].x - target[0].x, ty1 = target[1].y - target[0].y;
  const tx2 = target[2].x - target[0].x, ty2 = target[2].y - target[0].y;
  const det = sx1 * sy2 - sx2 * sy1;
  const a = (tx1 * sy2 - tx2 * sy1) / det, b = (ty1 * sy2 - ty2 * sy1) / det;
  const c = (sx1 * tx2 - sx2 * tx1) / det, d = (sx1 * ty2 - sx2 * ty1) / det;
  return [a, b, c, d, target[0].x - a * source[0].x - c * source[0].y,
    target[0].y - b * source[0].x - d * source[0].y];
}
