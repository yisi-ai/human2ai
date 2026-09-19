import type {
  Human2AiCanvasImageContent,
  Human2AiCanvasNodeMetadata,
  Human2AiCanvasNodeOrigin,
} from "../canvas-node-metadata.ts";
import type { DraftVersion } from "../session/index.ts";

export interface UiSketchBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type UiSketchVisualWeight =
  | "auto"
  | "high"
  | "medium"
  | "low"
  | "decorative";

export type UiSketchNodeOrigin = Human2AiCanvasNodeOrigin;

export interface UiSketchRectangle extends UiSketchBounds, Human2AiCanvasNodeMetadata {
  id: string;
  origin: UiSketchNodeOrigin;
  visible: boolean;
  weight: UiSketchVisualWeight;
}

export interface UiSketchText extends Human2AiCanvasNodeMetadata {
  id: string;
  origin: UiSketchNodeOrigin;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  visible: boolean;
  weight: UiSketchVisualWeight;
}

export interface UiSketchImage
  extends UiSketchBounds, Human2AiCanvasNodeMetadata, Human2AiCanvasImageContent {
  id: string;
  origin: UiSketchNodeOrigin;
  visible: boolean;
  weight: UiSketchVisualWeight;
}

export interface UiSketchStageRectangleState extends UiSketchBounds {
  id: string;
  visible: boolean;
}

export interface UiSketchStageTextState {
  id: string;
  x: number;
  y: number;
  fontSize: number;
  visible: boolean;
}

export type UiSketchStageImageState = UiSketchStageRectangleState;

export interface UiSketchStage {
  id: string;
  rectangles: UiSketchStageRectangleState[];
  texts: UiSketchStageTextState[];
  images: UiSketchStageImageState[];
}

export interface UiSketchGroup {
  id: string;
  itemIds: string[];
}

export interface UiSketchStateTab {
  id: string;
  number: number;
  name?: string;
}

export interface UiSketchDraft {
  layerOrder?: string[];
  version: 1;
  kind: "ui-layout-draft";
  frame: UiSketchBounds;
  overallNote: string;
  rectangles: UiSketchRectangle[];
  texts: UiSketchText[];
  images: UiSketchImage[];
  groups: UiSketchGroup[];
  stages: UiSketchStage[];
  stateTabs?: UiSketchStateTab[];
}

export type UiSketchDraftVersion = DraftVersion<UiSketchDraft>;
