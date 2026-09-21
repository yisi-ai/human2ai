import { promptTranslationKey } from "../../locales/promptKeys.ts";
import { describe, expect, it } from "vitest";

import {
  buildCompositionPrompt,
  renderCompositionSketchSvg,
  type CompositionPromptTranslator,
} from "../../design-system/surfaces/human2ai-web/src/local/compositionExport.ts";
import {
  addArea,
  addCompositionPlan,
  replaceCompositionPlan,
  addCompositionImage,
  addDirectionLine,
  addFocus,
  addTextRegion,
  createDraft,
  changeFrame,
  createCompositionState,
  selectCompositionState,
  frameBoundsInCanvas,
  framePointToCanvas,
  rotateDirectionLine,
  setProcessingSemantic,
  updateAreaMetadata,
  updateCompositionImage,
  updateItemMetadata,
  type CompositionDraft,
} from "../../src/domain/composition/index.js";
import { createAppI18n, type AppLocale } from "../../web/i18n/createI18n.ts";

function promptTranslator(locale: AppLocale): CompositionPromptTranslator {
  const i18n = createAppI18n(locale);
  return (key, values) => {
    const translationKey = promptTranslationKey("composition", key);
    expect(i18n.exists(translationKey)).toBe(true);
    return i18n.t(translationKey, values);
  };
}

function exampleDraft(): CompositionDraft {
  let draft = setProcessingSemantic(createDraft(), "editorial-layout");
  draft.overallNote = "突出左侧主体，右侧保留呼吸感";
  const focusPosition = framePointToCanvas({ x: 0.25, y: 0.35 }, draft.frame);
  const focus = addFocus(draft, focusPosition);
  draft = updateItemMetadata(focus.draft, focus.id, {
    note: "人物面部",
    annotation: "内部批注不应导出",
    semanticType: "主要焦点",
    shotScale: "foreground",
  });
  const areaPosition = framePointToCanvas({ x: 0.3, y: 0.55 }, draft.frame);
  const area = addArea(draft, {
    primitive: "quadrilateral",
    aspect: "free",
    x: areaPosition.x,
    y: areaPosition.y,
    area: 0.12,
    rotation: 8,
  });
  draft = updateItemMetadata(area.draft, area.id, {
    note: "站立的人物主体",
    semanticType: "主体",
    shotScale: "background",
  });
  draft = updateAreaMetadata(draft, area.id, { visualWeight: "high" });
  const textRegion = addTextRegion(draft, {
    ...framePointToCanvas({ x: 0.72, y: 0.3 }, draft.frame),
    area: 0.06,
  });
  draft = updateAreaMetadata(textRegion.draft, textRegion.id, {
    displayText: "静观自得",
    visualWeight: "medium",
  });
  const direction = addDirectionLine(draft);
  draft = rotateDirectionLine(direction.draft, direction.id, 325);
  return updateItemMetadata(draft, direction.id, { note: "视线朝右下" });
}

describe("composition draft export", () => {
  it("exports all planning intent in both locales independently of visibility, without drawing guides into references", () => {
    const original = exampleDraft();
    let draft = original;
    for (const type of ["golden-section", "symmetry", "golden-spiral", "triangle"] as const) {
      draft = addCompositionPlan(draft, type).draft;
    }
    draft = replaceCompositionPlan(draft, { ...draft.plans![0], visible: false });
    for (const locale of ["zh-CN", "en"] as const) {
      const prompt = buildCompositionPrompt(draft, promptTranslator(locale));
      expect(prompt).toContain(locale === "en" ? "Golden section" : "黄金分割");
      expect(prompt).toContain(locale === "en" ? "Symmetrical composition" : "对称构图");
      expect(prompt).toContain(locale === "en" ? "Golden spiral" : "黄金螺旋");
      expect(prompt).toContain(locale === "en" ? "Triangular composition" : "三角构图");
      expect(prompt).not.toMatch(/composition\.prompt\.planning/);
    }
    expect(renderCompositionSketchSvg(draft)).toBe(renderCompositionSketchSvg(original));
  });
  it("adds exactly one optional style sentence without replacing the user's direction", () => {
    const draft = exampleDraft();
    const plain = buildCompositionPrompt(draft, promptTranslator("zh-CN"));
    const styled = buildCompositionPrompt(draft, promptTranslator("zh-CN"), "风格：大幅留白、紧凑文字层级与少量几何点缀。");
    expect(styled.split("\n").filter((line) => line.startsWith("风格："))).toEqual(["风格：大幅留白、紧凑文字层级与少量几何点缀。"]);
    expect(styled.replace("\n\n风格：大幅留白、紧凑文字层级与少量几何点缀。", "")).toBe(plain);
    expect(styled).toContain(draft.overallNote);
  });

  it("builds a localized external-AI prompt from the user draft", () => {
    const prompt = buildCompositionPrompt(exampleDraft(), promptTranslator("zh-CN"));

    expect(prompt).toContain("输出比例：16:9");
    expect(prompt).toContain("构图模式：版式编排");
    expect(prompt).toContain("按静态平面版式编排处理全部区域");
    expect(prompt).toContain("每个文字区域都必须呈现可见文字");
    expect(prompt).toContain("每个区域只是视觉影响范围，不是成品对象的固定外形");
    expect(prompt).toContain("可按真实内容重构、拆分、融合、重叠或延伸至画面之外");
    expect(prompt).not.toContain("建议尺寸");
    expect(prompt).not.toContain("1600");
    expect(prompt).toContain("整体要求：\n突出左侧主体，右侧保留呼吸感");
    expect(prompt).toContain("如附有参考图，请将其作为整体布局参考");
    expect(prompt).toContain("上传的参考图只表达内容的大致占位、重心和视觉分布");
    expect(prompt).toContain("焦点#1");
    expect(prompt).toContain("- 备注：人物面部");
    expect(prompt).toContain("- 景别：前景");
    expect(prompt).toContain("内容区域#1");
    expect(prompt).toContain("文字区域#2");
    expect(prompt).toContain("- 显示文字：静观自得");
    expect(prompt).toContain("- 视觉权重：高");
    expect(prompt).toContain("- 视觉权重：中");
    expect(prompt).toContain("- 可见内容约占整体画面的");
    expect(prompt).toContain("- 视觉分布倾向约 8°");
    expect(prompt).toContain("- 景别：背景");
    expect(prompt).toContain("动势：");
    expect(prompt).toContain("角度约 325°");
    expect(prompt).not.toContain("内部批注不应导出");
    expect(prompt).not.toContain("- 类型：");
    expect(prompt).not.toMatch(/画框|构图草图|参考形状|矩形|圆形|三角形|方向线/);
  });

  it("omits empty draft sections and supports English", () => {
    const prompt = buildCompositionPrompt(createDraft(), promptTranslator("en"));

    expect(prompt).toContain("Output ratio: 16:9");
    expect(prompt).toContain("Mode: Not selected");
    expect(prompt).toContain("Choose Scene or Editorial before continuing");
    expect(prompt).not.toContain("suggested size");
    expect(prompt).not.toContain("Overall direction:");
    expect(prompt).not.toContain("Overall image relationships:");
    expect(prompt).not.toContain("Visual focal points:");
    expect(prompt).not.toContain("Main content distribution:");
    expect(prompt).not.toContain("Flow:");
  });

  it("exports the selected layout's ratio and frame", () => {
    const portrait = changeFrame(createCompositionState(createDraft(), "state-1", "portrait"), { width: 900, height: 1600 });
    const landscape = selectCompositionState(portrait, "state-1");
    expect(buildCompositionPrompt(portrait, promptTranslator("en"))).toContain("Output ratio: 9:16");
    expect(buildCompositionPrompt(landscape, promptTranslator("en"))).toContain("Output ratio: 16:9");
    expect(renderCompositionSketchSvg(portrait)).toContain('width="900" height="1600"');
    expect(renderCompositionSketchSvg(landscape)).toContain('width="1600" height="900"');
  });

  it("uses external-facing English without internal geometry vocabulary", () => {
    const prompt = buildCompositionPrompt(exampleDraft(), promptTranslator("en"));

    expect(prompt).toContain("If a reference image is attached");
    expect(prompt).toContain(
      "Overall direction:\n突出左侧主体，右侧保留呼吸感",
    );
    expect(prompt).toContain("The uploaded reference image expresses only approximate placement");
    expect(prompt).toContain("Every region is a zone of visual influence, not a fixed final silhouette");
    expect(prompt).toContain("Flow:");
    expect(prompt).toContain("at an angle of approximately 325°");
    const planningGuidance = promptTranslator("en")("planningGuidance");
    expect(prompt).toContain(planningGuidance);
    expect(prompt.replace(planningGuidance, "")).not.toMatch(
      /suggested size|\bframe\b|composition sketch|reference shape|rectangle|circle|triangle|direction line/i,
    );
  });

  it("requires typography in empty text regions without fixing their copy", () => {
    const textRegion = addTextRegion(
      setProcessingSemantic(createDraft(), "editorial-layout"),
    );
    const prompt = buildCompositionPrompt(textRegion.draft, promptTranslator("zh-CN"));

    expect(prompt).toContain("每个文字区域都必须呈现可见文字");
    expect(prompt).toContain("文字内容：由模型创作，但本区域不能留空或改成普通图像内容");
  });

  it("renders a frame-cropped static SVG without editor guides", () => {
    const draft = exampleDraft();
    const frame = frameBoundsInCanvas(draft.frame);
    const svg = renderCompositionSketchSvg(draft);

    expect(svg).toContain(`width="${draft.frame.width}" height="${draft.frame.height}"`);
    expect(svg).toContain(
      `viewBox="${frame.x} ${frame.y} ${frame.width} ${frame.height}"`,
    );
    expect(svg).not.toContain("<polygon");
    expect(svg).toContain('id="composition-region-gradient"');
    expect(svg).toContain('data-region-kind="text-region"');
    expect(svg).toContain('data-reference-role="typography"');
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain("<circle");
    expect(svg).not.toContain("guide-grid");
    expect(svg).not.toContain(draft.overallNote);
  });

  it("describes image nodes without exposing image asset details", () => {
    const added = addCompositionImage(createDraft(), {
      x: 0.3,
      y: 0.4,
      width: 0.25,
      height: 0.2,
      rotation: 12,
    });
    let draft = updateItemMetadata(added.draft, added.id, {
      note: "人物参考照片",
      shotScale: "foreground",
    });
    draft = updateCompositionImage(draft, added.id, {
      assetId: "private-asset-id",
      crop: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
      visualWeight: "high",
    });

    const prompt = buildCompositionPrompt(draft, promptTranslator("zh-CN"));
    expect(prompt).toContain("图片节点：");
    expect(prompt).toContain("图片#1");
    expect(prompt).toContain("人物参考照片");
    expect(prompt).toContain("参考位置");
    expect(prompt).toContain("视觉权重：高");
    expect(prompt).not.toContain("private-asset-id");
    expect(prompt).not.toContain("0.1");

    const svg = renderCompositionSketchSvg(
      draft,
      () => "https://example.test/private-file.png",
    );
    expect(svg).toContain('data-region-kind="image"');
    expect(svg).toContain("https://example.test/private-file.png");
    expect(svg).toContain("clip-path");
  });
});
