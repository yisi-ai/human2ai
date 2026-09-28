import { canvasNodeTone } from "../canvas-node-tone.ts";
import { rectangleOutline } from "../canvas-shape-overlap.ts";
import type { UiSketchRectangle } from "./types.ts";

// The synchronized YisiUI paper palette used by UiSketchCanvas.css.
const PAPER_COLORS = ["#B9CA8B", "#E4B653", "#87C3CC", "#DC938B", "#B79BC8", "#C9825D"];
export const UI_SKETCH_TEXT_COLOR = "#1F292B";
export const UI_SKETCH_TEXT_LINE_HEIGHT = 1.4;

export function uiSketchTextBaseline(fontSize: number, line = 0): number {
  return fontSize * (1 + line * UI_SKETCH_TEXT_LINE_HEIGHT);
}

export function uiSketchRectangleColor(id: string): string {
  return PAPER_COLORS[canvasNodeTone(id)];
}

export function uiSketchRectangleBorderColor(id: string): string {
  const fill = uiSketchRectangleColor(id);
  const channels = [1, 3, 5].map(offset => Math.round(
    parseInt(fill.slice(offset, offset + 2), 16) * 0.25 + parseInt(UI_SKETCH_TEXT_COLOR.slice(offset, offset + 2), 16) * 0.75,
  ));
  return `rgb(${channels.join(",")})`;
}

export function uiSketchRectangleOverlapShapes(rectangles: readonly UiSketchRectangle[]) {
  return rectangles.filter(item => item.visible).map(item => ({
    id: item.id, tone: canvasNodeTone(item.id), geometry: [item.x, item.y, item.width, item.height],
    outline: () => rectangleOutline(item.x, item.y, item.width, item.height),
  }));
}
