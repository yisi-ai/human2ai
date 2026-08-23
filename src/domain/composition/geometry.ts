import type {
  AreaGeometry,
  CompositionArea,
  CompositionDraft,
  CompositionFrame,
  DirectionLine,
  DirectionLineGeometry,
  Point,
  VisibleAreaMetrics,
} from "./types.ts";

const ASPECT_RATIOS = {
  square: 1,
  landscape: 1.6,
  portrait: 0.625,
} as const;

export function areaGeometry(area: CompositionArea, frame: CompositionFrame): AreaGeometry {
  const frameArea = frame.width * frame.height;
  const pixelArea = area.area * frameArea;

  if (area.primitive === "circle") {
    return {
      type: "circle",
      cx: area.x * frame.width,
      cy: area.y * frame.height,
      radius: Math.sqrt(pixelArea / Math.PI),
    };
  }

  const center = { x: area.x * frame.width, y: area.y * frame.height };
  if (area.primitive === "quadrilateral") {
    const ratio = area.aspect === "free" ? undefined : ASPECT_RATIOS[area.aspect];
    const width =
      area.aspect === "free" ? area.width! * frame.width : Math.sqrt(pixelArea * ratio!);
    const height = area.aspect === "free" ? area.height! * frame.height : pixelArea / width;
    const points = [
      { x: center.x - width / 2, y: center.y - height / 2 },
      { x: center.x + width / 2, y: center.y - height / 2 },
      { x: center.x + width / 2, y: center.y + height / 2 },
      { x: center.x - width / 2, y: center.y + height / 2 },
    ].map((point) => rotatePoint(point, center, area.rotation ?? 0));
    return { type: "polygon", points, center, width, height };
  }

  const side = Math.sqrt((4 * pixelArea) / Math.sqrt(3));
  const height = (Math.sqrt(3) / 2) * side;
  const points = [
    { x: center.x, y: center.y - (2 * height) / 3 },
    { x: center.x - side / 2, y: center.y + height / 3 },
    { x: center.x + side / 2, y: center.y + height / 3 },
  ].map((point) => rotatePoint(point, center, area.rotation ?? 0));
  return { type: "polygon", points, center, side, height };
}

export function directionLineGeometry(
  directionLine: DirectionLine,
  frame: CompositionFrame,
): DirectionLineGeometry {
  const center = {
    x: directionLine.x * frame.width,
    y: directionLine.y * frame.height,
  };
  const halfLength = Math.hypot(frame.width, frame.height) * 1.1;
  return {
    type: "line",
    center,
    start: pointAt(center, directionLine.rotation + 180, halfLength),
    end: pointAt(center, directionLine.rotation, halfLength),
  };
}

export function calculateVisibleAreaMetrics(draft: CompositionDraft): VisibleAreaMetrics {
  const geometries = draft.areas.map((area) => areaGeometry(area, draft.frame));
  const columns = 180;
  const rows = 120;
  const visibleCounts = geometries.map(() => 0);
  let occupied = 0;
  let centroidX = 0;
  let centroidY = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const point = {
        x: ((column + 0.5) / columns) * draft.frame.width,
        y: ((row + 0.5) / rows) * draft.frame.height,
      };
      let covered = false;
      geometries.forEach((geometry, index) => {
        if (!containsPoint(geometry, point)) return;
        visibleCounts[index] += 1;
        covered = true;
      });
      if (covered) {
        occupied += 1;
        centroidX += (column + 0.5) / columns;
        centroidY += (row + 0.5) / rows;
      }
    }
  }

  const samples = columns * rows;
  const theoreticalArea = draft.areas.reduce((sum, area) => sum + area.area, 0);
  const visibleAreaShares = visibleCounts.map((count) => count / samples);
  const visibleAreaTotal = visibleAreaShares.reduce((sum, area) => sum + area, 0);
  const occupiedArea = occupied / samples;
  return {
    theoreticalArea,
    visibleAreaShares,
    occupiedArea,
    negativeSpace: 1 - occupiedArea,
    clippedArea: Math.max(0, theoreticalArea - visibleAreaTotal),
    overlapArea: Math.max(0, visibleAreaTotal - occupiedArea),
    visualCenter: occupied
      ? { x: centroidX / occupied, y: centroidY / occupied }
      : { x: 0.5, y: 0.5 },
  };
}

export function geometryBounds(geometry: AreaGeometry): {
  minimumX: number;
  maximumX: number;
  minimumY: number;
  maximumY: number;
} {
  if (geometry.type === "circle") {
    return {
      minimumX: geometry.cx - geometry.radius,
      maximumX: geometry.cx + geometry.radius,
      minimumY: geometry.cy - geometry.radius,
      maximumY: geometry.cy + geometry.radius,
    };
  }
  return {
    minimumX: Math.min(...geometry.points.map((point) => point.x)),
    maximumX: Math.max(...geometry.points.map((point) => point.x)),
    minimumY: Math.min(...geometry.points.map((point) => point.y)),
    maximumY: Math.max(...geometry.points.map((point) => point.y)),
  };
}

export function freeDimensionsFromArea(
  area: number,
  frame: CompositionFrame,
  ratio = 1.6,
): Pick<CompositionArea, "width" | "height"> {
  const pixelArea = area * frame.width * frame.height;
  const pixelWidth = Math.sqrt(pixelArea * ratio);
  return {
    width: pixelWidth / frame.width,
    height: pixelArea / pixelWidth / frame.height,
  };
}

export function clampAreaCenter(
  area: CompositionArea,
  frame: CompositionFrame,
): CompositionArea {
  const geometry = areaGeometry({ ...area, x: 0.5, y: 0.5 }, frame);
  const center = { x: frame.width / 2, y: frame.height / 2 };
  let minimumDeltaX: number;
  let maximumDeltaX: number;
  let minimumDeltaY: number;
  let maximumDeltaY: number;

  if (geometry.type === "circle") {
    minimumDeltaX = -geometry.radius;
    maximumDeltaX = geometry.radius;
    minimumDeltaY = -geometry.radius;
    maximumDeltaY = geometry.radius;
  } else {
    const deltas = geometry.points.map((point) => ({
      x: point.x - center.x,
      y: point.y - center.y,
    }));
    minimumDeltaX = Math.min(...deltas.map((point) => point.x));
    maximumDeltaX = Math.max(...deltas.map((point) => point.x));
    minimumDeltaY = Math.min(...deltas.map((point) => point.y));
    maximumDeltaY = Math.max(...deltas.map((point) => point.y));
  }

  return {
    ...area,
    x: clamp(area.x, (-maximumDeltaX * 0.9) / frame.width, 1 + (-minimumDeltaX * 0.9) / frame.width),
    y: clamp(
      area.y,
      (-maximumDeltaY * 0.9) / frame.height,
      1 + (-minimumDeltaY * 0.9) / frame.height,
    ),
  };
}

function containsPoint(geometry: AreaGeometry, point: Point): boolean {
  if (geometry.type === "circle") {
    return Math.hypot(point.x - geometry.cx, point.y - geometry.cy) <= geometry.radius;
  }

  let inside = false;
  for (
    let index = 0, previous = geometry.points.length - 1;
    index < geometry.points.length;
    previous = index++
  ) {
    const first = geometry.points[index];
    const second = geometry.points[previous];
    if (
      first.y > point.y !== second.y > point.y &&
      point.x < ((second.x - first.x) * (point.y - first.y)) / (second.y - first.y) + first.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function rotatePoint(point: Point, center: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const x = point.x - center.x;
  const y = point.y - center.y;
  return {
    x: center.x + x * cosine - y * sine,
    y: center.y + x * sine + y * cosine,
  };
}

function pointAt(center: Point, degrees: number, distance: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: center.x + Math.cos(radians) * distance,
    y: center.y + Math.sin(radians) * distance,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
