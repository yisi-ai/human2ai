import type {
  AreaGeometry,
  CompositionArea,
  CompositionDraft,
  CompositionFrameBounds,
  CompositionFrameSize,
  CompositionImage,
  DirectionLine,
  DirectionLineGeometry,
  Point,
  VisibleAreaMetrics,
} from "./types.ts";
import {
  COMPOSITION_CANVAS,
  compositionWorldBounds,
  frameBoundsInCanvas,
} from "./frame.ts";

const ASPECT_RATIOS = {
  square: 1,
  landscape: 1.6,
  portrait: 0.625,
} as const;

export function areaGeometry(area: CompositionArea, frame: CompositionFrameSize): AreaGeometry {
  const frameArea = frame.width * frame.height;
  const pixelArea = area.area * frameArea;

  if (area.primitive === "circle") {
    if (area.aspect === "free" && area.width && area.height) {
      return {
        type: "ellipse",
        cx: area.x * frame.width,
        cy: area.y * frame.height,
        radiusX: (area.width * frame.width) / 2,
        radiusY: (area.height * frame.height) / 2,
      };
    }
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

  const free = area.aspect === "free" && area.width && area.height;
  const side = free ? area.width! * frame.width : Math.sqrt((4 * pixelArea) / Math.sqrt(3));
  const height = free ? area.height! * frame.height : (Math.sqrt(3) / 2) * side;
  const points = [
    { x: center.x, y: center.y - (2 * height) / 3 },
    { x: center.x - side / 2, y: center.y + height / 3 },
    { x: center.x + side / 2, y: center.y + height / 3 },
  ].map((point) => rotatePoint(point, center, area.rotation ?? 0));
  return { type: "polygon", points, center, side, height };
}

export function directionLineGeometry(
  directionLine: DirectionLine,
  frame: CompositionFrameSize,
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

export function compositionDraftWorldSize(
  draft: CompositionDraft,
  minimumSize: CompositionFrameSize = COMPOSITION_CANVAS,
): CompositionFrameSize {
  const bounds = compositionDraftWorldBounds(draft, minimumSize);
  return { width: bounds.width, height: bounds.height };
}

export function compositionDraftContentBounds(
  draft: CompositionDraft,
): CompositionFrameBounds {
  const frame = frameBoundsInCanvas(draft.frame);
  const bounds = [
    frame,
    ...draft.areas.map((area) => geometryToFrameBounds(areaGeometry(area, COMPOSITION_CANVAS))),
    ...draft.images.map(compositionImageBounds),
    ...draft.focusPoints.map((point) => ({
      x: point.x * COMPOSITION_CANVAS.width - 20,
      y: point.y * COMPOSITION_CANVAS.height - 20,
      width: 40,
      height: 40,
    })),
    ...(draft.directionLine
      ? [
          {
            x: draft.directionLine.x * COMPOSITION_CANVAS.width,
            y: draft.directionLine.y * COMPOSITION_CANVAS.height,
            width: 0,
            height: 0,
          },
        ]
      : []),
  ];
  return unionBounds(bounds);
}

export function compositionImageBounds(image: CompositionImage): CompositionFrameBounds {
  const center = {
    x: image.x * COMPOSITION_CANVAS.width,
    y: image.y * COMPOSITION_CANVAS.height,
  };
  const halfWidth = (image.width * COMPOSITION_CANVAS.width) / 2;
  const halfHeight = (image.height * COMPOSITION_CANVAS.height) / 2;
  const points = [
    { x: center.x - halfWidth, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y + halfHeight },
    { x: center.x - halfWidth, y: center.y + halfHeight },
  ].map((point) => rotatePoint(point, center, image.rotation));
  const minimumX = Math.min(...points.map((point) => point.x));
  const maximumX = Math.max(...points.map((point) => point.x));
  const minimumY = Math.min(...points.map((point) => point.y));
  const maximumY = Math.max(...points.map((point) => point.y));
  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX,
    height: maximumY - minimumY,
  };
}

export function compositionDraftWorldBounds(
  draft: CompositionDraft,
  minimumSize: CompositionFrameSize = COMPOSITION_CANVAS,
): CompositionFrameBounds {
  return unionBounds([
    compositionWorldBounds(draft.frame, minimumSize),
    compositionDraftContentBounds(draft),
  ]);
}

export function calculateVisibleAreaMetrics(draft: CompositionDraft): VisibleAreaMetrics {
  const geometries = draft.areas.map((area) => areaGeometry(area, COMPOSITION_CANVAS));
  const frame = frameBoundsInCanvas(draft.frame);
  const columns = 180;
  const rows = 120;
  const visibleCounts = geometries.map(() => 0);
  let occupied = 0;
  let centroidX = 0;
  let centroidY = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const point = {
        x: frame.x + ((column + 0.5) / columns) * frame.width,
        y: frame.y + ((row + 0.5) / rows) * frame.height,
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
  const frameArea = frame.width * frame.height;
  const canvasArea = COMPOSITION_CANVAS.width * COMPOSITION_CANVAS.height;
  const theoreticalArea = draft.areas.reduce(
    (sum, area) => sum + (area.area * canvasArea) / frameArea,
    0,
  );
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
  if (geometry.type === "ellipse") {
    return {
      minimumX: geometry.cx - geometry.radiusX,
      maximumX: geometry.cx + geometry.radiusX,
      minimumY: geometry.cy - geometry.radiusY,
      maximumY: geometry.cy + geometry.radiusY,
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
  frame: CompositionFrameSize,
  ratio = 1.6,
  primitive: CompositionArea["primitive"] = "quadrilateral",
): Pick<CompositionArea, "width" | "height"> {
  const pixelArea = area * frame.width * frame.height;
  const areaFactor = primitive === "circle" ? Math.PI / 4 : primitive === "triangle" ? 0.5 : 1;
  const pixelWidth = Math.sqrt((pixelArea * ratio) / areaFactor);
  return {
    width: pixelWidth / frame.width,
    height: pixelArea / areaFactor / pixelWidth / frame.height,
  };
}

function containsPoint(geometry: AreaGeometry, point: Point): boolean {
  if (geometry.type === "circle") {
    return Math.hypot(point.x - geometry.cx, point.y - geometry.cy) <= geometry.radius;
  }
  if (geometry.type === "ellipse") {
    const x = (point.x - geometry.cx) / geometry.radiusX;
    const y = (point.y - geometry.cy) / geometry.radiusY;
    return x * x + y * y <= 1;
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

function geometryToFrameBounds(geometry: AreaGeometry): CompositionFrameBounds {
  const bounds = geometryBounds(geometry);
  return {
    x: bounds.minimumX,
    y: bounds.minimumY,
    width: bounds.maximumX - bounds.minimumX,
    height: bounds.maximumY - bounds.minimumY,
  };
}

function unionBounds(bounds: CompositionFrameBounds[]): CompositionFrameBounds {
  const minimumX = Math.min(...bounds.map((item) => item.x));
  const minimumY = Math.min(...bounds.map((item) => item.y));
  const maximumX = Math.max(...bounds.map((item) => item.x + item.width));
  const maximumY = Math.max(...bounds.map((item) => item.y + item.height));
  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX,
    height: maximumY - minimumY,
  };
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
