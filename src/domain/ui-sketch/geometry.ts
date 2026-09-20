import type { UiSketchText } from "./types.ts";

export function uiSketchTextBounds(text: UiSketchText) {
  const lines = text.text.split("\n");
  const longestLine = Math.max(1, ...lines.map((line) => [...line].length));
  return {
    x: text.x,
    y: text.y,
    width: Math.max(text.fontSize, longestLine * text.fontSize * 0.62),
    height: Math.max(text.fontSize, lines.length * text.fontSize * 1.4),
  };
}
