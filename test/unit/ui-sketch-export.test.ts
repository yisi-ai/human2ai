import { promptTranslationKey } from "../../locales/promptKeys.ts";
import { describe, expect, it } from "vitest";

import {
  EMPTY_UI_SKETCH_DRAFT,
  UI_SKETCH_END_STAGE_ID,
  cloneUiSketchDraft,
  insertUiSketchStage,
  renameUiSketchState,
  reorderUiSketchStates,
  deleteUiSketchState,
  uiSketchDraftForStage,
  updateUiSketchStageDraft,
  renderUiSketchSvg as renderDomainUiSketchSvg,
} from "../../src/domain/ui-sketch/index.js";
import {
  buildAllUiSketchStagesPrompt,
  buildUiSketchPrompt,
  renderUiSketchSvg,
  type UiSketchPromptTranslator,
} from "../../design-system/surfaces/human2ai-web/src/local/uiSketchExport.ts";
import { UI_SKETCH_FIXTURE } from "../../design-system/surfaces/human2ai-web/src/local/uiSketchFixtures.ts";
import { createAppI18n, type AppLocale } from "../../web/i18n/createI18n.ts";

function promptTranslator(locale: AppLocale): UiSketchPromptTranslator {
  const i18n = createAppI18n(locale);
  return (key, values) => {
    const translationKey = promptTranslationKey("uiSketch", key);
    expect(i18n.exists(translationKey)).toBe(true);
    return i18n.t(translationKey, values);
  };
}

const translateChinesePrompt = promptTranslator("zh-CN");
const translateEnglishPrompt = promptTranslator("en");

describe("UI sketch stage export", () => {
  it("uses the same SVG renderer as CLI exports", () => {
    expect(renderUiSketchSvg).toBe(renderDomainUiSketchSvg);
  });

  it("exports every adjacent pair in display order with persisted names", () => {
    let draft = insertUiSketchStage(UI_SKETCH_FIXTURE, "start", "second");
    draft = insertUiSketchStage(draft, "second", "third");
    draft.stages.find((stage) => stage.id === "second")!.rectangles[0].x = 123;
    draft.stages.find((stage) => stage.id === "third")!.rectangles[0].x = 456;
    draft = renameUiSketchState(draft, "second", "激活");
    draft = renameUiSketchState(draft, "third", "展开");
    draft = reorderUiSketchStates(draft, ["third", "second", "start"]);
    const prompt = buildAllUiSketchStagesPrompt(draft, translateChinesePrompt);
    expect(prompt.indexOf("- 展开：")).toBeLessThan(prompt.indexOf("- 激活："));
    expect(prompt).toContain("- 状态 1：");
    draft = deleteUiSketchState(deleteUiSketchState(draft, "start"), "third");
    const single = buildAllUiSketchStagesPrompt(draft, translateChinesePrompt);
    expect(single).toContain("x=123px");
    expect(single).not.toContain("- 状态 1：");
  });

  it.each([
    { name: "left", x: 10, y: 220, included: false },
    { name: "right", x: 310, y: 220, included: false },
    { name: "above", x: 120, y: 160, included: false },
    { name: "below", x: 120, y: 330, included: false },
    { name: "touches left", x: 20, y: 220, included: false },
    { name: "touches right", x: 300, y: 220, included: false },
    { name: "touches top", x: 120, y: 170, included: false },
    { name: "touches bottom", x: 120, y: 320, included: false },
    { name: "partly left", x: 21, y: 220, included: true },
    { name: "partly right", x: 299, y: 220, included: true },
    { name: "partly above", x: 120, y: 171, included: true },
    { name: "partly below", x: 120, y: 319, included: true },
    { name: "inside", x: 120, y: 220, included: true },
  ])("filters all node kinds $name of a moved frame", ({ x, y, included }) => {
    const draft = cloneUiSketchDraft(EMPTY_UI_SKETCH_DRAFT);
    draft.frame = { x: 100, y: 200, width: 200, height: 120 };
    draft.overallNote = "Preserve the global direction";
    const bounds = { x, y, width: 80, height: 30 };
    draft.rectangles = [{ ...UI_SKETCH_FIXTURE.rectangles[0]!, ...bounds, note: "target region" }];
    draft.images = [{ ...draft.rectangles[0]!, id: "image-1", note: "target image", assetId: null, crop: null }];
    draft.texts = [{ ...UI_SKETCH_FIXTURE.texts[0]!, x, y, text: "target text" }];
    const original = structuredClone(draft);
    for (const build of [buildUiSketchPrompt, buildAllUiSketchStagesPrompt]) {
      const prompt = build(draft, translateEnglishPrompt, undefined, () => bounds);
      for (const value of ["target region", "target image", "target text"]) {
        expect(prompt.includes(value)).toBe(included);
      }
      expect(prompt.includes("Interface elements:")).toBe(included);
      expect(prompt).toContain(draft.overallNote);
    }
    expect(draft).toEqual(original);
  });

  it("keeps entering and exiting nodes in motion prompts, but omits nodes outside both states", () => {
    const draft = cloneUiSketchDraft(EMPTY_UI_SKETCH_DRAFT);
    const base = { ...UI_SKETCH_FIXTURE.rectangles[0]!, y: 40, width: 80, height: 30 };
    draft.rectangles = [{ ...base, x: -100, note: "entering region" }];
    draft.images = [{ ...base, id: "image-1", x: 40, note: "exiting image", assetId: null, crop: null }];
    draft.texts = [{ ...UI_SKETCH_FIXTURE.texts[0]!, x: 1200, y: 40, text: "outside text" }];
    const end = cloneUiSketchDraft(draft);
    end.rectangles[0]!.x = 40;
    end.images[0]!.x = 1200;
    end.texts[0]!.x = 1400;
    const staged = updateUiSketchStageDraft(draft, UI_SKETCH_END_STAGE_ID, end);
    const motion = buildAllUiSketchStagesPrompt(staged, translateEnglishPrompt);
    expect(motion).toContain("entering region");
    expect(motion).toContain("exiting image");
    expect(motion).not.toContain("outside text");
    expect(motion).toContain("x=-100px");
    expect(motion).toContain("x=1200px");
    const finalPrompt = buildUiSketchPrompt(uiSketchDraftForStage(staged, UI_SKETCH_END_STAGE_ID), translateEnglishPrompt);
    expect(finalPrompt).toContain("entering region");
    expect(finalPrompt).not.toContain("exiting image");
    end.rectangles[0]!.visible = false;
    const hiddenEnd = updateUiSketchStageDraft(draft, UI_SKETCH_END_STAGE_ID, end);
    expect(buildAllUiSketchStagesPrompt(hiddenEnd, translateEnglishPrompt)).not.toContain("entering region");
  });

  it("uses measured text bounds when deciding whether text overlaps the frame", () => {
    const draft = cloneUiSketchDraft(EMPTY_UI_SKETCH_DRAFT);
    draft.texts = [{ ...UI_SKETCH_FIXTURE.texts[0]!, x: -30, y: 40, fontSize: 16, text: "宽" }];
    const prompt = buildUiSketchPrompt(draft, translateEnglishPrompt, undefined,
      (text) => ({ x: text.x, y: text.y, width: 40, height: 20 }));
    expect(prompt).toContain('Display text: "宽"');
  });

  it.each([buildUiSketchPrompt, buildAllUiSketchStagesPrompt])("adds the style sentence once for static or staged output", (build) => {
    const plain = build(UI_SKETCH_FIXTURE, translateEnglishPrompt);
    const styled = build(UI_SKETCH_FIXTURE, translateEnglishPrompt, "Style: Generous whitespace, precise alignment and small geometric accents.");
    expect(styled.split("\n").filter((line) => line.startsWith("Style:"))).toHaveLength(1);
    expect(styled.replace("\n\nStyle: Generous whitespace, precise alignment and small geometric accents.", "")).toBe(plain);
  });

  it("explains that draft geometry is perceptible layout intent rather than a component tree", () => {
    const chinesePrompt = buildUiSketchPrompt(UI_SKETCH_FIXTURE, translateChinesePrompt);
    const englishPrompt = buildAllUiSketchStagesPrompt(
      UI_SKETCH_FIXTURE,
      translateEnglishPrompt,
    );

    expect(chinesePrompt).toContain("矩形表示可感知的内容范围或视觉表面，不是组件树节点");
    expect(chinesePrompt).toContain("不要把纯布局 wrapper、Stack、Grid");
    expect(englishPrompt).toContain("not a component-tree node");
    expect(englishPrompt).toContain("do not implement layout-only wrappers");
  });

  it("exports a selected stage as a static sketch without hidden nodes", () => {
    const stage = uiSketchDraftForStage(UI_SKETCH_FIXTURE, UI_SKETCH_END_STAGE_ID);
    stage.rectangles[1] = { ...stage.rectangles[1]!, visible: false };
    const updated = updateUiSketchStageDraft(
      UI_SKETCH_FIXTURE,
      UI_SKETCH_END_STAGE_ID,
      stage,
    );
    const selected = uiSketchDraftForStage(updated, UI_SKETCH_END_STAGE_ID);
    const prompt = buildUiSketchPrompt(selected, translateChinesePrompt);

    expect(prompt).not.toContain("当前任务摘要和运行状态");
    expect(prompt).not.toContain("批注：");
    expect(prompt).not.toContain("类型：");
    expect(renderUiSketchSvg(selected)).not.toContain("当前任务摘要和运行状态");
  });

  it("groups motion changes under their numbered elements", () => {
    const stage = uiSketchDraftForStage(UI_SKETCH_FIXTURE, UI_SKETCH_END_STAGE_ID);
    stage.rectangles[0] = { ...stage.rectangles[0]!, x: 140 };
    stage.rectangles[1] = { ...stage.rectangles[1]!, visible: false };
    stage.texts[0] = { ...stage.texts[0]!, fontSize: 36 };
    const updated = updateUiSketchStageDraft(
      UI_SKETCH_FIXTURE,
      UI_SKETCH_END_STAGE_ID,
      stage,
    );
    const prompt = buildAllUiSketchStagesPrompt(updated, translateChinesePrompt);
    const firstRegion = elementBlock(prompt, "区域#1", "区域#2");
    const secondRegion = elementBlock(prompt, "区域#2", "区域#3");
    const thirdRegion = elementBlock(prompt, "区域#3", "文字#1");
    const firstText = elementBlock(prompt, "文字#1", "文字#2");

    expect(firstRegion).toContain("- 状态 1：");
    expect(firstRegion).toContain("- 状态 2：");
    expect(firstRegion).toContain("参考位置：x=140px，y=52px");
    expect(secondRegion).toContain("改为隐藏");
    expect(thirdRegion).not.toContain("状态 2：");
    expect(firstText).toContain("参考字号：36px");
    expect(prompt).not.toContain("## 结束");
    expect(prompt).not.toContain("共享区域");
  });

  it("omits empty sections, empty notes, and internal metadata", () => {
    const emptyPrompt = buildUiSketchPrompt(EMPTY_UI_SKETCH_DRAFT, translateChinesePrompt);
    expect(emptyPrompt).not.toContain("尚未");
    expect(emptyPrompt).not.toContain("整体要求：");
    expect(emptyPrompt).not.toContain("界面元素：");
    expect(emptyPrompt).not.toContain("区域#");
    expect(emptyPrompt).not.toContain("文字#");
    const emptyMotionPrompt = buildAllUiSketchStagesPrompt(
      EMPTY_UI_SKETCH_DRAFT,
      translateChinesePrompt,
    );
    expect(emptyMotionPrompt).not.toContain("界面元素：");
    expect(emptyMotionPrompt).not.toContain("每个元素");

    const draft = cloneUiSketchDraft(UI_SKETCH_FIXTURE);
    draft.rectangles[0] = { ...draft.rectangles[0]!, note: "" };
    const prompt = buildUiSketchPrompt(draft, translateChinesePrompt);
    const firstRegion = elementBlock(prompt, "区域#1", "区域#2");
    expect(firstRegion).not.toContain("备注：");
    expect(firstRegion).toContain("参考位置：");
    expect(prompt).not.toContain("批注：");
    expect(prompt).not.toContain("类型：");
  });

  it("exports static, motion, and empty prompts in English", () => {
    const staticPrompt = buildUiSketchPrompt(UI_SKETCH_FIXTURE, translateEnglishPrompt);
    expect(staticPrompt).toContain("Suggested canvas size: 960 × 560px");
    expect(staticPrompt).toContain("Overall direction:");
    expect(staticPrompt).toContain("Region #1");
    expect(staticPrompt).toContain("Reference position: x=304px, y=132px");
    expect(staticPrompt).toContain('Display text: "运行概览"');
    expect(staticPrompt).not.toContain("区域#");

    const stage = uiSketchDraftForStage(UI_SKETCH_FIXTURE, UI_SKETCH_END_STAGE_ID);
    stage.rectangles[0] = { ...stage.rectangles[0]!, x: 140 };
    stage.rectangles[1] = { ...stage.rectangles[1]!, visible: false };
    const updated = updateUiSketchStageDraft(
      UI_SKETCH_FIXTURE,
      UI_SKETCH_END_STAGE_ID,
      stage,
    );
    const motionPrompt = buildAllUiSketchStagesPrompt(updated, translateEnglishPrompt);
    const firstRegion = elementBlock(motionPrompt, "Region #1", "Region #2");
    const secondRegion = elementBlock(motionPrompt, "Region #2", "Region #3");
    expect(firstRegion).toContain("- State 1:");
    expect(firstRegion).toContain("- State 2:");
    expect(secondRegion).toContain("Change to hidden");

    const emptyPrompt = buildUiSketchPrompt(
      EMPTY_UI_SKETCH_DRAFT,
      translateEnglishPrompt,
    );
    expect(emptyPrompt).not.toContain("Overall direction:");
    expect(emptyPrompt).not.toContain("Interface elements:");
    expect(emptyPrompt).not.toContain("Region #");
    expect(emptyPrompt).not.toContain("Text #");
  });

  it("exports image node semantics and pixels without source metadata in prompts", () => {
    const draft = cloneUiSketchDraft(EMPTY_UI_SKETCH_DRAFT);
    draft.images.push({
      id: "image-1",
      x: 40,
      y: 60,
      width: 320,
      height: 180,
      note: "商品主图",
      annotation: "内部图片批注",
      semanticType: "商品媒体",
      origin: "import",
      visible: true,
      weight: "high",
      assetId: "private-asset-id",
      crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    });

    const prompt = buildUiSketchPrompt(draft, translateChinesePrompt);
    expect(prompt).toContain("图片#1");
    expect(prompt).toContain("商品主图");
    expect(prompt).toContain("参考位置：x=40px，y=60px");
    expect(prompt).toContain("参考尺寸：宽=320px，高=180px");
    expect(prompt).not.toContain("private-asset-id");
    expect(prompt).not.toContain("内部图片批注");
    expect(prompt).not.toContain("import");
    expect(prompt).not.toContain("0.8");

    const svg = renderUiSketchSvg(draft, () => "https://example.test/product.webp");
    expect(svg).toContain('data-element-kind="image"');
    expect(svg).toContain("https://example.test/product.webp");
    expect(svg).toContain("clip-path");
  });
});

function elementBlock(prompt: string, label: string, nextLabel: string): string {
  return prompt.split(`${label}\n`)[1]?.split(`\n\n${nextLabel}\n`)[0] ?? "";
}
