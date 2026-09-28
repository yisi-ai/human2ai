import { sortCanvasLayers } from "../canvas-layer-order.ts";
import { createCanvasShapeOverlap } from "../canvas-shape-overlap.ts";
import { UI_SKETCH_TEXT_COLOR, uiSketchRectangleBorderColor, uiSketchRectangleColor, uiSketchRectangleOverlapShapes, uiSketchTextBaseline } from "./appearance.ts";
import type { UiSketchDraft } from "./types.ts";

export function renderUiSketchSvg(
  state: UiSketchDraft,
  resolveImageSource?: (assetId: string) => string | undefined,
): string {
  const width = Math.max(1, Math.round(state.frame.width));
  const height = Math.max(1, Math.round(state.frame.height));
  const borderedRectangles = createCanvasShapeOverlap()(uiSketchRectangleOverlapShapes(state.rectangles));
  const rectangles = state.rectangles.filter((rectangle) => rectangle.visible).map((rectangle) => {
    const x = rectangle.x - state.frame.x;
    const y = rectangle.y - state.frame.y;
    const bounds = `x="${number(x)}" y="${number(y)}" width="${number(rectangle.width)}" height="${number(rectangle.height)}"`;
    const fill = `<rect ${bounds} fill="${uiSketchRectangleColor(rectangle.id)}" fill-opacity="0.82"/>`;
    if (!borderedRectangles.has(rectangle.id)) return { id: rectangle.id, svg: fill };
    const clipId = `ui-rectangle-${rectangle.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    return { id: rectangle.id, svg: `${fill}<defs><clipPath id="${clipId}"><rect ${bounds}/></clipPath></defs><rect ${bounds} fill="none" stroke="${uiSketchRectangleBorderColor(rectangle.id)}" stroke-width="6" clip-path="url(#${clipId})"/>` };
  });
  const images = state.images.filter((image) => image.visible).map((image) => {
    const x = image.x - state.frame.x;
    const y = image.y - state.frame.y;
    const source = image.assetId ? resolveImageSource?.(image.assetId) : undefined;
    if (!source) {
      return { id: image.id, svg: `<rect data-element-kind="image" x="${number(x)}" y="${number(y)}" width="${number(image.width)}" height="${number(image.height)}" fill="#F8FAF9" stroke="#ADBDB8" stroke-width="2"/>` };
    }
    const crop = image.crop;
    const sourceX = crop ? x - (crop.x / crop.width) * image.width : x;
    const sourceY = crop ? y - (crop.y / crop.height) * image.height : y;
    const sourceWidth = crop ? image.width / crop.width : image.width;
    const sourceHeight = crop ? image.height / crop.height : image.height;
    const clipId = `ui-image-${image.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const bounds = `x="${number(x)}" y="${number(y)}" width="${number(image.width)}" height="${number(image.height)}"`;
    return { id: image.id, svg: `<g data-element-kind="image"><rect ${bounds} fill="none" stroke="#ADBDB8" stroke-width="2"/><defs><clipPath id="${clipId}"><rect ${bounds}/></clipPath></defs><image href="${escapeXml(source)}" x="${number(sourceX)}" y="${number(sourceY)}" width="${number(sourceWidth)}" height="${number(sourceHeight)}" preserveAspectRatio="${crop ? "none" : "xMidYMid slice"}" clip-path="url(#${clipId})"/></g>` };
  });
  const texts = state.texts.filter((text) => text.visible).map((text) => ({ id: text.id, svg: svgTextLines(
    text.text,
    text.x - state.frame.x,
    text.y - state.frame.y,
    text.fontSize,
  ) }));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="hidden">`,
    `<defs><clipPath id="ui-preview-frame" clipPathUnits="userSpaceOnUse"><rect width="${width}" height="${height}"/></clipPath></defs>`,
    '<rect width="100%" height="100%" fill="#ffffff"/>',
    `<g clip-path="url(#ui-preview-frame)" font-family="-apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, &quot;PingFang SC&quot;, &quot;Hiragino Sans GB&quot;, &quot;Microsoft YaHei&quot;, sans-serif" font-weight="400" fill="${UI_SKETCH_TEXT_COLOR}">`,
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
): string {
  // Explicit alphabetic baselines match the editor without librsvg's
  // font-fallback-dependent text-before-edge adjustment.
  const lines = value.split("\n").map((line, index) => (
    `<tspan x="0" y="${number(uiSketchTextBaseline(fontSize, index))}">${escapeXml(line || "\u00a0")}</tspan>`
  ));
  return `<g transform="translate(${number(x)} ${number(y)})"><text x="0" y="${number(uiSketchTextBaseline(fontSize))}" font-size="${number(fontSize)}" text-anchor="start" dominant-baseline="alphabetic" xml:space="preserve" style="white-space:pre">${lines.join("")}</text></g>`;
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
