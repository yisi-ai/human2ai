import { describe, expect, it } from "vitest";
import { createAppI18n } from "../../web/i18n/createI18n.ts";
import { promptTranslationKey } from "../../locales/promptKeys.ts";

const migratedKeys = [
  "composition.prompt.title",
  "composition.prompt.layoutHeading",
  "composition.prompt.flexibleImplementation",
  "composition.prompt.referenceImageGuidance",
  "composition.prompt.referenceValues",
  "composition.prompt.regionSemanticsGuidance",
  "composition.prompt.displayTextGuidance",
  "composition.prompt.generatedDisplayText",
  "composition.prompt.referencePosition",
  "composition.prompt.coordinateOrigin",
  "composition.prompt.outputRatio",
  "composition.prompt.referenceArea",
  "composition.prompt.referenceRotation",
  "composition.prompt.referenceClipping",
  "composition.prompt.top",
  "composition.prompt.bottom",
  "composition.prompt.left",
  "composition.prompt.right",
  "composition.prompt.sideSeparator",
  "composition.views.draftCanvas",
  "composition.views.refined",
  "composition.views.refinedCanvas",
  "composition.views.reference",
  "composition.views.referenceCanvas",
  "composition.views.switch",
  "composition.workspace",
  "composition.currentSelection",
  "composition.none",
  "composition.workflow.agentDecision",
  "composition.workflow.appliedMethods",
  "composition.workflow.protectionAudit",
  "composition.workflow.maximumFocusShift",
  "composition.workflow.maximumAreaShift",
  "composition.workflow.maximumRotationShift",
  "uiSketch.prompt.staticTitle",
  "uiSketch.prompt.layoutHeading",
  "uiSketch.prompt.referenceValues",
  "uiSketch.prompt.flexibleImplementation",
  "uiSketch.prompt.canvasSize",
  "uiSketch.prompt.canvasOrigin",
  "uiSketch.prompt.referencePosition",
  "uiSketch.prompt.referenceSize",
  "uiSketch.prompt.elementsHeading",
  "uiSketch.canvasLabels.region",
  "uiSketch.canvasLabels.addRegion",
  "uiSketch.canvasLabels.editRegionNote",
  "uiSketch.prompt.regionNumber",
  "uiSketch.canvasLabels.text",
  "uiSketch.canvasLabels.addText",
  "uiSketch.canvasLabels.editText",
  "uiSketch.prompt.textNumber",
  "uiSketch.canvasLabels.newText",
  "uiSketch.canvasLabels.emptyText",
  "uiSketch.canvasLabels.missingRegionNote",
  "uiSketch.canvasLabels.frameRange",
  "uiSketch.canvasLabels.rangeTitle",
  "uiSketch.canvasLabels.frameAction",
  "uiSketch.canvasLabels.resetFrame"
] as const;

describe("layout and refinement semantic migration", () => {
  it.each(migratedKeys)("resolves %s in both supported locales", (key) => {
    for (const locale of ["zh-CN", "en"] as const) {
      const i18n = createAppI18n(locale);
      expect(i18n.exists(key)).toBe(true);
      const copy = i18n.t(key, {
        x: 12, y: 34, width: 800, height: 600, index: 2,
        area: 25, rotation: 15, ratio: "4:3", sides: "top",
      });
      expect(copy.trim()).not.toBe("");
      expect(copy).not.toBe(key);
      expect(copy).not.toMatch(/\{\{[^}]+\}\}/);
    }
  });

  it("keeps percentage composition positions distinct from pixel interface positions", () => {
    for (const locale of ["zh-CN", "en"] as const) {
      const i18n = createAppI18n(locale);
      const composition = i18n.t(promptTranslationKey("composition", "referencePosition"), { x: 12, y: 34 });
      const ui = i18n.t(promptTranslationKey("uiSketch", "referencePosition"), { x: 12, y: 34 });
      expect(composition).toContain("12%");
      expect(composition).toContain("34%");
      expect(ui).toContain("x=12px");
      expect(ui).toContain("y=34px");
      expect(composition).not.toBe(ui);
    }
  });

  it("preserves blank-content and geometry guidance rather than turning it into stored copy", () => {
    const zh = createAppI18n("zh-CN");
    const en = createAppI18n("en");
    expect(zh.t("uiSketch.canvasLabels.newText")).toBe("文字");
    expect(en.t("uiSketch.canvasLabels.newText")).toBe("Text");
    expect(en.t("uiSketch.canvasLabels.emptyText")).toBe("---No text entered---");
    expect(en.t("uiSketch.canvasLabels.missingRegionNote")).toBe("No note");
    expect(zh.t("composition.prompt.generatedDisplayText")).toContain("由模型创作");
    expect(en.t("composition.prompt.generatedDisplayText")).toContain("do not leave this region blank");
    expect(zh.t("composition.prompt.displayTextGuidance")).toContain("必须原样出现");
    expect(en.t("uiSketch.prompt.flexibleImplementation")).toContain("responsive layout");
    expect(en.t("composition.prompt.regionSemanticsGuidance")).toContain("not a fixed final silhouette");
  });
});
