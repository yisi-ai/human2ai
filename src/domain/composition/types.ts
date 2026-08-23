export type Primitive = "circle" | "triangle" | "quadrilateral";
export type AreaAspect = "square" | "free" | "landscape" | "portrait";

export interface Point {
  x: number;
  y: number;
}

export interface CompositionFrame {
  width: number;
  height: number;
}

export interface FocusPoint extends Point {
  id: string;
}

export interface DirectionLine extends Point {
  id: "direction-1";
  rotation: number;
}

export interface CompositionArea extends Point {
  id: string;
  primitive: Primitive;
  area: number;
  aspect: AreaAspect;
  rotation?: number;
  width?: number;
  height?: number;
}

export interface CompositionDraft {
  version: 1;
  kind: "composition-draft";
  frame: CompositionFrame;
  focusPoints: FocusPoint[];
  directionLine: DirectionLine | null;
  areas: CompositionArea[];
}

export interface AddAreaOptions extends Partial<Point> {
  primitive: Primitive;
  area?: number;
  aspect?: AreaAspect;
  rotation?: number;
}

export interface CircleGeometry {
  type: "circle";
  cx: number;
  cy: number;
  radius: number;
}

export interface PolygonGeometry {
  type: "polygon";
  points: Point[];
  center: Point;
  width?: number;
  height: number;
  side?: number;
}

export type AreaGeometry = CircleGeometry | PolygonGeometry;

export interface DirectionLineGeometry {
  type: "line";
  center: Point;
  start: Point;
  end: Point;
}

export interface VisibleAreaMetrics {
  theoreticalArea: number;
  visibleAreaShares: number[];
  occupiedArea: number;
  negativeSpace: number;
  clippedArea: number;
  overlapArea: number;
  visualCenter: Point;
}
