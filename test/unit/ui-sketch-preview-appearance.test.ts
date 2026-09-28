import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createUiSketchDraft, validateUiSketchDraft } from "../../src/domain/ui-sketch/index.ts";
import { renderUiSketchSvg } from "../../src/domain/ui-sketch/render.ts";
import { canvasNodeTone } from "../../design-system/surfaces/human2ai-web/src/local/canvasNodeTone.ts";
import { tokens } from "../../design-system/surfaces/human2ai-web/src/vendor/yisiui/runtime/src/tokens/tokens.ts";

async function raster(svg: string) {
  const { data, info } = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { info, pixel: (x: number, y: number) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)] };
}

describe("UI preview appearance", () => {
  it("keeps square corners, the six canvas colors and their opacity without a default outline", async () => {
    const names = ["sage", "amber", "sky", "rose", "lavender", "clay"] as const;
    const draft = validateUiSketchDraft({ ...createUiSketchDraft(), frame: { x: 100, y: 200, width: 180, height: 40 },
      rectangles: Array.from({ length: 6 }, (_, index) => ({ id: String(index), x: 105 + index * 28, y: 205, width: 20, height: 25 })),
    });
    const { pixel } = await raster(renderUiSketchSvg(draft));
    for (const [index, rectangle] of draft.rectangles.entries()) {
      const hex = tokens[`color.paper.${names[canvasNodeTone(rectangle.id)]}`];
      const expected = [1, 3, 5].map(offset => Math.round(parseInt(hex.slice(offset, offset + 2), 16) * 0.82 + 255 * 0.18));
      for (const [x, y] of [[5 + index * 28, 5], [15 + index * 28, 15]]) {
        pixel(x, y).forEach((channel, c) => expect(Math.abs(channel - expected[c])).toBeLessThanOrEqual(1));
      }
      expect(pixel(4 + index * 28, 5)).toEqual([255, 255, 255]);
    }
  });

  it.each([16, 28, 40])("places %ipx multiline text below its saved top with a preserved blank line", async fontSize => {
    const draft = validateUiSketchDraft({ ...createUiSketchDraft(), frame: { x: 100, y: 200, width: 160, height: 240 },
      texts: [{ id: "text", x: 120, y: 240, fontSize, text: "H\n\nH" }],
    });
    const { pixel, info } = await raster(renderUiSketchSvg(draft));
    const rows = Array.from({ length: info.height }, (_, y) => y).filter(y =>
      Array.from({ length: 100 }, (_, x) => x).some(x => pixel(x, y).every(c => c < 150)));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toBeGreaterThanOrEqual(40);
    expect(rows[0]).toBeLessThan(40 + fontSize * 0.5);
    const starts = rows.filter((y, index) => index === 0 || y > rows[index - 1] + 1);
    expect(starts).toHaveLength(2);
    expect(Math.abs(starts[1] - starts[0] - 2.8 * fontSize)).toBeLessThanOrEqual(1);
  });

  it("adds a clipped inner outline only to enclosed same-color rectangles and respects layer order", async () => {
    const draft = validateUiSketchDraft({ ...createUiSketchDraft(), frame: { x: 0, y: 0, width: 80, height: 80 },
      rectangles: [{ id: "b", x: 5, y: 5, width: 60, height: 60 }, { id: "h", x: 20, y: 20, width: 30, height: 30 }],
      layerOrder: ["b", "h"],
    });
    const { pixel } = await raster(renderUiSketchSvg(draft));
    const border = pixel(20, 25), inside = pixel(25, 25), outside = pixel(19, 25);
    expect(border.every((channel, c) => channel < inside[c])).toBe(true);
    expect(outside).toEqual(pixel(10, 25));
    expect(pixel(5, 10)).toEqual(outside);
    const hidden = await raster(renderUiSketchSvg({ ...draft, rectangles: [draft.rectangles[0], { ...draft.rectangles[1], visible: false }] }));
    expect(hidden.pixel(20, 25)).toEqual(outside);
    const reversed = await raster(renderUiSketchSvg({ ...draft, layerOrder: ["h", "b"] }));
    expect(reversed.pixel(20, 25).every((channel, c) => channel > border[c])).toBe(true);
  });
});
