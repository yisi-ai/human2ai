import { renderCompositionReferenceSvg, type CompositionDraft } from "../../../../../src/domain/composition";

export function assertReferenceShapes(root: HTMLElement, draft: CompositionDraft): void {
  const source = new DOMParser().parseFromString(renderCompositionReferenceSvg(draft), "image/svg+xml").documentElement;
  const preview = document.importNode(source, true) as unknown as SVGSVGElement;
  preview.style.cssText = "position:fixed;left:-10000px;top:0;pointer-events:none";
  document.body.append(preview);
  try {
    const scene = root.querySelector<SVGSVGElement>("[data-composition-scene]")!;
    const shapes = [...preview.querySelectorAll<SVGGeometryElement>('[data-region-kind="content-region"] [data-reference-role="influence-zone"]')];
    const areas = draft.areas.filter(area => area.visible !== false && !area.isLightSource && area.semanticType !== "text-region");
    if (shapes.length !== areas.length) throw new Error("Preview must preserve visible composition regions");
    let maximumPositionError = 0;
    areas.forEach((area, index) => {
      const actual = root.querySelector<SVGGeometryElement>(`[data-composition-item="${area.id}"] :is(.human2ai-composition-canvas__shape, [data-reference-role="influence-zone"])`)!;
      const exported = shapes[index];
      const actualTransform = scene.getCTM()!.inverse().multiply(actual.getCTM()!);
      const exportTransform = preview.getCTM()!.inverse().multiply(exported.getCTM()!);
      for (let sample = 0; sample < 64; sample += 1) {
        const a = actual.getPointAtLength(actual.getTotalLength() * sample / 64).matrixTransform(actualTransform);
        const b = exported.getPointAtLength(exported.getTotalLength() * sample / 64).matrixTransform(exportTransform);
        maximumPositionError = Math.max(maximumPositionError, Math.hypot(a.x - b.x, a.y - b.y));
        if (maximumPositionError > 0.01) throw new Error(`Preview changed ${area.primitive} geometry or rotation`);
      }
      for (const property of ["fill", "fill-opacity", "stroke", "stroke-width", "vector-effect", "filter"]) {
        if (paintValue(actual, property) !== paintValue(exported, property)) {
          throw new Error(`Preview changed ${area.primitive} ${property}`);
        }
      }
    });
    root.dataset.referenceShapes = JSON.stringify({ shapes: shapes.length, samplesPerShape: 64, maximumPositionError, stylesMatch: true });
  } finally { preview.remove(); }
}

function paintValue(shape: SVGGeometryElement, property: string): string {
  const value = getComputedStyle(shape).getPropertyValue(property);
  const reference = value.match(/url\(["']?#([^"')]+)["']?\)/);
  if (!reference) return value;
  const paint = document.getElementById(reference[1]);
  if (!paint) throw new Error("Missing preview paint definition");
  return paint.outerHTML.replace(/ id="[^"]*"/, "");
}
