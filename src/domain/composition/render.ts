import { compositionLayerOrder } from "./layers.ts";
import { validateDraft } from "./draft.ts";
import {
  COMPOSITION_CANVAS,
  frameBoundsInCanvas,
} from "./frame.ts";
import {
  areaGeometry,
  compositionDraftWorldBounds,
  directionLineGeometry,
  geometryBounds,
} from "./geometry.ts";
import type { CompositionArea, CompositionDraft, CompositionImage } from "./types.ts";

export type CompositionImageSourceResolver = (assetId: string) => string | undefined;

export function renderCompositionSvg(
  input: CompositionDraft,
  resolveImageSource?: CompositionImageSourceResolver,
): string {
  const draft = validateDraft(input);
  const frame = frameBoundsInCanvas(draft.frame);
  const world = compositionDraftWorldBounds(draft);
  const background = [
    `<rect x="${format(world.x)}" y="${format(world.y)}" width="${format(world.width)}" height="${format(world.height)}" fill="#f3f3f3"/>`,
    `<rect x="${format(frame.x)}" y="${format(frame.y)}" width="${format(frame.width)}" height="${format(frame.height)}" fill="#ffffff"/>`,
  ];

  const elements: string[] = [];
  for (const image of draft.images) {
    elements.push(renderImageElement(image, resolveImageSource));
  }

  for (const area of draft.areas) {
    if (area.isLightSource) {
      elements.push(renderCompositionLightSourceSvg(area));
      continue;
    }
    const geometry = areaGeometry(area, COMPOSITION_CANVAS);
    if (geometry.type === "circle") {
      elements.push(
        `<circle cx="${format(geometry.cx)}" cy="${format(geometry.cy)}" r="${format(geometry.radius)}" fill="#c8c8c8" stroke="#000000" stroke-width="4"/>`,
      );
    } else if (geometry.type === "ellipse") {
      elements.push(
        `<ellipse cx="${format(geometry.cx)}" cy="${format(geometry.cy)}" rx="${format(geometry.radiusX)}" ry="${format(geometry.radiusY)}" fill="#c8c8c8" stroke="#000000" stroke-width="4"/>`,
      );
    } else {
      elements.push(
        `<polygon points="${geometry.points.map((point) => `${format(point.x)},${format(point.y)}`).join(" ")}" fill="#c8c8c8" stroke="#000000" stroke-width="4"/>`,
      );
    }
  }

  if (draft.directionLine) {
    const line = directionLineGeometry(draft.directionLine, COMPOSITION_CANVAS);
    elements.push(
      `<line x1="${format(line.start.x)}" y1="${format(line.start.y)}" x2="${format(line.end.x)}" y2="${format(line.end.y)}" stroke="#000000" stroke-width="3"/>`,
    );
  }

  for (const focus of draft.focusPoints) {
    const x = focus.x * COMPOSITION_CANVAS.width;
    const y = focus.y * COMPOSITION_CANVAS.height;
    elements.push([
      `<line x1="${format(x - 14)}" y1="${format(y)}" x2="${format(x + 14)}" y2="${format(y)}" stroke="#000000" stroke-width="3"/>`,
      `<line x1="${format(x)}" y1="${format(y - 14)}" x2="${format(x)}" y2="${format(y + 14)}" stroke="#000000" stroke-width="3"/>`,
      `<circle cx="${format(x)}" cy="${format(y)}" r="9" fill="#ffffff" stroke="#000000" stroke-width="3"/>`,
    ].join(""));
  }

  const orderedElements = [...background, ...orderedCompositionElements(draft, elements)];
  orderedElements.push(
    `<rect x="${format(frame.x)}" y="${format(frame.y)}" width="${format(frame.width)}" height="${format(frame.height)}" fill="none" stroke="#000000" stroke-width="2"/>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${format(world.x)} ${format(world.y)} ${format(world.width)} ${format(world.height)}" width="${format(world.width)}" height="${format(world.height)}" role="img" aria-label="构图草图">
${orderedElements.map((element) => `  ${element}`).join("\n")}
</svg>`;
}

export function renderCompositionReferenceSvg(
  input: CompositionDraft,
  resolveImageSource?: CompositionImageSourceResolver,
): string {
  const draft = validateDraft(input);
  const frame = frameBoundsInCanvas(draft.frame);
  const minimumEdge = Math.min(frame.width, frame.height);
  const strokeWidth = minimumEdge * 0.004;
  const focusRadius = minimumEdge * 0.018;
  const elements = [
    ...draft.images.map((image) => renderImageElement(image, resolveImageSource)),
    ...draft.areas.map((area) => {
    if (area.isLightSource) return renderCompositionLightSourceSvg(area, undefined, "reference");
    const geometry = areaGeometry(area, COMPOSITION_CANVAS);
    const shape = renderReferenceInfluenceZone(
      geometry,
      `data-reference-role="influence-zone" fill="url(#composition-region-gradient)"`,
    );
    if (area.semanticType !== "text-region") {
      return `<g data-region-kind="content-region">${shape}</g>`;
    }

    const bounds = geometryBounds(geometry);
    const width = bounds.maximumX - bounds.minimumX;
    const height = bounds.maximumY - bounds.minimumY;
    const lineHeight = Math.min(height * 0.08, minimumEdge * 0.012);
    const lineGap = lineHeight * 1.1;
    const centerY = (bounds.minimumY + bounds.maximumY) / 2;
    const lineWidths = [0.72, 0.48, 0.62];
    const typography = lineWidths.map((share, index) => {
      const lineWidth = width * share;
      return `<rect x="${format(bounds.minimumX + width * 0.14)}" y="${format(centerY + (index - 1) * (lineHeight + lineGap) - lineHeight / 2)}" width="${format(lineWidth)}" height="${format(lineHeight)}" rx="${format(lineHeight / 2)}" fill="#555555" fill-opacity="0.58"/>`;
    });
    return `<g data-region-kind="text-region">${shape}<g data-reference-role="typography">${typography.join("")}</g></g>`;
    }),
  ];

  if (draft.directionLine) {
    const line = directionLineGeometry(draft.directionLine, COMPOSITION_CANVAS);
    elements.push(
      `<line x1="${format(line.start.x)}" y1="${format(line.start.y)}" x2="${format(line.end.x)}" y2="${format(line.end.y)}" stroke="#1f1f1f" stroke-width="${format(strokeWidth)}" stroke-dasharray="${format(minimumEdge * 0.018)} ${format(minimumEdge * 0.012)}"/>`,
    );
  }

  for (const focus of draft.focusPoints) {
    const x = focus.x * COMPOSITION_CANVAS.width;
    const y = focus.y * COMPOSITION_CANVAS.height;
    elements.push([
      `<line x1="${format(x - focusRadius * 1.8)}" y1="${format(y)}" x2="${format(x + focusRadius * 1.8)}" y2="${format(y)}" stroke="#1f1f1f" stroke-width="${format(strokeWidth)}"/>`,
      `<line x1="${format(x)}" y1="${format(y - focusRadius * 1.8)}" x2="${format(x)}" y2="${format(y + focusRadius * 1.8)}" stroke="#1f1f1f" stroke-width="${format(strokeWidth)}"/>`,
      `<circle cx="${format(x)}" cy="${format(y)}" r="${format(focusRadius)}" fill="#ffffff" stroke="#1f1f1f" stroke-width="${format(strokeWidth)}"/>`,
    ].join(""));
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${draft.frame.width}" height="${draft.frame.height}" viewBox="${format(frame.x)} ${format(frame.y)} ${format(frame.width)} ${format(frame.height)}">`,
    `<defs><radialGradient id="composition-region-gradient"><stop offset="0" stop-color="#8f8f8f" stop-opacity="0.32"/><stop offset="0.58" stop-color="#9a9a9a" stop-opacity="0.22"/><stop offset="1" stop-color="#b8b8b8" stop-opacity="0"/></radialGradient></defs>`,
    `<rect x="${format(frame.x)}" y="${format(frame.y)}" width="${format(frame.width)}" height="${format(frame.height)}" fill="#ffffff"/>`,
    ...orderedCompositionElements(draft, elements),
    "</svg>",
  ].join("");
}

function orderedCompositionElements(draft: CompositionDraft, elements: string[]): string[] {
  const nodes = [...draft.images, ...draft.areas, ...(draft.directionLine ? [draft.directionLine] : []), ...draft.focusPoints];
  const byId = new Map(nodes.map((node, index) => [node.id, elements[index]!]));
  return compositionLayerOrder(draft).map((id) => byId.get(id)!);
}

// Editor geometry stays explicit; generation receives a soft lighting cue,
// not a silhouette to reproduce. Neither rendering specifies emission direction.
export function renderCompositionLightSourceSvg(
  area: CompositionArea,
  gradientId = `composition-light-${area.id}`,
  appearance: "editor" | "reference" = "editor",
): string {
  const id = escapeAttribute(gradientId);
  const geometry = areaGeometry({ ...area, rotation: 0 }, COMPOSITION_CANVAS);
  const reference = appearance === "reference";
  const bounds = geometryBounds(geometry);
  const width = bounds.maximumX - bounds.minimumX;
  const height = bounds.maximumY - bounds.minimumY;
  const attributes = reference
    ? `fill="url(#${id})" stroke="none" filter="url(#${id}-soften)"`
    : `fill="url(#${id})" stroke="#d6b95c" stroke-opacity="0.55" stroke-width="1.5"`;
  const shape = geometry.type === "circle"
    ? `<circle cx="${format(geometry.cx)}" cy="${format(geometry.cy)}" r="${format(geometry.radius)}" ${attributes}/>`
    : geometry.type === "ellipse"
      ? `<ellipse cx="${format(geometry.cx)}" cy="${format(geometry.cy)}" rx="${format(geometry.radiusX)}" ry="${format(geometry.radiusY)}" ${attributes}/>`
      : `<polygon points="${geometry.points.map((point) => `${format(point.x)},${format(point.y)}`).join(" ")}" ${attributes}/>`;
  const gradient = area.primitive === "quadrilateral"
    ? `<linearGradient id="${id}" x1="0" y1="0" x2="${width >= height ? "0" : "1"}" y2="${width >= height ? "1" : "0"}"><stop offset="0" stop-color="#ffe58a" stop-opacity="0"/><stop offset="0.3" stop-color="#ffe58a" stop-opacity="0.5"/><stop offset="0.5" stop-color="#fff8c4" stop-opacity="0.9"/><stop offset="0.7" stop-color="#ffe58a" stop-opacity="0.5"/><stop offset="1" stop-color="#ffe58a" stop-opacity="0"/></linearGradient>`
    : `<radialGradient id="${id}"><stop offset="0" stop-color="#fff8c4" stop-opacity="0.95"/><stop offset="0.55" stop-color="#ffe58a" stop-opacity="${reference ? "0.4" : "0.65"}"/><stop offset="1" stop-color="#ffe58a" stop-opacity="${reference ? "0" : "0.12"}"/></radialGradient>`;
  const soften = reference
    ? `<filter id="${id}-soften" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="${format(Math.min(width, height) * 0.06)}"/></filter>`
    : "";
  return `<g data-region-kind="light-source" data-light-source-id="${escapeAttribute(area.id)}" transform="rotate(${format(area.rotation ?? 0)} ${format(area.x * COMPOSITION_CANVAS.width)} ${format(area.y * COMPOSITION_CANVAS.height)})"><defs>${gradient}${soften}</defs>${shape}</g>`;
}

function renderImageElement(
  image: CompositionImage,
  resolveImageSource?: CompositionImageSourceResolver,
): string {
  const width = image.width * COMPOSITION_CANVAS.width;
  const height = image.height * COMPOSITION_CANVAS.height;
  const centerX = image.x * COMPOSITION_CANVAS.width;
  const centerY = image.y * COMPOSITION_CANVAS.height;
  const x = centerX - width / 2;
  const y = centerY - height / 2;
  const source = image.assetId ? resolveImageSource?.(image.assetId) : undefined;
  const transform = image.rotation
    ? ` transform="rotate(${format(image.rotation)} ${format(centerX)} ${format(centerY)})"`
    : "";
  if (!source) {
    return `<rect data-region-kind="image" x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(height)}" fill="#eeeeee" stroke="#8f8f8f" stroke-width="2"${transform}/>`;
  }
  const crop = image.crop;
  const sourceX = crop ? x - (crop.x / crop.width) * width : x;
  const sourceY = crop ? y - (crop.y / crop.height) * height : y;
  const sourceWidth = crop ? width / crop.width : width;
  const sourceHeight = crop ? height / crop.height : height;
  const clipId = `composition-image-${image.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return `<g data-region-kind="image"${transform}><defs><clipPath id="${clipId}"><rect x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(height)}"/></clipPath></defs><image href="${escapeAttribute(source)}" x="${format(sourceX)}" y="${format(sourceY)}" width="${format(sourceWidth)}" height="${format(sourceHeight)}" preserveAspectRatio="${crop ? "none" : "xMidYMid slice"}" clip-path="url(#${clipId})"/></g>`;
}

function renderReferenceInfluenceZone(
  geometry: ReturnType<typeof areaGeometry>,
  attributes: string,
): string {
  const bounds = geometryBounds(geometry);
  return `<ellipse cx="${format((bounds.minimumX + bounds.maximumX) / 2)}" cy="${format((bounds.minimumY + bounds.maximumY) / 2)}" rx="${format((bounds.maximumX - bounds.minimumX) / 2)}" ry="${format((bounds.maximumY - bounds.minimumY) / 2)}" ${attributes}/>`;
}

function format(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
