import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { compositionSvgForRaster } from "../../src/domain/composition/raster.ts";
import {
  addTextRegion, createDraft, renderCompositionDisplayTextSvg, renderCompositionReferenceSvg,
  renderCompositionSvg, resizeFreeArea, updateAreaMetadata,
} from "../../src/domain/composition/index.ts";

function fixture(text: string) {
  const { draft, id } = addTextRegion(createDraft());
  draft.previewMode = "precise";
  return updateAreaMetadata(resizeFreeArea(draft, id, 0.4, 0.3), id, { displayText: text });
}

describe("composition display text", () => {
  it("keeps the end of long text visible in the PNG renderer", async () => {
    const png = async (text: string) => sharp(Buffer.from(await compositionSvgForRaster(renderCompositionReferenceSvg(fixture(text))))).png().toBuffer();
    expect(await png("Canvas text 123456789 A")).not.toEqual(await png("Canvas text 123456789 B"));
    expect(await png("静观自得")).not.toEqual(await png("静观自失"));
  });
  it("draws supplied text in precise references and uses placeholders in soft references", () => {
    const draft = fixture("静观自得");
    const text = renderCompositionDisplayTextSvg(draft.areas[0]);
    expect(text).toContain("静观自得</text>");
    expect(text).toContain('width="480" height="240"');
    expect(text).toContain('preserveAspectRatio="none"');
    expect(text).toContain('lengthAdjust="spacingAndGlyphs"');
    const precise = renderCompositionReferenceSvg({ ...draft, previewMode: "precise" });
    expect(precise).toContain(text);
    expect(precise).not.toContain('data-reference-role="typography"');
    const soft = renderCompositionReferenceSvg({ ...draft, previewMode: "soft" });
    expect(soft).toBe(renderCompositionReferenceSvg({ ...fixture(""), previewMode: "soft" }));
    expect(soft).toContain('data-reference-role="typography"');
    expect(soft).not.toContain('data-reference-role="display-text"');
    expect(renderCompositionSvg(draft)).toContain(text);
  });

  it("preserves line breaks and escapes display text as plain text", () => {
    const svg = renderCompositionDisplayTextSvg(fixture('Hello & <world>\r\n\n再见').areas[0]);
    expect(svg).toContain("Hello &amp; &lt;world&gt;</text>");
    expect(svg).toContain('viewBox="0 0 1000 3600"');
    expect(svg.match(/<text /g)).toHaveLength(2);
    expect(svg).toContain('y="3350"');
    expect(svg).not.toContain("<world>");
  });

  it("keeps empty placeholders and warps filled text into rotated custom outlines", () => {
    const empty = fixture(" \n ");
    expect(renderCompositionDisplayTextSvg(empty.areas[0])).toBe("");
    expect(renderCompositionReferenceSvg(empty)).toContain('data-reference-role="typography"');
    const draft = fixture("轮廓");
    const area = { ...draft.areas[0], rotation: 32, corners: [
      { x: 0.2, y: 0 }, { x: 1, y: 0 }, { x: 0.8, y: 1 }, { x: 0, y: 1 },
    ] as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] };
    const svg = renderCompositionDisplayTextSvg(area);
    expect(svg).toContain('transform="rotate(32 600 400)"');
    expect(svg).toContain('points="456,280 840,280 744,520 360,520"');
    expect(svg).toContain('clip-path="url(#composition-text-area-1)"');
    expect(svg).toContain('href="#composition-text-area-1-content"');
    expect(svg).toContain('transform="matrix(0.8 0 -0.4 1 456 280)"');
    expect(svg.match(/data-text-warp-patch/g)).toHaveLength(1);
  });

  it("renders a perspective mesh without interior seams in PNG", async () => {
    const area = fixture("ink").areas[0];
    area.corners = [{ x: 0.3, y: 0 }, { x: 0.9, y: 0.1 }, { x: 1, y: 1 }, { x: 0, y: 0.85 }];
    const wrapper = (content: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="480" viewBox="360 280 480 240">${content}</svg>`;
    const solid = renderCompositionDisplayTextSvg(area).replace(/<text [^>]*>[^<]*<\/text>/, '<rect width="1000" height="1200"/>');
    const actual = await sharp(Buffer.from(wrapper(solid))).ensureAlpha().raw().toBuffer();
    const expected = await sharp(Buffer.from(wrapper('<polygon points="504,280 792,304 840,520 360,484"/>'))).ensureAlpha().raw().toBuffer();
    let gaps = 0;
    for (let i = 3; i < expected.length; i += 4) {
      if (expected[i] === 255 && actual[i] < 254) gaps++;
    }
    expect(gaps).toBe(0);
  });
});
