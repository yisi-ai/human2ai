import sharp from "sharp";

/** librsvg ignores SVG textLength. Supply equivalent horizontal transforms for PNG exports. */
export async function compositionSvgForRaster(svg: string): Promise<string> {
  const runs = [...svg.matchAll(/<text x="0" y="(\d+)" textLength="1000" lengthAdjust="spacingAndGlyphs">([^<]*)<\/text>/g)];
  const replacements = new Map<string, string>();
  for (const [markup, baseline, text] of runs) {
    if (replacements.has(markup)) continue;
    // An underline includes the whitespace advances in Pango's measured width.
    // Measure at 100px rather than allocating a 1000px-high image for long lines.
    const { width } = await sharp({ text: {
      text: `<span underline="single">${text}</span>`,
      font: "Arial,Noto Sans CJK SC,Microsoft YaHei 100", dpi: 72,
    } }).metadata();
    replacements.set(markup, `<text x="0" y="${baseline}" transform="scale(${100 / width!} 1)">${text}</text>`);
  }
  return svg.replace(/<text x="0" y="\d+" textLength="1000" lengthAdjust="spacingAndGlyphs">[^<]*<\/text>/g,
    markup => replacements.get(markup)!);
}
