import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { addArea, areaGeometry, COMPOSITION_CANVAS, createDraft, renderCompositionReferenceSvg } from "../../src/domain/composition/index.ts";
import { renderCompositionSketchSvg } from "../../design-system/surfaces/human2ai-web/src/local/compositionExport.ts";

function fixture(primitive: "triangle" | "quadrilateral" | "circle", rotation = 0) {
  const draft = addArea(createDraft(), { primitive, aspect: "free", x: 0.5, y: 0.5, area: 0.12, rotation }).draft;
  draft.previewMode = "precise";
  draft.frame = { width: 1200, height: 800, bounds: { x: 0, y: 0, width: 1, height: 1 } };
  draft.areas[0] = { ...draft.areas[0], width: 0.4, height: 0.3, rotation };
  return draft;
}

describe("composition preview shapes", () => {
  it.each([
    { primitive: "quadrilateral" as const, inside: [370, 290], outside: [330, 260] },
    { primitive: "triangle" as const, inside: [600, 255], outside: [370, 255] },
  ])("soft mode preserves a recognizable $primitive corner with radial shading", async ({ primitive, inside, outside }) => {
    const draft = { ...fixture(primitive), previewMode: "soft" as const };
    const svg = renderCompositionReferenceSvg(draft);
    expect(svg).toContain("<polygon");
    expect(svg).not.toContain("<ellipse");
    expect(svg).toContain("<radialGradient");
    expect(svg).toContain("<feGaussianBlur");
    expect(renderCompositionSketchSvg(draft)).toBe(svg);
    const { data, info } = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const red = ([x, y]: number[]) => data[(y * info.width + x) * 3];
    expect(red(inside)).toBeLessThan(253);
    expect(red(outside)).toBeGreaterThanOrEqual(252);
    expect(red([600, 400])).toBeLessThan(red(inside));
  });

  it("soft mode fades across the original boundary instead of leaving a distinct edge", async () => {
    const svg = renderCompositionReferenceSvg({ ...fixture("quadrilateral"), previewMode: "soft" });
    const { data, info } = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const values = Array.from({ length: 25 }, (_, index) => data[(400 * info.width + 300 + index * 5) * 3]);
    const changes = values.slice(1).map((value, index) => Math.abs(value - values[index]));
    expect(Math.max(...changes)).toBeLessThanOrEqual(5);
    expect(values[0]).toBeGreaterThan(250);
    expect(values.at(-1)).toBeLessThan(230);
  });

  it.each(["triangle", "quadrilateral"] as const)("preserves the %s vertices and rotation instead of its bounding ellipse", primitive => {
    const draft = fixture(primitive, 33);
    const geometry = areaGeometry(draft.areas[0], COMPOSITION_CANVAS);
    if (geometry.type !== "polygon") throw new Error("Expected polygon fixture");
    const svg = renderCompositionReferenceSvg(draft);
    expect(svg).toContain(`<polygon points="${geometry.points.map(point => `${Math.round(point.x * 1000) / 1000},${Math.round(point.y * 1000) / 1000}`).join(" ")}"`);
    expect(svg).not.toContain("<ellipse");
    expect(svg).not.toContain("composition-region-gradient");
    expect(renderCompositionSketchSvg(draft)).toBe(svg);
  });

  it.each([
    { primitive: "quadrilateral" as const, inside: [370, 290], outside: [350, 290] },
    { primitive: "triangle" as const, inside: [600, 255], outside: [370, 255] },
  ])("keeps a visible $primitive corner with no haze outside the shape", async ({ primitive, inside, outside }) => {
    const { data, info } = await sharp(Buffer.from(renderCompositionReferenceSvg(fixture(primitive)))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixel = ([x, y]: number[]) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
    expect(pixel(inside).every(channel => channel < 240)).toBe(true);
    expect(pixel(outside)).toEqual([255, 255, 255]);
  });

  it("preserves ellipse axes and rotation, and hides invisible shapes", () => {
    const draft = fixture("circle", 37);
    expect(renderCompositionReferenceSvg(draft)).toContain('rx="240" ry="120"');
    expect(renderCompositionReferenceSvg(draft)).toContain('transform="rotate(37 600 400)"');
    draft.areas[0].visible = false;
    expect(renderCompositionReferenceSvg(draft)).not.toContain("<ellipse");
  });
});
