import { renderUiSketchPng, renderUiSketchSvg } from "./uiSketchExport";
import type { UiSketchDraft } from "./uiSketchDraft";

export async function checkUiSketchPreviewPixels(canvas: HTMLElement, draft: UiSketchDraft, source: (id: string) => string | undefined): Promise<void> {
  await document.fonts.ready;
  const scene = canvas.querySelector<SVGSVGElement>("[data-ui-sketch-scene]")!;
  const ns = "http://www.w3.org/2000/svg";
  const actual = document.createElementNS(ns, "svg");
  const { x, y, width, height } = draft.frame;
  actual.setAttribute("width", String(width)); actual.setAttribute("height", String(height));
  actual.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  const background = document.createElementNS(ns, "rect");
  for (const [key, value] of Object.entries({ x, y, width, height, fill: "white" })) background.setAttribute(key, String(value));
  actual.append(background);
  // Capture the live visual nodes and computed styles, excluding editing controls.
  for (const node of scene.querySelectorAll<SVGGraphicsElement>(
    '.human2ai-ui-sketch-canvas__rectangle-surface,.human2ai-ui-sketch-canvas__text-content,[data-ui-sketch-kind="image"] .human2ai-canvas-image',
  )) {
    const copy = node.cloneNode(true) as SVGGraphicsElement;
    const originals = [node, ...node.querySelectorAll<SVGElement>("*")];
    const copies = [copy, ...copy.querySelectorAll<SVGElement>("*")];
    originals.forEach((element, index) => {
      const style = getComputedStyle(element);
      for (const property of ["fill", "fill-opacity", "stroke", "stroke-width", "font-family", "font-size", "font-weight", "white-space", "dominant-baseline", "clip-path"]) {
        copies[index].style.setProperty(property, style.getPropertyValue(property));
      }
    });
    const matrix = scene.getCTM()!.inverse().multiply(node.getCTM()!);
    const group = document.createElementNS(ns, "g");
    group.setAttribute("transform", `matrix(${[matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].map(value => Math.round(value * 1e8) / 1e8).join(" ")})`);
    group.append(copy); actual.append(group);
  }
  const expected = await raster(new Blob([new XMLSerializer().serializeToString(actual)], { type: "image/svg+xml" }));
  const preview = await raster(new Blob([renderUiSketchSvg(draft, source)], { type: "image/svg+xml" }));
  compare(expected, preview, "SVG preview");
  // Use blob URLs as real canvas image nodes do. SVG-as-image cannot fetch them:
  // copying must embed their bytes before the browser renders the final PNG.
  const resources = new Map<string, string>();
  try {
    for (const image of draft.images) if (image.assetId && !resources.has(image.assetId)) {
      resources.set(image.assetId, URL.createObjectURL(await (await fetch(source(image.assetId)!)).blob()));
    }
    compare(expected, await raster(await renderUiSketchPng(draft, id => resources.get(id))), "copied PNG");
  } finally { resources.forEach(url => URL.revokeObjectURL(url)); }
  canvas.dataset.previewComparison = JSON.stringify({ width, height, differentPixels: 0, copiedPng: true });
}

async function raster(blob: Blob): Promise<ImageData> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } finally { URL.revokeObjectURL(url); }
}

function compare(actual: ImageData, preview: ImageData, name: string): void {
  let differences = 0, maxDifference = 0;
  for (let index = 0; index < actual.data.length; index += 4) {
    const delta = Math.max(...[0, 1, 2, 3].map(channel => Math.abs(actual.data[index + channel] - preview.data[index + channel])));
    if (delta) differences += 1;
    maxDifference = Math.max(maxDifference, delta);
  }
  if (actual.width !== preview.width || actual.height !== preview.height || differences) {
    throw new Error(`${name}: ${differences} pixels differ from the actual canvas (maximum channel difference ${maxDifference})`);
  }
}
