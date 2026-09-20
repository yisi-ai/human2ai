import { sortCanvasLayers } from "../canvas-layer-order.ts";
import type { UiSketchDraft } from "./types.ts";

export function renderUiSketchSvg(
  state: UiSketchDraft,
  resolveImageSource?: (assetId: string) => string | undefined,
): string {
  const width = Math.max(1, Math.round(state.frame.width));
  const height = Math.max(1, Math.round(state.frame.height));
  const rectangles = state.rectangles.filter((rectangle) => rectangle.visible).map((rectangle) => {
    const x = rectangle.x - state.frame.x;
    const y = rectangle.y - state.frame.y;
    const note = rectangle.note.trim();
    return { id: rectangle.id, svg: [
      `<rect x="${number(x)}" y="${number(y)}" width="${number(rectangle.width)}" height="${number(rectangle.height)}" rx="8" fill="#eef5ff" stroke="#1677ff" stroke-width="2"/>`,
      ...(note ? svgTextLines(
        note,
        x + rectangle.width / 2,
        y + rectangle.height / 2,
        14,
        "middle",
        true,
      ) : []),
    ].join("") };
  });
  const images = state.images.filter((image) => image.visible).map((image) => {
    const x = image.x - state.frame.x;
    const y = image.y - state.frame.y;
    const source = image.assetId ? resolveImageSource?.(image.assetId) : undefined;
    if (!source) {
      return { id: image.id, svg: `<rect data-element-kind="image" x="${number(x)}" y="${number(y)}" width="${number(image.width)}" height="${number(image.height)}" fill="#eeeeee" stroke="#8f8f8f" stroke-width="2"/>` };
    }
    const crop = image.crop;
    const sourceX = crop ? x - (crop.x / crop.width) * image.width : x;
    const sourceY = crop ? y - (crop.y / crop.height) * image.height : y;
    const sourceWidth = crop ? image.width / crop.width : image.width;
    const sourceHeight = crop ? image.height / crop.height : image.height;
    const clipId = `ui-image-${image.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    return { id: image.id, svg: `<g data-element-kind="image"><defs><clipPath id="${clipId}"><rect x="${number(x)}" y="${number(y)}" width="${number(image.width)}" height="${number(image.height)}"/></clipPath></defs><image href="${escapeXml(source)}" x="${number(sourceX)}" y="${number(sourceY)}" width="${number(sourceWidth)}" height="${number(sourceHeight)}" preserveAspectRatio="${crop ? "none" : "xMidYMid slice"}" clip-path="url(#${clipId})"/></g>` };
  });
  const texts = state.texts.filter((text) => text.visible).map((text) => ({ id: text.id, svg: svgTextLines(
    text.text,
    text.x - state.frame.x,
    text.y - state.frame.y,
    text.fontSize,
    "start",
    false,
  ).join("") }));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="#ffffff"/>',
    '<g font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif" fill="#1f1f1f">',
    ...sortCanvasLayers([...images, ...rectangles, ...texts], state.layerOrder, (node) => node.id).map((node) => node.svg),
    "</g>",
    "</svg>",
  ].join("");
}

function svgTextLines(
  value: string,
  x: number,
  y: number,
  fontSize: number,
  anchor: "start" | "middle",
  verticallyCentered: boolean,
): string[] {
  const lines = value.split("\n");
  const lineHeight = fontSize * 1.4;
  const startY = verticallyCentered
    ? y - ((lines.length - 1) * lineHeight) / 2
    : y + fontSize;
  return lines.map((line, index) => (
    `<text x="${number(x)}" y="${number(startY + index * lineHeight)}" font-size="${number(fontSize)}" text-anchor="${anchor}" dominant-baseline="middle">${escapeXml(line || " ")}</text>`
  ));
}

function number(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
