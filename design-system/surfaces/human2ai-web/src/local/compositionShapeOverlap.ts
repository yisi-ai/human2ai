import { areaGeometry } from "../../../../../src/domain/composition/geometry.ts";
import { COMPOSITION_CANVAS } from "../../../../../src/domain/composition/frame.ts";
import type { CompositionArea } from "../../../../../src/domain/composition/types.ts";
import type { CanvasOverlapShape } from "./canvasShapeOverlap.ts";
import { canvasNodeTone } from "./canvasNodeTone.ts";

export function compositionShapeGeometry(area: CompositionArea): readonly unknown[] {
  return [area.x, area.y, area.primitive, area.area, area.aspect, area.width, area.height,
    area.rotation, ...(area.corners?.flatMap(({ x, y }) => [x, y]) ?? [])];
}

export function compositionOverlapShape(area: CompositionArea): CanvasOverlapShape {
  return {
    id: area.id, tone: canvasNodeTone(area.id), geometry: compositionShapeGeometry(area),
    outline: () => {
      const geometry = areaGeometry(area, COMPOSITION_CANVAS);
      if (geometry.type === "polygon") return geometry.points;
      const rx = geometry.type === "circle" ? geometry.radius : geometry.radiusX;
      const ry = geometry.type === "circle" ? geometry.radius : geometry.radiusY;
      const rotation = (area.rotation ?? 0) * Math.PI / 180;
      // Convex outline for rotated ellipses; no DOM measurements or viewport inputs.
      return Array.from({ length: 128 }, (_, index) => {
        const angle = index * 2 * Math.PI / 128;
        const x = rx * Math.cos(angle), y = ry * Math.sin(angle);
        return { x: geometry.cx + x * Math.cos(rotation) - y * Math.sin(rotation),
          y: geometry.cy + x * Math.sin(rotation) + y * Math.cos(rotation) };
      });
    },
  };
}
