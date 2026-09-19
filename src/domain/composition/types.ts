import type {
  Human2AiCanvasImageContent,
  Human2AiCanvasNodeMetadata,
} from "../canvas-node-metadata.ts";
import type { CanvasStateTab } from "../canvas-states.ts";

export type Primitive = "circle" | "triangle" | "quadrilateral";
export type AreaAspect = "square" | "free" | "landscape" | "portrait";
export type CompositionShotScale = "auto" | "foreground" | "midground" | "background";
export type CompositionProcessingSemantic = "scene-composition" | "editorial-layout";
export type CompositionVisualWeight =
  | "auto"
  | "high"
  | "medium"
  | "low"
  | "decorative";

export interface CompositionNodeMetadata extends Human2AiCanvasNodeMetadata {
  shotScale: CompositionShotScale;
}

export type CompositionNodeMetadataPatch = Partial<CompositionNodeMetadata>;

export interface Point {
  x: number;
  y: number;
}

export interface CompositionFrameSize {
  width: number;
  height: number;
}

export interface CompositionFrameBounds extends Point {
  width: number;
  height: number;
}

export interface CompositionFrame extends CompositionFrameSize {
  bounds: CompositionFrameBounds;
}

export type CompositionFrameCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface FocusPoint extends Point, CompositionNodeMetadata {
  id: string;
}

export interface DirectionLine extends Point, CompositionNodeMetadata {
  id: "direction-1";
  rotation: number;
}

export interface CompositionArea extends Point, CompositionNodeMetadata {
  id: string;
  primitive: Primitive;
  area: number;
  aspect: AreaAspect;
  visualWeight: CompositionVisualWeight;
  displayText?: string;
  isLightSource?: boolean;
  rotation?: number;
  width?: number;
  height?: number;
}

export interface CompositionImage
  extends Point, CompositionNodeMetadata, Human2AiCanvasImageContent {
  id: string;
  width: number;
  height: number;
  rotation: number;
  visualWeight: CompositionVisualWeight;
  cameraReference?: {
    sessionId: string;
    cameraId: string;
    renderedRevision: number;
  };
}

export type CompositionAreaMetadataPatch = Partial<
  Pick<CompositionArea, "visualWeight" | "displayText" | "isLightSource">
>;

export interface CompositionDraft {
  states?: CompositionState[];
  activeStateId?: string;
  layerOrder?: string[];
  version: 1;
  kind: "composition-draft";
  processingSemantic: CompositionProcessingSemantic | null;
  frame: CompositionFrame;
  overallNote: string;
  focusPoints: FocusPoint[];
  directionLine: DirectionLine | null;
  areas: CompositionArea[];
  images: CompositionImage[];
}

export interface CompositionLayout {
  frame: CompositionFrame;
  layerOrder: string[];
  focusPoints: Pick<FocusPoint, "id" | "x" | "y">[];
  directionLine: Pick<DirectionLine, "id" | "x" | "y" | "rotation"> | null;
  areas: Pick<CompositionArea, "id" | "x" | "y" | "area" | "aspect" | "rotation" | "width" | "height">[];
  images: Pick<CompositionImage, "id" | "x" | "y" | "width" | "height" | "rotation">[];
}

export interface CompositionState extends CanvasStateTab {
  layout: CompositionLayout;
}

export type CompositionClipboardItem =
  | { kind: "focus"; item: FocusPoint }
  | { kind: "direction"; item: DirectionLine }
  | { kind: "area"; item: CompositionArea }
  | { kind: "image"; item: CompositionImage };

export interface PasteCompositionItemsResult {
  draft: CompositionDraft;
  ids: string[];
}

export interface AddAreaOptions extends Partial<Point> {
  primitive: Primitive;
  area?: number;
  aspect?: AreaAspect;
  rotation?: number;
}

export interface AddCompositionImageOptions extends Partial<Point> {
  width?: number;
  height?: number;
  rotation?: number;
}

export interface CircleGeometry {
  type: "circle";
  cx: number;
  cy: number;
  radius: number;
}

export interface EllipseGeometry {
  type: "ellipse";
  cx: number;
  cy: number;
  radiusX: number;
  radiusY: number;
}

export interface PolygonGeometry {
  type: "polygon";
  points: Point[];
  center: Point;
  width?: number;
  height: number;
  side?: number;
}

export type AreaGeometry = CircleGeometry | EllipseGeometry | PolygonGeometry;

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
