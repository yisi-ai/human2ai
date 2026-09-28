import { expect, it } from "vitest";
import { textRegionWarp } from "../../src/domain/composition/text-warp.ts";

it("maps the whole text rectangle to a skewed parallelogram with one transform", () => {
  const corners = [{ x: 96, y: 0 }, { x: 480, y: 0 }, { x: 384, y: 240 }, { x: 0, y: 240 }];
  const patches = textRegionWarp(corners, 480, 240);
  expect(patches).toHaveLength(1);
  const [a, b, c, d, e, f] = patches[0].matrix;
  patches[0].source.forEach((p, i) => {
    expect(a * p.x + c * p.y + e).toBeCloseTo(corners[i].x, 8);
    expect(b * p.x + d * p.y + f).toBeCloseTo(corners[i].y, 8);
  });
});

it("follows perspective throughout a trapezoid, preserving every source triangle", () => {
  const patches = textRegionWarp([{ x: 120, y: 0 }, { x: 360, y: 0 }, { x: 480, y: 240 }, { x: 0, y: 240 }], 480, 240);
  let coveredArea = 0;
  for (const { source, matrix: [a, b, c, d, e, f] } of patches) {
    const [p, q, r] = source;
    coveredArea += Math.abs((q.x - p.x) * (r.y - p.y) - (r.x - p.x) * (q.y - p.y)) / 2;
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4 - i; j++) {
      const x = p.x + (q.x - p.x) * i / 4 + (r.x - p.x) * j / 4;
      const y = p.y + (q.y - p.y) * i / 4 + (r.y - p.y) * j / 4;
      const denominator = 1 - y / 480;
      expect(Math.hypot(a * x + c * y + e - (120 + x / 2 - y / 2) / denominator,
        b * x + d * y + f - y / 2 / denominator)).toBeLessThan(0.31);
    }
  }
  expect(coveredArea).toBeCloseTo(480 * 240, 6);
  expect(patches.length).toBeGreaterThan(2);
  expect(patches.length).toBeLessThanOrEqual(2048);
});
