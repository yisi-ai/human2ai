import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  addArea, addTextRegion, auditRefinement, copyCompositionItems, createDraft,
  draftFingerprint, inspectComposition, moveItem, pasteCompositionItems,
  renderCompositionLightSourceSvg, renderCompositionReferenceSvg, renderCompositionSvg, rotateArea, updateAreaMetadata, updateItemMetadata, validateDraft,
} from "../../src/domain/composition/index.ts";
import { buildCompositionPrompt, renderCompositionSketchSvg } from "../../design-system/surfaces/human2ai-web/src/local/compositionExport.ts";
import { createAppI18n } from "../../web/i18n/createI18n.ts";
import { promptTranslationKey } from "../../locales/promptKeys.ts";

function fixture(primitive: "circle" | "triangle" | "quadrilateral" = "quadrilateral") {
  return rotateArea(addArea(createDraft(), {
    primitive, aspect: "free", x: 0.5, y: 0.45, area: 0.12, rotation: 327,
  }).draft, "area-1", 327);
}

describe("composition light sources", () => {
  it("defaults off without changing old fingerprints, and toggles only the light property", () => {
    const original = fixture();
    const off = updateAreaMetadata(original, "area-1", { isLightSource: false });
    const on = updateAreaMetadata(original, "area-1", { isLightSource: true });
    expect(inspectComposition(original).areas[0].isLightSource).toBe(false);
    expect(draftFingerprint(off)).toBe(draftFingerprint(original));
    expect(draftFingerprint(on)).not.toBe(draftFingerprint(original));
    expect(on.areas[0]).toEqual({ ...original.areas[0], isLightSource: true });
    expect(original.areas[0]).not.toHaveProperty("isLightSource");
    expect(inspectComposition(on).areas[0].isLightSource).toBe(true);
    expect(validateDraft(JSON.parse(JSON.stringify(on)))).toEqual(on);
    expect(renderCompositionReferenceSvg(off)).toBe(renderCompositionReferenceSvg(original));
  });

  it("rejects non-boolean flags and light source text regions", () => {
    const draft = fixture();
    expect(() => validateDraft({ ...draft, areas: [{ ...draft.areas[0], isLightSource: "yes" }] })).toThrow();
    const text = addTextRegion(createDraft());
    expect(() => updateAreaMetadata(text.draft, text.id, { isLightSource: true })).toThrow();
  });

  it("retains lighting through copying and geometric refinement, and rejects reinterpretation", () => {
    const draft = updateAreaMetadata(fixture(), "area-1", { isLightSource: true });
    const copied = pasteCompositionItems(draft, copyCompositionItems(draft, ["area-1"]), { x: 0.02, y: 0.03 });
    expect(copied.draft.areas[1].isLightSource).toBe(true);
    const moved = moveItem(draft, "area-1", { x: 0.52, y: 0.45 });
    expect(auditRefinement(draft, moved).passed).toBe(true);
    const off = updateAreaMetadata(moved, "area-1", { isLightSource: false });
    expect(auditRefinement(draft, off).failedChecks).toContain("preserved.areaMetadata");
    expect(auditRefinement(off, moved).failedChecks).toContain("preserved.areaMetadata");
  });

  it.each(["circle", "triangle", "quadrilateral"] as const)("retains editable %s geometry but exports a borderless lighting cue", (primitive) => {
    const draft = updateAreaMetadata(fixture(primitive), "area-1", { isLightSource: true });
    const editor = renderCompositionSvg(draft);
    const reference = renderCompositionReferenceSvg(draft);
    for (const svg of [editor, reference]) {
      expect(svg).toContain('data-region-kind="light-source"');
      expect(svg).toContain('transform="rotate(327 600 360)"');
      expect(svg).toContain('stop-color="#fff8c4"');
      expect(svg).not.toContain('data-reference-role="influence-zone"');
    }
    expect(editor).toContain(primitive === "circle" ? "<ellipse" : "<polygon");
    expect(editor).toContain('stroke="#d6b95c"');
    expect(reference).toContain(primitive === "circle" ? '<ellipse' : '<polygon');
    expect(reference).toContain('<feGaussianBlur');
    expect(reference).not.toContain('stroke="#d6b95c"');
    expect(reference).toContain('offset="1" stop-color="#ffe58a" stop-opacity="0"');
    expect(renderCompositionSketchSvg(draft)).toBe(renderCompositionReferenceSvg(draft));
  });

  it("renders rectangular lights as bands with consistent intensity along the long axis", async () => {
    const area = { ...fixture().areas[0], x: 0.5, y: 0.5, width: 0.6, height: 0.1, area: 0.06, rotation: 0 };
    const markup = renderCompositionLightSourceSvg(area, "band", "reference");
    const { data, info } = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">${markup}</svg>`))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
    expect(Math.abs(alpha(350, 400) - alpha(600, 400))).toBeLessThan(3);
    expect(alpha(600, 400)).toBeGreaterThan(180);
    expect(alpha(600, 360)).toBeLessThan(35);
    expect(markup).toContain('<linearGradient');
    expect(markup).not.toContain('<radialGradient');
  });

  it("keeps multiple light sources and their SVG paint definitions independent", () => {
    let draft = updateAreaMetadata(fixture(), "area-1", { isLightSource: true });
    const added = addArea(draft, { primitive: "circle", x: 0.3, y: 0.2, area: 0.03 });
    draft = updateAreaMetadata(added.draft, added.id, { isLightSource: true });
    expect(inspectComposition(draft).areas.filter((area) => area.isLightSource).map((area) => area.id)).toEqual(["area-1", "area-2"]);
    const svg = renderCompositionReferenceSvg(draft);
    for (const id of ["area-1", "area-2"]) {
      expect(svg).toContain(`data-light-source-id="${id}"`);
      expect(svg).toContain(`fill="url(#composition-light-${id})"`);
      expect(svg).toContain(`filter="url(#composition-light-${id}-soften)"`);
    }
    const i18n = createAppI18n("zh-CN");
    const prompt = buildCompositionPrompt(draft, (key, values) => i18n.t(promptTranslationKey("composition", key), values));
    expect(prompt).toContain("光源 1");
    expect(prompt).toContain("光源 2");
    expect(prompt).toContain("逐个理解多个光源");
    expect(prompt).toContain("成片效果允许拆分、叠加和融合");
  });

  it.each(["zh-CN", "en"] as const)("exports the lighting interpretation and color convention in %s", (locale) => {
    const i18n = createAppI18n(locale);
    const translate = (key: string, values?: Record<string, string | number>) => i18n.t(promptTranslationKey("composition", key), values);
    const on = updateAreaMetadata(fixture(), "area-1", { isLightSource: true });
    const prompt = buildCompositionPrompt(on, translate);
    expect(prompt).toContain(translate("lightSourceGuidance"));
    expect(prompt).toContain(translate("lightSourceNumber", { index: 1 }));
    expect(prompt).not.toContain(translate("areaNumber", { index: 1 }));
    expect(prompt).not.toContain(translate("referenceRotation", { rotation: 327 }));
    expect(prompt).not.toContain(translate("referenceArea", { area: Math.round(inspectComposition(on).areas[0].visibleAreaShare * 100) }));
    expect(prompt).toContain(locale === "zh-CN" ? "光源与受光区域并不相同" : "A source is distinct from the area it illuminates");
    expect(prompt).toContain(locale === "zh-CN" ? "只有用户明确要求" : "only when the user explicitly requests");
    expect(buildCompositionPrompt(fixture(), translate)).not.toContain(translate("lightSourceGuidance"));
  });

  it.each(["zh-CN", "en"] as const)("exports flexible band intent while retaining explicit user instructions in %s", (locale) => {
    const i18n = createAppI18n(locale);
    const translate = (key: string, values?: Record<string, string | number>) => i18n.t(promptTranslationKey("composition", key), values);
    const note = "弱一些，边缘柔和，但保持可辨认的斜向光带";
    let draft = updateItemMetadata(updateAreaMetadata(fixture(), "area-1", { isLightSource: true }), "area-1", { note });
    const second = addArea(draft, { primitive: "quadrilateral", x: 0.2, y: 0.2, area: 0.02 });
    draft = updateAreaMetadata(second.draft, second.id, { isLightSource: true });
    const prompt = buildCompositionPrompt(draft, translate);
    const requirement = translate("lightBandGuidance");
    expect(prompt.split(requirement)).toHaveLength(3);
    expect(prompt).toContain(note);
    expect(requirement).toContain(locale === "zh-CN" ? "变窄、变宽、弯曲、断续或融合" : "narrow, widen, curve, break up or blend");
    expect(requirement).toContain(locale === "zh-CN" ? "未指定时由 Agent 自由安排" : "otherwise the Agent interprets them freely");
    expect(requirement).toContain(locale === "zh-CN" ? "整体大致呼应即可" : "An approximate overall correspondence is sufficient");
    expect(requirement).not.toContain(locale === "zh-CN" ? "必须在成片中体现可辨认的带状照明" : "must produce recognizable band-shaped illumination");
    expect(prompt).not.toContain(locale === "zh-CN" ? "不要为匹配标记而画出矩形亮带" : "Do not add rectangular bright bands");
    expect(buildCompositionPrompt(fixture(), translate)).not.toContain(requirement);
    const roundLight = updateAreaMetadata(fixture("circle"), "area-1", { isLightSource: true });
    expect(buildCompositionPrompt(roundLight, translate)).not.toContain(requirement);
  });
});
