import { ConfigProvider } from "antd";
import { checkCanvasLayerMenu } from "./canvasLayerStoryChecks";
import { checkCanvasImagePaste, uploadPastedStoryImage } from "./canvasImagePasteStoryChecks";
import type { Meta, StoryContext, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";

import { placeNodeInStory, placementLayer, placementPointer } from "./canvasPlacementStoryChecks";

import { createAppI18n } from "../../../../../web/i18n/createI18n";
import { promptTranslationKey } from "../../../../../locales/promptKeys";
import {
  assertStorySelector,
  assertStoryText,
} from "../vendor/yisiui/storybook/interactionChecks";
import {
  buildUiSketchPrompt,
  type UiSketchPromptTranslator,
} from "./uiSketchExport";
import {
  LONG_UI_SKETCH_FIXTURE,
  UI_SKETCH_FIXTURE,
} from "./uiSketchFixtures";
import {
  cloneUiSketchDraft,
  EMPTY_UI_SKETCH_DRAFT,
  UI_SKETCH_END_STAGE_ID,
  UI_SKETCH_START_STAGE_ID,
  uiSketchDraftForStage,
  updateUiSketchStageDraft,
  type UiSketchDraft,
} from "./uiSketchDraft";
import {
  UiSketchCanvas,
  type UiSketchCanvasProps,
} from "./UiSketchCanvas";

const storyI18n = createAppI18n("zh-CN");
const translatePrompt: UiSketchPromptTranslator = (key, values = {}) =>
  storyI18n.t(promptTranslationKey("uiSketch", key), values);

const meta = {
  id: "human2ai-ui-sketch-canvas",
  title: "human2ai/Canvas/Business/UiSketchCanvas",
  component: UiSketchCanvas,
  args: { translatePrompt },
  parameters: { layout: "fullscreen" },
  render: (args) => (
    <div style={{ height: "100vh" }}>
      <ControlledUiSketchCanvas {...args} />
    </div>
  ),
} satisfies Meta<typeof UiSketchCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

const stagedFixture = (() => {
  const stage = uiSketchDraftForStage(UI_SKETCH_FIXTURE, UI_SKETCH_END_STAGE_ID);
  stage.rectangles[0] = { ...stage.rectangles[0]!, x: 120, width: 260 };
  stage.rectangles[1] = { ...stage.rectangles[1]!, visible: false };
  return updateUiSketchStageDraft(UI_SKETCH_FIXTURE, UI_SKETCH_END_STAGE_ID, stage);
})();

const englishVisualWeightFixture = (() => {
  const draft = cloneUiSketchDraft(UI_SKETCH_FIXTURE);
  draft.rectangles[0] = { ...draft.rectangles[0]!, weight: "decorative" };
  return draft;
})();

const layerOrderFixture: UiSketchDraft = {
  ...cloneUiSketchDraft(UI_SKETCH_FIXTURE),
  images: [{ ...UI_SKETCH_FIXTURE.rectangles[0]!, id: "layer-image", assetId: null, crop: null }],
};

export const LayerOrder: Story = {
  name: "右键调整节点层级",
  args: { draft: layerOrderFixture },
  render: (args) => <ConfigProvider theme={{ token: { motion: false } }}><div style={{ height: "100vh" }}><ControlledUiSketchCanvas {...args} /></div></ConfigProvider>,
  play: ({ canvasElement }) => checkCanvasLayerMenu(canvasElement, "[data-ui-sketch-item]", "data-ui-sketch-item"),
};

export const ReadOnlyLayerOrder: Story = {
  name: "只读层级菜单",
  args: { draft: layerOrderFixture },
  render: (args) => <ConfigProvider theme={{ token: { motion: false } }}><div style={{ height: "100vh" }}><UiSketchCanvas {...args} onDraftChange={undefined} /></div></ConfigProvider>,
  play: ({ canvasElement }) => checkCanvasLayerMenu(canvasElement, "[data-ui-sketch-item]", "data-ui-sketch-item", true),
};

export const Default: Story = {
  name: "UI 界面",
  args: {
    draft: UI_SKETCH_FIXTURE,
    canvasSideActionPanelDefaultCollapsed: true,
  },
  play: async ({ canvasElement }: StoryContext) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="human2ai/ui-sketch-canvas"]');
    const sidePanel = canvasElement.querySelector<HTMLElement>(
      '[data-yisiui-asset="yisiui/side-action-panel"]',
    );
    if (!sidePanel || sidePanel.dataset.collapsed !== "true") {
      throw new Error("UI 界面画布操作首次显示时应为收起状态");
    }
    const expandSidePanel = canvasElement.querySelector<HTMLButtonElement>(
      'button[aria-label="展开 UI 界面操作"]',
    );
    if (!expandSidePanel) throw new Error("UI 界面画布操作缺少展开入口");
    expandSidePanel.click();
    await waitForCanvasRender();
    const toolGroup = canvasElement.querySelector<HTMLElement>(
      '[data-ui-sketch-tool-group="elements"]',
    );
    if (
      !toolGroup
      || getComputedStyle(toolGroup).gridTemplateColumns.trim().split(/\s+/).length !== 1
    ) {
      throw new Error("UI 界面画布操作展开后应保持单列");
    }
    assertStoryText(canvasElement, "区域");
    assertStoryText(canvasElement, "文字");
    assertStoryText(canvasElement, "图片");
    assertStoryText(canvasElement, "全局备注");
    assertStoryText(canvasElement, "复制");
    assertStoryText(canvasElement, "复制提示词");
    assertStoryText(canvasElement, "复制预览图");
    assertStoryText(canvasElement, "界面范围 · 960 × 560");
    assertStorySelector(canvasElement, '[aria-label="UI 界面无限画布"]');
    assertStorySelector(canvasElement, '[aria-label="UI 界面操作"]');
    assertStorySelector(canvasElement, '[data-ui-sketch-tool-group="elements"]');
    assertStorySelector(canvasElement, '[data-ui-sketch-tool-group="overall-note"]');
    assertStorySelector(canvasElement, '[data-ui-sketch-tool-group="copy"]');
    if (sidePanel.querySelector('button[aria-label="清空画布"]')) {
      throw new Error("清空画布不应出现在 UI 界面画布侧栏");
    }
    if (canvasElement.querySelector(".human2ai-ui-sketch-canvas__toolbar")) {
      throw new Error("UI 界面操作不应继续占用顶部工具栏");
    }
    assertStorySelector(canvasElement, '[data-canvas-frame="ui-frame"]');
    const frameBorder = canvasElement.querySelector<SVGGraphicsElement>(
      '[data-canvas-frame="ui-frame"] .human2ai-canvas-frame__border',
    );
    const frameHit = canvasElement.querySelector<SVGGraphicsElement>(
      '[data-canvas-frame="ui-frame"] .human2ai-canvas-frame__hit',
    );
    if (
      !frameBorder
      || !frameHit
      || getComputedStyle(frameBorder).fill !== "none"
      || getComputedStyle(frameBorder).pointerEvents !== "none"
      || getComputedStyle(frameHit).pointerEvents !== "stroke"
    ) {
      throw new Error("UI 界面范围必须无填充并且只能通过边框控制");
    }
    assertStorySelector(canvasElement, '[data-ui-sketch-kind="rectangle"]');
    const rectangleSurface = canvasElement.querySelector<SVGGraphicsElement>(
      '[data-ui-sketch-kind="rectangle"] .human2ai-ui-sketch-canvas__rectangle-surface',
    );
    if (
      !rectangleSurface
      || getComputedStyle(rectangleSurface).fill === "none"
      || getComputedStyle(rectangleSurface).stroke !== "none"
    ) {
      throw new Error("UI 区域常态必须使用无描边的默认矩形填充");
    }
    const rectangleFills = Array.from(
      canvasElement.querySelectorAll<SVGGraphicsElement>(
        '[data-ui-sketch-kind="rectangle"] .human2ai-ui-sketch-canvas__rectangle-surface',
      ),
      (surface) => getComputedStyle(surface).fill,
    );
    if (rectangleFills.length < 2 || new Set(rectangleFills).size < 2) {
      throw new Error("UI 区域必须自动分配不同填充色以保持相互可辨");
    }
    const firstRectangle = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-kind="rectangle"]',
    );
    if (
      !firstRectangle
      || firstRectangle.querySelector(".human2ai-ui-sketch-canvas__rectangle-note")
    ) {
      throw new Error("UI 区域备注不应显示在矩形内部");
    }
    firstRectangle.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await waitForCanvasRender();
    const regionNoteTooltip = document.body.querySelector<HTMLElement>('[role="tooltip"]');
    if (regionNoteTooltip?.textContent?.trim() !== UI_SKETCH_FIXTURE.rectangles[0]?.note) {
      throw new Error("悬停 UI 区域时必须在 Tooltip 中显示其备注");
    }
    firstRectangle.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    await waitForCanvasRender();
    assertStorySelector(canvasElement, '[data-ui-sketch-kind="text"]');
    if (
      canvasElement.textContent?.includes("系统组件")
      || canvasElement.textContent?.includes("占位符")
    ) {
      throw new Error("UI 界面不应包含系统组件或占位符工具");
    }
    const prompt = buildUiSketchPrompt(UI_SKETCH_FIXTURE, translatePrompt);
    if (
      !prompt.includes("画布建议尺寸：960 × 560px")
      || !prompt.includes("区域#1")
      || !prompt.includes("参考位置：x=304px，y=132px")
      || !prompt.includes("视觉权重：高")
      || !prompt.includes("不要求使用固定定位或逐像素复现")
      || !prompt.includes('显示文字："运行概览"')
      || !prompt.includes("备注：页面主标题")
      || prompt.includes("批注：")
      || prompt.includes("类型：")
      || prompt.includes("参考界面")
    ) {
      throw new Error("复制提示词没有生成外部可用的编号元素与参考布局说明");
    }
    if (prompt.includes("%") || /(?:x|y|宽|高)=\d+\.\d+px/.test(prompt)) {
      throw new Error("复制提示词不得包含百分比或小数几何值");
    }

    findButton(canvasElement, "图片").click();
    await waitForCanvasRender();
    await placeNodeInStory(canvasElement);
    const imageNode = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-kind="image"]',
    );
    if (!imageNode || !imageNode.querySelector('[data-image-status="empty"]')) {
      throw new Error("图片工具完成放置后必须创建默认图片节点");
    }
    if (imageNode.dataset.resizeMode !== "proportional") {
      throw new Error("UI 图片节点必须始终按比例缩放");
    }
    if (document.body.querySelector('input[type="file"]')) {
      throw new Error("图片节点未进入双击编辑时不应显示文件上传控件");
    }
    imageNode.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await waitForCanvasRender();
    if (!document.body.querySelector('input[type="file"][accept*="image/png"]')) {
      throw new Error("双击图片节点后必须显示图片上传控件");
    }
    const editor = document.body.querySelector<HTMLElement>(
      '[data-yisiui-asset="yisiui/text-mark-editor"]',
    );
    const imageFields = editor?.querySelector<HTMLElement>(
      '[data-yisiui-asset="human2ai/canvas-image-editor-fields"]',
    );
    const note = editor?.querySelector<HTMLElement>('[aria-label="备注"]');
    if (
      !imageFields
      || !note
      || imageFields.getBoundingClientRect().left <= note.getBoundingClientRect().right
    ) {
      throw new Error("UI 图片内容必须完整位于节点属性右侧");
    }
    if (editor?.querySelector(".ant-slider") || editor?.querySelector("[data-crop-selection]")) {
      throw new Error("空 UI 图片节点不应显示滑动条或裁剪选择框");
    }
  },
};

export const ClipboardImage: Story = {
  name: "粘贴图片与编辑替换",
  args: {
    draft: EMPTY_UI_SKETCH_DRAFT,
    onImageUpload: uploadPastedStoryImage,
    resolveImageSource: (assetId) => assetId,
  },
  play: ({ canvasElement }) => checkCanvasImagePaste(canvasElement, "ui-sketch"),
};

export const Blank: Story = {
  name: "空白界面",
  args: { draft: EMPTY_UI_SKETCH_DRAFT },
  play: ({ canvasElement }: StoryContext) => {
    assertStoryText(canvasElement, "界面范围 · 960 × 560");
    if (canvasElement.querySelector("[data-ui-sketch-item]")) {
      throw new Error("空白 UI 界面不应预置矩形或文字");
    }
  },
};

let stagedPrompt = "";

export const StagedVisibilityAndCopy: Story = {
  name: "阶段几何、显示状态与复制选项",
  args: {
    draft: stagedFixture,
    activeStageId: UI_SKETCH_END_STAGE_ID,
    writePrompt: async (content) => {
      stagedPrompt = content;
    },
  },
  play: async ({ canvasElement }: StoryContext) => {
    const hiddenRegion = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-kind="rectangle"][data-ui-sketch-visible="false"]',
    );
    if (!hiddenRegion || getComputedStyle(hiddenRegion).opacity !== "0.3") {
      throw new Error("隐藏节点必须在编辑画布中保留淡化的可恢复轮廓");
    }

    findButton(canvasElement, "复制提示词").click();
    await waitForCanvasRender();
    findMenuItem("开始");
    findMenuItem("结束");
    findMenuItem("动效").click();
    await waitForCanvasRender();
    const firstRegion = promptElementBlock(stagedPrompt, "区域#1", "区域#2");
    const secondRegion = promptElementBlock(stagedPrompt, "区域#2", "区域#3");
    const thirdRegion = promptElementBlock(stagedPrompt, "区域#3", "文字#1");
    if (
      !firstRegion.includes("状态 2：")
      || !firstRegion.includes("参考位置：x=120px，y=52px")
      || !firstRegion.includes("参考尺寸：宽=260px，高=456px")
      || !secondRegion.includes("改为隐藏")
      || thirdRegion.includes("状态 2：")
    ) {
      throw new Error("动效提示词必须把实际变化归入对应的编号元素");
    }

    findButton(canvasElement, "复制预览图").click();
    await waitForCanvasRender();
    findMenuItem("开始");
    findMenuItem("结束");
    if (findMenuItems("动效").length > 0) {
      throw new Error("复制预览图下拉不能提供动效提示词选项");
    }
  },
};

const placementChanges: UiSketchDraft[] = [];

export const NodePlacement: Story = {
  name: "单击放置与拖动创建",
  args: {
    draft: EMPTY_UI_SKETCH_DRAFT,
    onDraftChange: (draft) => { placementChanges.push(draft); },
  },
  play: async ({ canvasElement, args }) => {
    placementChanges.length = 0;
    findButton(canvasElement, "区域").click();
    await waitForCanvasRender();
    if (placementChanges.length) throw new Error("选择工具不应创建草稿节点");
    const layer = placementLayer(canvasElement);
    placementPointer(layer, "pointerdown", { x: 640, y: 360 });
    placementPointer(layer, "pointermove", { x: 440, y: 250 });
    await waitForCanvasRender();
    if (placementChanges.length || !layer.querySelector("path")?.getAttribute("d")) {
      throw new Error("拖动期间应只有轮廓预览，不能提交草稿");
    }
    placementPointer(layer, "pointerup", { x: 420, y: 230 });
    layer.ownerSVGElement?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitForCanvasRender();
    const stage = uiSketchDraftForStage(placementChanges.at(-1)!, args.activeStageId ?? UI_SKETCH_START_STAGE_ID);
    const region = stage.rectangles.at(-1)!;
    if (Number(placementChanges.length) !== 1 || region.x !== 420 || region.y !== 230
      || region.width !== 220 || region.height !== 130 || canvasElement.querySelector("[data-canvas-placement]")) {
      throw new Error("反向拖动必须按松手位置提交一次最终尺寸并退出工具");
    }
    for (const cancel of ["Escape", "pointercancel", "lostpointercapture"]) {
      findButton(canvasElement, "区域").click();
      await waitForCanvasRender();
      const pending = placementLayer(canvasElement);
      placementPointer(pending, "pointerdown", { x: 300, y: 200 });
      placementPointer(pending, "pointermove", { x: 400, y: 300 });
      if (cancel === "Escape") window.dispatchEvent(new KeyboardEvent("keydown", { key: cancel }));
      else placementPointer(pending, cancel, { x: 400, y: 300 });
      await waitForCanvasRender();
      if (Number(placementChanges.length) !== 1 || canvasElement.querySelector("[data-canvas-placement]")) {
        throw new Error("取消或丢失捕获不得新增节点");
      }
    }
    findButton(canvasElement, "图片").click();
    await waitForCanvasRender();
    await placeNodeInStory(canvasElement, { x: -120, y: -60 });
    const image = uiSketchDraftForStage(placementChanges.at(-1)!, args.activeStageId ?? UI_SKETCH_START_STAGE_ID).images.at(-1)!;
    if (image.x !== -120 || image.y !== -60 || image.width !== 320 || image.height !== 180) {
      throw new Error("单击图片应允许范围外位置并使用默认尺寸");
    }
    findButton(canvasElement, "文字").click();
    await waitForCanvasRender();
    await placeNodeInStory(canvasElement, { x: 220, y: 160 });
    const text = uiSketchDraftForStage(placementChanges.at(-1)!, args.activeStageId ?? UI_SKETCH_START_STAGE_ID).texts.at(-1)!;
    if (Number(placementChanges.length) !== 3 || text.x !== 220 || text.y !== 160 || text.fontSize !== 14
      || !document.body.querySelector('input[name="textContent"]')) {
      throw new Error("文字单击放置后应直接进入文字编辑");
    }
  },
};

export const EndStageNodePlacement: Story = {
  ...NodePlacement,
  name: "结束阶段放置节点",
  args: { ...NodePlacement.args, activeStageId: UI_SKETCH_END_STAGE_ID },
};

export const LongContent: Story = {
  name: "长备注与多行文字",
  args: { draft: LONG_UI_SKETCH_FIXTURE },
  play: ({ canvasElement }: StoryContext) => {
    assertStoryText(canvasElement, "第二行继续说明当前界面的主要目的");
    const longRectangle = Array.from(
      canvasElement.querySelectorAll<SVGGElement>('[data-ui-sketch-kind="rectangle"]'),
    ).find((element) => element.textContent?.includes("第二行只表示内容层级"));
    if (!longRectangle) throw new Error("长备注矩形没有保留用户手动换行");
  },
};

export const DefaultTextSize: Story = {
  name: "新建文字使用常规字号",
  args: { draft: EMPTY_UI_SKETCH_DRAFT },
  play: async ({ canvasElement }: StoryContext) => {
    findButton(canvasElement, "文字").click();
    await waitForCanvasRender();
    await placeNodeInStory(canvasElement);
    const text = canvasElement.querySelector<SVGTextElement>(
      '[data-ui-sketch-kind="text"] [data-yisiui-asset="human2ai/canvas-text"]',
    );
    if (text?.getAttribute("font-size") !== "14") {
      throw new Error("新建文字必须使用常规 14px 字号");
    }
  },
};

export const NearbyRegionEditor: Story = {
  name: "自动保存区域信息",
  args: { draft: EMPTY_UI_SKETCH_DRAFT },
  play: async ({ canvasElement }: StoryContext) => {
    findButton(canvasElement, "区域").click();
    await waitForCanvasRender();
    await placeNodeInStory(canvasElement);
    const region = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-kind="rectangle"]',
    );
    if (!region) throw new Error("备注编辑 Story 没有新建区域");
    region.dispatchEvent(new MouseEvent("dblclick", {
      bubbles: true,
    }));
    await waitForCanvasRender();

    const editor = document.body.querySelector<HTMLElement>(
      '[data-yisiui-asset="yisiui/text-mark-editor"]',
    );
    const selectedWeight = editor?.querySelector<HTMLElement>(
      ".ant-select-content",
    );
    if (!editor || selectedWeight?.textContent?.trim() !== "自动") {
      throw new Error("区域 TextMarkEditor 必须默认显示自动视觉权重");
    }
    if (canvasElement.querySelector('[data-yisiui-asset="human2ai/canvas-node-editor"]')) {
      throw new Error("区域备注不应继续使用 CanvasNodeEditor");
    }

    const note = editor.querySelector<HTMLTextAreaElement>('[aria-label="备注"]');
    if (!note) throw new Error("区域 TextMarkEditor 缺少备注输入框");
    if (findButtons(editor, "保存").length > 0) {
      throw new Error("自动保存的区域编辑器不应显示保存按钮");
    }
    setTextAreaValue(note, "导航与项目区域");
    await waitForCanvasRender();
    if (!region.getAttribute("aria-label")?.includes("导航与项目区域")) {
      throw new Error("区域备注没有即时写回草图");
    }
    editor.closest<HTMLElement>('[role="dialog"]')?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await waitForCanvasRender();
    if (!region.getAttribute("aria-label")?.includes("导航与项目区域")) {
      throw new Error("关闭自动保存编辑器后不应撤销区域备注");
    }
  },
};

export const EnglishVisualWeight: Story = {
  name: "英文视觉权重完整显示",
  args: {
    draft: englishVisualWeightFixture,
    labels: {
      visualWeight: "Visual weight",
      weightAuto: "Auto",
      weightHigh: "High",
      weightMedium: "Medium",
      weightLow: "Low",
      weightDecorative: "Decorative",
    },
  },
  play: async ({ canvasElement }: StoryContext) => {
    const region = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-kind="rectangle"]',
    );
    if (!region) throw new Error("英文视觉权重 Story 缺少区域节点");
    region.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await waitForCanvasRender();

    const select = document.body.querySelector<HTMLElement>(
      ".human2ai-ui-sketch-canvas__visual-weight-select",
    );
    if (!select || !select.textContent?.includes("Decorative")) {
      throw new Error("英文视觉权重没有完整进入下拉框");
    }
    if (select.getBoundingClientRect().width < 138) {
      throw new Error("视觉权重下拉框宽度不足以显示英文选项");
    }
  },
};

export const DeleteFromEditor: Story = {
  name: "TextMarkEditor 删除区域确认",
  args: { draft: UI_SKETCH_FIXTURE },
  play: async ({ canvasElement }: StoryContext) => {
    const region = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-item="rectangle:rectangle-summary"]',
    );
    if (!region) throw new Error("删除确认 Story 缺少区域节点");
    region.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await waitForCanvasRender();

    const editor = document.body.querySelector<HTMLElement>(
      '[data-yisiui-asset="yisiui/text-mark-editor"]',
    );
    if (!editor) throw new Error("删除确认 Story 没有打开 TextMarkEditor");
    findButton(editor, "删除区域").click();
    await waitForCanvasRender();
    assertStoryText(document.body, "确认删除这个区域？");

    const confirmButton = findButtons(document.body, "删除区域").at(-1);
    if (!confirmButton) throw new Error("删除确认缺少确认按钮");
    confirmButton.click();
    await waitForCanvasRender();
    if (canvasElement.querySelector('[data-ui-sketch-item="rectangle:rectangle-summary"]')) {
      throw new Error("确认删除后区域节点仍然存在");
    }
  },
};

export const ExternalToolHost: Story = {
  name: "外部右栏承载操作工具",
  args: { draft: UI_SKETCH_FIXTURE },
  render: (args) => <ExternalToolHostFixture {...args} />,
  play: ({ canvasElement }: StoryContext) => {
    assertStorySelector(canvasElement, "[data-ui-sketch-external-tools]");
    assertStorySelector(canvasElement, '[data-ui-sketch-tool-groups]');
    assertStorySelector(canvasElement, '[data-ui-sketch-tool-group="copy"]');
    const toolGroup = canvasElement.querySelector<HTMLElement>(
      '[data-ui-sketch-tool-group="elements"]',
    );
    if (
      !toolGroup
      || getComputedStyle(toolGroup).gridTemplateColumns.trim().split(/\s+/).length !== 2
    ) {
      throw new Error("外部右栏操作应保持两列");
    }
    const clearCanvasButton = findButton(canvasElement, "清空画布");
    if (clearCanvasButton.textContent?.trim()) {
      throw new Error("清空画布在操作工具标题右侧必须只显示图标");
    }
    assertStoryText(canvasElement, "复制");
    assertStoryText(canvasElement, "复制提示词");
    if (canvasElement.querySelector(".human2ai-infinite-canvas-viewport__side-actions")) {
      throw new Error("外部工具宿主启用时不应同时显示画布侧栏");
    }
  },
};

export const LocalizedTools: Story = {
  name: "英文操作工具",
  args: {
    draft: EMPTY_UI_SKETCH_DRAFT,
    labels: {
      region: "Region",
      addRegion: "Add region",
      text: "Text",
      addText: "Add text",
      newText: "Text",
      overallNote: "Global note",
      clearCanvas: "Clear canvas",
      clearCanvasConfirmTitle: "Clear the canvas?",
      clearCanvasConfirmDescription: "All regions, text, and images will be removed.",
      clearCanvasCancel: "Cancel",
      copyGroup: "Copy",
      copyPrompt: "Copy prompt",
      copySketch: "Copy preview",
      sideActions: "Interface actions",
      collapseSideActions: "Collapse interface actions",
      expandSideActions: "Expand interface actions",
    },
  },
  render: (args) => <ExternalToolHostFixture {...args} />,
  play: async ({ canvasElement }: StoryContext) => {
    assertStoryText(canvasElement, "Region");
    assertStoryText(canvasElement, "Global note");
    assertStoryText(canvasElement, "Clear canvas");
    assertStoryText(canvasElement, "Copy");
    assertStoryText(canvasElement, "Copy prompt");
    assertStorySelector(canvasElement, '[aria-label="Interface actions"]');
    findButton(canvasElement, "Text").click();
    await waitForCanvasRender();
    assertStorySelector(canvasElement, '[aria-label="Text：Text"]');
  },
};

export const FrameResize: Story = {
  name: "界面范围控制宽高",
  args: { draft: UI_SKETCH_FIXTURE },
  play: async ({ canvasElement }: StoryContext) => {
    const frame = canvasElement.querySelector<SVGGElement>('[data-canvas-node="ui-frame"]');
    if (!frame) throw new Error("界面范围节点不存在");
    frame.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitForCanvasRender();
    if (
      frame.querySelectorAll("[data-resize-handle]").length !== 8
      || !frame.querySelector('[data-resize-handle="right"]')
    ) {
      throw new Error("选中的界面范围必须支持四边和四角缩放");
    }
    const handle = canvasElement.querySelector<SVGRectElement>(
      '[data-node-id="ui-frame"][data-resize-handle="right"]',
    );
    if (!handle) throw new Error("界面范围缺少右边缩放柄");
    const rect = handle.getBoundingClientRect();
    const pointerId = 71;
    handle.dispatchEvent(pointerEvent("pointerdown", {
      pointerId,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }));
    handle.dispatchEvent(pointerEvent("pointermove", {
      pointerId,
      clientX: rect.left + rect.width / 2 + 80,
      clientY: rect.top + rect.height / 2,
    }));
    handle.dispatchEvent(pointerEvent("pointerup", { pointerId }));
    await waitForCanvasRender();
    assertStoryText(canvasElement, "界面范围 · 1040 × 560");
  },
};

export const FrameMinimumSize: Story = {
  name: "界面范围最小十乘十",
  args: { draft: UI_SKETCH_FIXTURE },
  play: async ({ canvasElement }: StoryContext) => {
    const frame = canvasElement.querySelector<SVGGElement>('[data-canvas-node="ui-frame"]');
    if (!frame) throw new Error("界面范围节点不存在");
    frame.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitForCanvasRender();
    const handle = canvasElement.querySelector<SVGRectElement>(
      '[data-node-id="ui-frame"][data-resize-handle="bottom-right"]',
    );
    if (!handle) throw new Error("界面范围缺少右下角缩放柄");
    const rect = handle.getBoundingClientRect();
    const pointerId = 73;
    const start = {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    };
    const end = {
      clientX: start.clientX - 2_000,
      clientY: start.clientY - 2_000,
    };
    handle.dispatchEvent(pointerEvent("pointerdown", { pointerId, ...start }));
    handle.dispatchEvent(pointerEvent("pointermove", { pointerId, ...end }));
    handle.dispatchEvent(pointerEvent("pointerup", { pointerId, ...end }));
    await waitForCanvasRender();
    assertStoryText(canvasElement, "界面范围 · 10 × 10");
  },
};

export const LockedInterfaceFrame: Story = {
  name: "锁定界面范围",
  args: {
    draft: UI_SKETCH_FIXTURE,
    interfaceFrameLocked: true,
  },
  play: ({ canvasElement }: StoryContext) => {
    const frame = canvasElement.querySelector<SVGGElement>('[data-canvas-node="ui-frame"]');
    const frameHit = canvasElement.querySelector<SVGRectElement>(
      '[data-canvas-frame="ui-frame"] [data-canvas-frame-hit="true"]',
    );
    if (
      !frame
      || frame.dataset.locked !== "true"
      || frame.getAttribute("aria-disabled") !== "true"
      || frame.querySelector("[data-resize-handle]")
      || frameHit?.dataset.frameMovable !== "false"
    ) {
      throw new Error("锁定的界面范围必须退出移动和缩放交互");
    }
  },
};

export const ClearCanvas: Story = {
  name: "清空画布",
  args: {
    draft: stagedFixture,
    activeStageId: UI_SKETCH_END_STAGE_ID,
  },
  render: (args) => <ExternalToolHostFixture {...args} />,
  play: async ({ canvasElement }: StoryContext) => {
    if (!canvasElement.querySelector("[data-ui-sketch-item]")) {
      throw new Error("清空画布 Story 缺少草图节点");
    }
    findButton(canvasElement, "清空画布").click();
    await waitForCanvasRender();
    assertStoryText(document.body, "确认清空画布？");
    assertStoryText(
      document.body,
      "所有区域、文字和图片都会被移除，此操作无法撤回。",
    );
    if (!canvasElement.querySelector("[data-ui-sketch-item]")) {
      throw new Error("确认前不应清空画布");
    }
    const confirmButton = findButtons(document.body, "清空画布").at(-1);
    if (!confirmButton) throw new Error("清空画布缺少确认按钮");
    confirmButton.click();
    await waitForCanvasRender();
    if (canvasElement.querySelector("[data-ui-sketch-item]")) {
      throw new Error("清空画布后仍然存在区域或文字节点");
    }
    assertStoryText(canvasElement, "界面范围 · 960 × 560");
    findButton(canvasElement, "复制提示词").click();
    await waitForCanvasRender();
    if (findMenuItems("动效").length === 0) {
      throw new Error("清空画布不应移除已有动效阶段");
    }
  },
};

export const FrameMove: Story = {
  name: "四边拖动画框",
  args: { draft: UI_SKETCH_FIXTURE },
  play: async ({ canvasElement }: StoryContext) => {
    const scene = canvasElement.querySelector<SVGSVGElement>("[data-ui-sketch-scene]");
    const frame = canvasElement.querySelector<SVGGElement>('[data-canvas-node="ui-frame"]');
    const hit = frame?.querySelector<SVGRectElement>(".human2ai-canvas-frame__hit");
    const item = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-item="rectangle:rectangle-sidebar"]',
    );
    if (!scene || !frame || !hit || !item) {
      throw new Error("界面范围移动 Story 缺少测试场景");
    }
    const frameStart = {
      x: Number(frame.dataset.nodeX),
      y: Number(frame.dataset.nodeY),
    };
    const itemStart = {
      x: Number(item.dataset.nodeX),
      y: Number(item.dataset.nodeY),
    };
    const dragStart = clientPointForWorld(scene, { x: 0, y: 280 });
    const dragEnd = clientPointForWorld(scene, { x: 24, y: 300 });
    const pointerId = 75;
    hit.dispatchEvent(pointerEvent("pointerdown", { pointerId, ...dragStart }));
    hit.dispatchEvent(pointerEvent("pointermove", { pointerId, ...dragEnd }));
    hit.dispatchEvent(pointerEvent("pointerup", { pointerId, ...dragEnd }));
    hit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await waitForCanvasRender();

    if (
      Number(frame.dataset.nodeX) !== frameStart.x + 24
      || Number(frame.dataset.nodeY) !== frameStart.y + 20
    ) {
      throw new Error("拖动画框四边必须移动界面范围");
    }
    if (
      Number(item.dataset.nodeX) !== itemStart.x
      || Number(item.dataset.nodeY) !== itemStart.y
    ) {
      throw new Error("移动界面范围不应连带移动草图元素");
    }
    if (frame.dataset.selected !== "false") {
      throw new Error("拖动未选中的界面范围不应自动选中画框");
    }
  },
};

export const NodeDragSelection: Story = {
  name: "节点拖动不改变选择",
  args: { draft: UI_SKETCH_FIXTURE },
  play: async ({ canvasElement }: StoryContext) => {
    const scene = canvasElement.querySelector<SVGSVGElement>("[data-ui-sketch-scene]");
    const node = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-item="rectangle:rectangle-summary"]',
    );
    const shape = node?.querySelector<SVGGraphicsElement>(
      ".human2ai-ui-sketch-canvas__rectangle-surface",
    );
    if (!scene || !node || !shape) throw new Error("节点拖动 Story 缺少测试场景");
    const start = {
      x: Number(node.dataset.nodeX),
      y: Number(node.dataset.nodeY),
    };
    const dragStart = clientPointForWorld(scene, start);
    const dragEnd = clientPointForWorld(scene, { x: start.x + 24, y: start.y + 20 });
    const pointerId = 76;
    shape.dispatchEvent(pointerEvent("pointerdown", { pointerId, ...dragStart }));
    scene.dispatchEvent(pointerEvent("pointermove", { pointerId, ...dragEnd }));
    await waitForCanvasRender();
    if (
      scene.dataset.canvasDragging !== "node"
      || getComputedStyle(scene).cursor !== "grabbing"
    ) {
      throw new Error("拖动 UI 界面节点期间画布必须持续显示抓取光标");
    }
    scene.dispatchEvent(pointerEvent("pointerup", { pointerId, ...dragEnd }));
    shape.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await waitForCanvasRender();

    if (scene.dataset.canvasDragging) {
      throw new Error("UI 界面节点拖动结束后画布必须清除抓取状态");
    }

    if (
      Number(node.dataset.nodeX) !== start.x + 24
      || Number(node.dataset.nodeY) !== start.y + 20
      || node.dataset.selected !== "false"
    ) {
      throw new Error("拖动未选中节点必须只移动位置并保持未选中");
    }

    shape.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitForCanvasRender();
    const selectedNode = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-item="rectangle:rectangle-summary"]',
    );
    if (selectedNode?.dataset.selected !== "true") {
      throw new Error("节点只能通过点击进入选中状态");
    }
    const selectedOutline = selectedNode.querySelector<SVGGraphicsElement>(
      ".human2ai-canvas-node__outline",
    );
    const selectedOutlineStroke = selectedOutline
      ? getComputedStyle(selectedOutline).stroke
      : "none";
    if (
      selectedOutlineStroke === "none"
      || selectedOutlineStroke === "transparent"
      || selectedOutlineStroke === "rgba(0, 0, 0, 0)"
    ) {
      throw new Error("选中区域必须由 CanvasNode 显示独立操作轮廓");
    }
  },
};

export const BlankDeselection: Story = {
  name: "空白点击与空框选取消选择",
  args: { draft: UI_SKETCH_FIXTURE },
  play: async ({ canvasElement }: StoryContext) => {
    const scene = canvasElement.querySelector<SVGSVGElement>("[data-ui-sketch-scene]");
    const surface = canvasElement.querySelector<SVGRectElement>(
      ".human2ai-ui-sketch-canvas__world-surface",
    );
    const node = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-item="rectangle:rectangle-summary"]',
    );
    if (!scene || !surface || !node) {
      throw new Error("空白取消选择 Story 缺少测试场景");
    }

    node.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await waitForCanvasRender();
    if (node.dataset.selected !== "true") throw new Error("测试节点未进入选中状态");

    const blankClick = clientPointForWorld(scene, { x: 300, y: 500 });
    surface.dispatchEvent(pointerEvent("pointerdown", { pointerId: 77, ...blankClick }));
    surface.dispatchEvent(pointerEvent("pointerup", { pointerId: 77, ...blankClick }));
    surface.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitForCanvasRender();
    if (canvasElement.querySelector('[data-canvas-node][data-selected="true"]')) {
      throw new Error("点击画布空白处必须清空当前选择");
    }

    node.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await waitForCanvasRender();
    const marqueeEnd = clientPointForWorld(scene, { x: 360, y: 540 });
    surface.dispatchEvent(pointerEvent("pointerdown", {
      pointerId: 78,
      shiftKey: true,
      ...blankClick,
    }));
    scene.dispatchEvent(pointerEvent("pointermove", {
      pointerId: 78,
      shiftKey: true,
      ...marqueeEnd,
    }));
    await waitForCanvasRender();
    if (!canvasElement.querySelector("[data-ui-sketch-marquee]")) {
      throw new Error("空白框选手势没有显示框选范围");
    }
    scene.dispatchEvent(pointerEvent("pointerup", {
      pointerId: 78,
      shiftKey: true,
      ...marqueeEnd,
    }));
    surface.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitForCanvasRender();
    if (canvasElement.querySelector('[data-canvas-node][data-selected="true"]')) {
      throw new Error("框选未命中任何节点时必须清空当前选择");
    }
  },
};

export const TextBoundsAndMove: Story = {
  name: "文字边界与直接拖动",
  args: { draft: UI_SKETCH_FIXTURE },
  play: async ({ canvasElement }: StoryContext) => {
    await waitForCanvasRender();
    const scene = canvasElement.querySelector<SVGSVGElement>("[data-ui-sketch-scene]");
    const node = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-item="text:text-title"]',
    );
    const text = node?.querySelector<SVGTextElement>(
      '[data-yisiui-asset="human2ai/canvas-text"]',
    );
    if (!scene || !node || !text) {
      throw new Error("文字边界 Story 缺少测试场景");
    }
    if (getComputedStyle(text).pointerEvents === "none") {
      throw new Error("文字本体必须接收指针拖动");
    }

    text.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitForCanvasRender();
    const outline = node.querySelector<SVGRectElement>(".human2ai-canvas-node__outline");
    if (!outline) throw new Error("文字节点缺少操作框");
    const textRect = text.getBoundingClientRect();
    const outlineRect = outline.getBoundingClientRect();
    if (
      Math.abs(textRect.x - outlineRect.x) > 0.75
      || Math.abs(textRect.y - outlineRect.y) > 0.75
      || Math.abs(textRect.width - outlineRect.width) > 0.75
      || Math.abs(textRect.height - outlineRect.height) > 0.75
    ) {
      throw new Error("文字操作框必须匹配实际渲染范围");
    }

    const start = {
      x: Number(node.dataset.nodeX),
      y: Number(node.dataset.nodeY),
    };
    const dragStart = clientPointForWorld(scene, start);
    const dragEnd = clientPointForWorld(scene, {
      x: start.x + 24,
      y: start.y + 20,
    });
    const pointerId = 77;
    text.dispatchEvent(pointerEvent("pointerdown", { pointerId, ...dragStart }));
    scene.dispatchEvent(pointerEvent("pointermove", { pointerId, ...dragEnd }));
    scene.dispatchEvent(pointerEvent("pointerup", { pointerId, ...dragEnd }));
    await waitForCanvasRender();
    if (
      Number(node.dataset.nodeX) !== start.x + 24
      || Number(node.dataset.nodeY) !== start.y + 20
    ) {
      throw new Error("拖动文字本体必须像区域形状一样移动文字节点");
    }
  },
};

export const TextEditorControls: Story = {
  name: "文字编辑字号调节",
  args: { draft: UI_SKETCH_FIXTURE },
  play: async ({ canvasElement }: StoryContext) => {
    const node = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-item="text:text-supporting"]',
    );
    if (!node) throw new Error("文字编辑 Story 缺少 16px 文字节点");
    const bounds = node.getBoundingClientRect();
    node.dispatchEvent(new MouseEvent("dblclick", {
      bubbles: true,
      clientX: bounds.right,
      clientY: bounds.top + bounds.height / 2,
    }));
    await waitForCanvasRender();

    assertStoryText(document.body, "16px");
    const editor = document.body.querySelector<HTMLElement>(
      '[data-yisiui-asset="yisiui/text-mark-editor"]',
    );
    const note = editor?.querySelector<HTMLTextAreaElement>('[aria-label="备注"]');
    const selectedWeight = editor?.querySelector<HTMLElement>(".ant-select-content");
    if (
      !note
      || note.value !== "更新时间说明"
      || selectedWeight?.textContent?.trim() !== "低"
    ) {
      throw new Error("文字编辑器必须显示备注与当前视觉权重");
    }
    const decrease = editor?.querySelector<HTMLButtonElement>('[aria-label="减小字号"]');
    const increase = editor?.querySelector<HTMLButtonElement>('[aria-label="增大字号"]');
    if (!decrease || !increase) throw new Error("文字编辑器缺少字号加减按钮");
    increase.click();
    await waitForCanvasRender();
    assertStoryText(document.body, "17px");
    decrease.click();
    await waitForCanvasRender();
    assertStoryText(document.body, "16px");
  },
};

export const NodeOriginLabels: Story = {
  name: "节点来源英文标签",
  args: { draft: UI_SKETCH_FIXTURE },
  play: async ({ canvasElement }: StoryContext) => {
    const expectedOrigins = [
      ["rectangle:rectangle-sidebar", "user"],
      ["rectangle:rectangle-summary", "agent"],
      ["rectangle:rectangle-action", "import"],
    ] as const;

    for (const [itemKey, origin] of expectedOrigins) {
      const node = canvasElement.querySelector<SVGGElement>(
        `[data-ui-sketch-item="${itemKey}"]`,
      );
      if (!node) throw new Error(`节点来源 Story 缺少 ${itemKey}`);
      node.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      await waitForCanvasRender();

      const marker = document.body.querySelector<HTMLElement>(
        `[data-ui-sketch-origin="${origin}"]`,
      );
      if (marker?.textContent?.trim() !== origin) {
        throw new Error(`节点来源必须以固定英文显示 ${origin}`);
      }
      marker.closest<HTMLElement>('[role="dialog"]')?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      await waitForCanvasRender();
    }
  },
};

export const ImportedTextEditor: Story = {
  name: "原有文字说明与编辑",
  args: { draft: UI_SKETCH_FIXTURE },
  play: async ({ canvasElement }: StoryContext) => {
    const node = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-item="text:text-title"]',
    );
    if (!node) throw new Error("原有文字 Story 缺少标题节点");
    node.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await waitForCanvasRender();

    const editor = document.body.querySelector<HTMLElement>(
      '[data-yisiui-asset="yisiui/text-mark-editor"]',
    );
    const marker = editor?.querySelector<HTMLElement>(
      '[data-ui-sketch-origin="import"]',
    );
    const description = editor?.querySelector<HTMLElement>(
      "[data-ui-sketch-node-description]",
    );
    const input = editor?.querySelector<HTMLInputElement>('[aria-label="显示文字"]');
    if (
      !editor
      || marker?.textContent?.trim() !== "import"
      || description?.textContent?.trim() !== "标题层级最高"
      || !input
      || input.disabled
    ) {
      throw new Error("原有文字必须显示只读节点说明、import 标签和可编辑文字内容");
    }

    setInputValue(input, "新的运行概览");
    await waitForCanvasRender();
    const updated = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-item="text:text-title"]',
    );
    if (!updated?.textContent?.includes("新的运行概览")) {
      throw new Error("修改原有静态文字后必须立即写回草图");
    }
  },
};

export const EmptyTextPlaceholder: Story = {
  name: "空文字浅色占位",
  args: { draft: UI_SKETCH_FIXTURE },
  play: async ({ canvasElement }: StoryContext) => {
    const node = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-item="text:text-supporting"]',
    );
    if (!node) throw new Error("空文字占位 Story 缺少文字节点");
    const bounds = node.getBoundingClientRect();
    node.dispatchEvent(new MouseEvent("dblclick", {
      bubbles: true,
      clientX: bounds.right,
      clientY: bounds.top + bounds.height / 2,
    }));
    await waitForCanvasRender();
    const editor = document.body.querySelector<HTMLElement>(
      '[data-yisiui-asset="yisiui/text-mark-editor"]',
    );
    const input = editor?.querySelector<HTMLInputElement>('[aria-label="显示文字"]');
    if (!editor || !input) throw new Error("文字 TextMarkEditor 缺少单行文字输入框");
    setInputValue(input, "");
    await waitForCanvasRender();
    const emptyNode = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-item="text:text-supporting"]',
    );
    const placeholder = emptyNode?.querySelector<SVGTextElement>(
      ".human2ai-ui-sketch-canvas__text-content--empty",
    );
    if (
      !emptyNode
      || placeholder?.textContent !== "---文字未输入---"
    ) {
      throw new Error("自动保存空文字后必须保留节点并显示浅色占位文案");
    }
    if (findButtons(editor, "保存").length > 0) {
      throw new Error("自动保存的文字编辑器不应显示保存按钮");
    }
  },
};

export const TextResizeGesture: Story = {
  name: "文字缩放手势稳定",
  args: { draft: UI_SKETCH_FIXTURE },
  play: async ({ canvasElement }: StoryContext) => {
    await waitForCanvasRender();
    const node = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-item="text:text-title"]',
    );
    const text = node?.querySelector<SVGTextElement>(
      '[data-yisiui-asset="human2ai/canvas-text"]',
    );
    if (!node || !text) throw new Error("文字缩放 Story 缺少测试场景");

    text.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitForCanvasRender();
    const handle = node.querySelector<SVGRectElement>(
      '[data-resize-handle="bottom-right"]',
    );
    if (!handle) throw new Error("文字节点缺少右下缩放柄");

    const initial = textResizeSnapshot(node, text);
    const handleRect = handle.getBoundingClientRect();
    const start = {
      clientX: handleRect.left + handleRect.width / 2,
      clientY: handleRect.top + handleRect.height / 2,
    };
    const pointerId = 79;
    const moveTo = async (delta: number) => {
      handle.dispatchEvent(pointerEvent("pointermove", {
        pointerId,
        clientX: start.clientX + delta,
        clientY: start.clientY + delta * initial.height / initial.width,
      }));
      await waitForCanvasRender();
      return textResizeSnapshot(node, text);
    };

    handle.dispatchEvent(pointerEvent("pointerdown", { pointerId, ...start }));
    const firstForward = await moveTo(12);
    const fartherForward = await moveTo(36);
    const returnedForward = await moveTo(12);
    const restored = await moveTo(0);
    handle.dispatchEvent(pointerEvent("pointerup", { pointerId, ...start }));

    if (
      firstForward.fontSize <= initial.fontSize
      || fartherForward.fontSize <= firstForward.fontSize
    ) {
      throw new Error("向外拖动文字缩放柄必须按指针距离增大字号");
    }
    if (returnedForward.fontSize !== firstForward.fontSize) {
      throw new Error("同一手势回到相同指针位置时必须恢复相同字号");
    }
    if (
      restored.fontSize !== initial.fontSize
      || Math.abs(restored.nodeX - initial.nodeX) > 0.01
      || Math.abs(restored.nodeY - initial.nodeY) > 0.01
    ) {
      throw new Error("同一手势回到起点时必须恢复初始字号与操作框中心");
    }
    for (const snapshot of [firstForward, fartherForward, returnedForward, restored]) {
      if (
        Math.abs(snapshot.x - initial.x) > 0.75
        || Math.abs(snapshot.y - initial.y) > 0.75
      ) {
        throw new Error("从右下缩放文字时左上角不得漂移");
      }
    }
  },
};

export const MultiSelection: Story = {
  name: "框选与整组拖动",
  args: { draft: UI_SKETCH_FIXTURE },
  play: async ({ canvasElement }: StoryContext) => {
    const scene = canvasElement.querySelector<SVGSVGElement>("[data-ui-sketch-scene]");
    const first = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-item="rectangle:rectangle-sidebar"]',
    );
    const second = canvasElement.querySelector<SVGGElement>(
      '[data-ui-sketch-item="rectangle:rectangle-summary"]',
    );
    if (!scene || !first || !second) throw new Error("多选 Story 缺少测试场景或矩形");
    const pointerId = 81;
    const start = clientPointForWorld(scene, { x: 24, y: 124 });
    const end = clientPointForWorld(scene, { x: 920, y: 316 });
    scene.dispatchEvent(pointerEvent("pointerdown", { pointerId, ...start }));
    scene.dispatchEvent(pointerEvent("pointermove", { pointerId, ...end }));
    scene.dispatchEvent(pointerEvent("pointerup", { pointerId, ...end }));
    await waitForCanvasRender();

    const selected = canvasElement.querySelectorAll(
      '[data-ui-sketch-item][data-selected="true"]',
    );
    if (selected.length !== 2 || !canvasElement.querySelector("[data-ui-sketch-multi-selection]")) {
      throw new Error(`框选应选择两个矩形，实际选择 ${selected.length} 个元素`);
    }

    const firstStart = {
      x: Number(first.dataset.nodeX),
      y: Number(first.dataset.nodeY),
    };
    const secondStart = {
      x: Number(second.dataset.nodeX),
      y: Number(second.dataset.nodeY),
    };
    const dragStart = clientPointForWorld(scene, firstStart);
    const dragEnd = clientPointForWorld(scene, {
      x: firstStart.x + 24,
      y: firstStart.y + 20,
    });
    const selection = canvasElement.querySelector<SVGRectElement>("[data-ui-sketch-multi-selection]")!;
    const screens = [first, second, selection].map((element) => element.getScreenCTM()!);
    first.dispatchEvent(pointerEvent("pointerdown", {
      pointerId: pointerId + 1,
      ...dragStart,
    }));
    scene.dispatchEvent(pointerEvent("pointermove", {
      pointerId: pointerId + 1,
      ...dragEnd,
    }));
    await waitForCanvasRender();
    if ([first, second, selection].some((element, index) => (
      Math.abs(element.getScreenCTM()!.e - screens[index]!.e - dragEnd.clientX + dragStart.clientX) > 0.02
      || Math.abs(element.getScreenCTM()!.f - screens[index]!.f - dragEnd.clientY + dragStart.clientY) > 0.02
    ))) {
      throw new Error("多选节点与整体选择框应共同预览位移");
    }
    scene.dispatchEvent(pointerEvent("pointerup", {
      pointerId: pointerId + 1,
      ...dragEnd,
    }));
    await waitForCanvasRender();

    if (
      Number(first.dataset.nodeX) !== firstStart.x + 24
      || Number(first.dataset.nodeY) !== firstStart.y + 20
      || Number(second.dataset.nodeX) !== secondStart.x + 24
      || Number(second.dataset.nodeY) !== secondStart.y + 20
    ) {
      throw new Error("拖动多选中的矩形时必须保持相对位置一起移动");
    }
  },
};

const groupedButtonChanges: UiSketchDraft[] = [];
const buttonGroupFixture: UiSketchDraft = {
  ...cloneUiSketchDraft(EMPTY_UI_SKETCH_DRAFT),
  rectangles: [{ ...UI_SKETCH_FIXTURE.rectangles[2]!, id: "button", x: 320, y: 240, width: 160, height: 48 }],
  texts: [{ ...UI_SKETCH_FIXTURE.texts[0]!, id: "label", x: 370, y: 252, text: "保存", fontSize: 16 }],
};

export const PersistentGroups: Story = {
  name: "右键建组与解组",
  render: (args) => <ConfigProvider theme={{ token: { motion: false } }}><div style={{ height: "100vh" }}><ControlledUiSketchCanvas {...args} /></div></ConfigProvider>,
  args: {
    draft: buttonGroupFixture,
    onDraftChange: (draft) => { groupedButtonChanges.push(draft); },
  },
  play: async ({ canvasElement }: StoryContext) => {
    groupedButtonChanges.length = 0;
    const scene = canvasElement.querySelector<SVGSVGElement>("[data-ui-sketch-scene]")!;
    const button = canvasElement.querySelector<SVGGElement>('[data-ui-sketch-item="rectangle:button"]')!;
    const label = canvasElement.querySelector<SVGGElement>('[data-ui-sketch-item="text:label"]')!;
    const menuIsVisible = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menu"]'))
      .some((menu) => menu.checkVisibility());
    const waitForMenuClose = async () => {
      for (let attempt = 0; attempt < 40 && menuIsVisible(); attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 25));
      }
    };
    const rightClick = async (target: Element, contextMenuBeforeRelease = false) => {
      const bounds = target.getBoundingClientRect();
      const event = { pointerId: 231, button: 2, clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2 };
      target.dispatchEvent(pointerEvent("pointerdown", event));
      const nativeContextMenu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, ...event });
      if (contextMenuBeforeRelease) target.dispatchEvent(nativeContextMenu);
      target.dispatchEvent(pointerEvent("pointerup", event));
      await waitForCanvasRender();
      if (!contextMenuBeforeRelease) target.dispatchEvent(nativeContextMenu);
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      if (!menuIsVisible()) {
        throw new Error("松开右键后的原生菜单事件不应关闭刚打开的菜单");
      }
    };
    await rightClick(scene);
    if (findMenuItem("建组").getAttribute("aria-disabled") !== "true"
      || findMenuItem("解组").getAttribute("aria-disabled") !== "true") {
      throw new Error("无选择时建组和解组应禁用");
    }
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    await waitForMenuClose();
    if (menuIsVisible()) {
      throw new Error("点击菜单外部应关闭菜单");
    }
    await rightClick(scene, true);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }));
    await waitForMenuClose();
    if (menuIsVisible() || document.activeElement !== scene) {
      throw new Error("Escape 应关闭菜单并恢复画布焦点");
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitForCanvasRender();
    label.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    await waitForCanvasRender();
    await rightClick(label);
    findMenuItem("建组").click();
    await waitForCanvasRender();
    const grouped = groupedButtonChanges.at(-1)!;
    if (grouped.groups.length !== 1 || grouped.groups[0]!.itemIds.length !== 2) {
      throw new Error("右键建组应保存按钮背景和文字的关系");
    }
    if (canvasElement.querySelector('[data-ui-sketch-tool-groups]')?.textContent?.includes("建组")) {
      throw new Error("建组不能放到侧栏");
    }
    scene.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitForCanvasRender();
    label.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitForCanvasRender();
    if (canvasElement.querySelectorAll('[data-ui-sketch-item][data-selected="true"]').length !== 2) {
      throw new Error("重新点击文字应选中整组");
    }
    const start = clientPointForWorld(scene, { x: 375, y: 260 });
    const end = clientPointForWorld(scene, { x: 399, y: 280 });
    const countBefore = groupedButtonChanges.length;
    label.dispatchEvent(pointerEvent("pointerdown", { pointerId: 232, ...start }));
    scene.dispatchEvent(pointerEvent("pointermove", { pointerId: 232, ...end }));
    scene.dispatchEvent(pointerEvent("pointerup", { pointerId: 232, ...end }));
    await waitForCanvasRender();
    const moved = groupedButtonChanges.at(-1)!;
    if (groupedButtonChanges.length !== countBefore + 1
      || moved.rectangles[0]!.x !== 344 || moved.texts[0]!.x !== 394
      || moved.rectangles[0]!.y !== 260 || moved.texts[0]!.y !== 272) {
      throw new Error("组内成员应保持相对位置并且松手只提交一次");
    }
    label.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await waitForCanvasRender();
    const nudged = groupedButtonChanges.at(-1)!;
    if (nudged.rectangles[0]!.x !== 345 || nudged.texts[0]!.x !== 395) {
      throw new Error("方向键应移动整组");
    }
    label.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await waitForCanvasRender();
    const textInput = document.querySelector<HTMLInputElement>('input[name="textContent"]');
    if (!textInput) throw new Error("组内文字仍应可以单独编辑");
    setInputValue(textInput, "保存修改");
    await waitForCanvasRender();
    document.querySelector<HTMLButtonElement>('.ant-modal-close')?.click();
    await waitForCanvasRender();
    label.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }));
    await waitForCanvasRender();
    findMenuItem("解组").click();
    await waitForCanvasRender();
    const ungrouped = groupedButtonChanges.at(-1)!;
    if (ungrouped.groups.length !== 0 || ungrouped.texts[0]!.text !== "保存修改"
      || ungrouped.rectangles[0]!.x !== 345) {
      throw new Error("解组应保留文字修改及几何");
    }
    label.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitForCanvasRender();
    if (canvasElement.querySelectorAll('[data-ui-sketch-item][data-selected="true"]').length !== 1) {
      throw new Error("解组后应恢复独立选择");
    }
    scene.dispatchEvent(pointerEvent("pointerdown", { pointerId: 233, button: 2, ...start }));
    scene.dispatchEvent(pointerEvent("pointermove", { pointerId: 233, button: 2, ...end }));
    scene.dispatchEvent(pointerEvent("pointerup", { pointerId: 233, button: 2, ...end }));
    await waitForCanvasRender();
    // The Dropdown retains its portal during the exit animation.
    await waitForMenuClose();
    if (menuIsVisible()) {
      throw new Error("右键平移后不应弹出菜单");
    }
  },
};

export const GroupedMemberDeletion: Story = {
  name: "组内单项删除",
  args: {
    draft: { ...buttonGroupFixture, groups: [{ id: "button-group", itemIds: ["button", "label"] }] },
    onDraftChange: (draft) => { groupedButtonChanges.push(draft); },
  },
  play: async ({ canvasElement }: StoryContext) => {
    groupedButtonChanges.length = 0;
    const label = canvasElement.querySelector<SVGGElement>('[data-ui-sketch-item="text:label"]')!;
    label.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitForCanvasRender();
    label.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await waitForCanvasRender();
    const editor = document.body.querySelector<HTMLElement>('[data-yisiui-asset="yisiui/text-mark-editor"]')!;
    findButton(editor, "删除文字").click();
    await waitForCanvasRender();
    findButtons(document.body, "删除文字").at(-1)!.click();
    await waitForCanvasRender();
    const saved = groupedButtonChanges.at(-1)!;
    if (saved.rectangles.length !== 1 || saved.texts.length !== 0 || saved.groups.length !== 0) {
      throw new Error("编辑器删除文字只能删除该成员，并清理不足两个成员的组");
    }
  },
};

export const ReadOnlyGroups: Story = {
  name: "只读组菜单",
  args: { draft: { ...buttonGroupFixture, groups: [{ id: "button-group", itemIds: ["button", "label"] }] } },
  render: (args) => <div style={{ height: "100vh" }}><UiSketchCanvas {...args} /></div>,
  play: async ({ canvasElement }: StoryContext) => {
    const label = canvasElement.querySelector<SVGGElement>('[data-ui-sketch-item="text:label"]')!;
    label.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitForCanvasRender();
    label.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }));
    await waitForCanvasRender();
    if (findMenuItem("建组").getAttribute("aria-disabled") !== "true"
      || findMenuItem("解组").getAttribute("aria-disabled") !== "true") {
      throw new Error("只读组必须禁用建组和解组");
    }
  },
};

let copiedPrompt = "";
const sketchCopyTracker = { count: 0 };

const outsideFrameFixture = (() => {
  const draft = cloneUiSketchDraft(EMPTY_UI_SKETCH_DRAFT);
  draft.frame = { x: 0, y: 0, width: 320, height: 240 };
  draft.overallNote = "保留界面整体要求";
  draft.rectangles = [{ ...UI_SKETCH_FIXTURE.rectangles[0]!, x: 30, y: 50, width: 60, height: 40, note: "范围外区域" }];
  draft.images = [{ ...draft.rectangles[0]!, id: "image-1", x: 150, note: "范围外图片", assetId: null, crop: null }];
  draft.texts = [{ ...UI_SKETCH_FIXTURE.texts[0]!, x: 30, y: 120, fontSize: 16, text: "范围外文字" }];
  return draft;
})();

const dragDraftChanges: UiSketchCanvasProps["draft"][] = [];

export const DragPreview: Story = {
  name: "拖动预览与松手提交",
  args: {
    draft: outsideFrameFixture,
    onDraftChange: (draft) => { dragDraftChanges.push(draft); },
  },
  play: checkDragPreview,
};

export const EndStageDragPreview: Story = {
  name: "结束阶段独立提交拖动",
  args: {
    ...DragPreview.args,
    draft: updateUiSketchStageDraft(outsideFrameFixture, UI_SKETCH_END_STAGE_ID, outsideFrameFixture),
    activeStageId: UI_SKETCH_END_STAGE_ID,
  },
  play: checkDragPreview,
};

async function checkDragPreview({ canvasElement, args }: StoryContext): Promise<void> {
  dragDraftChanges.length = 0;
  await waitForCanvasRender();
  const scene = canvasElement.querySelector<SVGSVGElement>("[data-ui-sketch-scene]");
  if (!scene) throw new Error("缺少拖动测试画布");
  const nodes = Array.from(canvasElement.querySelectorAll<SVGGElement>("[data-ui-sketch-item]"));
  for (const [index, node] of nodes.entries()) {
    const initial = { x: Number(node.dataset.nodeX), y: Number(node.dataset.nodeY) };
    const initialScreen = node.getScreenCTM()!;
    const start = clientPointForWorld(scene, initial);
    const preview = clientPointForWorld(scene, { x: initial.x + 36, y: initial.y + 24 });
    const end = clientPointForWorld(scene, { x: initial.x + 48, y: initial.y + 30 });
    const pointerId = 100 + index;
    const changesBefore = dragDraftChanges.length;
    const untouched = nodes[(index + 1) % nodes.length]!;
    const untouchedScreen = untouched.getScreenCTM()!;
    let transformChanges = 0;
    const observer = new MutationObserver((records) => { transformChanges += records.length; });
    observer.observe(scene, { attributes: true, subtree: true, attributeFilter: ["transform"] });
    try {
      node.dispatchEvent(pointerEvent("pointerdown", { pointerId, ...start }));
      for (const fraction of [0.25, 0.5, 1]) {
        scene.dispatchEvent(pointerEvent("pointermove", {
          pointerId,
          clientX: start.clientX + (preview.clientX - start.clientX) * fraction,
          clientY: start.clientY + (preview.clientY - start.clientY) * fraction,
        }));
      }
      await waitForCanvasRender();
      if (dragDraftChanges.length !== changesBefore || Number(node.dataset.nodeX) !== initial.x) {
        throw new Error("拖动预览期间不得提交草稿或改变已提交坐标");
      }
      const previewScreen = node.getScreenCTM()!;
      if (
        Math.abs(previewScreen.e - initialScreen.e - preview.clientX + start.clientX) > 0.02
        || Math.abs(previewScreen.f - initialScreen.f - preview.clientY + start.clientY) > 0.02
        || transformChanges !== 1
      ) {
        throw new Error("同一帧的连续移动应只预览最后位置");
      }
      if (untouched.getScreenCTM()!.e !== untouchedScreen.e || untouched.getScreenCTM()!.f !== untouchedScreen.f) {
        throw new Error("未拖动节点不应产生位移");
      }
    } finally {
      observer.disconnect();
    }
    scene.dispatchEvent(pointerEvent("pointerup", { pointerId, ...end }));
    await waitForCanvasRender();
    if (
      dragDraftChanges.length !== changesBefore + 1
      || Number(node.dataset.nodeX) !== initial.x + 48
      || Number(node.dataset.nodeY) !== initial.y + 30
      || Math.abs(node.getScreenCTM()!.e - initialScreen.e - end.clientX + start.clientX) > 0.02
    ) {
      throw new Error("松手应只提交一次最终坐标，并清除临时位移");
    }

    for (const eventType of ["pointercancel", "lostpointercapture"]) {
      const committedScreen = node.getScreenCTM()!;
      node.dispatchEvent(pointerEvent("pointerdown", { pointerId, ...end }));
      scene.dispatchEvent(pointerEvent("pointermove", { pointerId, ...start }));
      if (eventType === "pointercancel") await waitForCanvasRender();
      scene.dispatchEvent(pointerEvent(eventType, { pointerId, ...start }));
      await waitForCanvasRender();
      if (
        dragDraftChanges.length !== changesBefore + 1
        || node.getScreenCTM()!.e !== committedScreen.e
        || node.getScreenCTM()!.f !== committedScreen.f
        || scene.hasAttribute("data-canvas-dragging")
      ) {
        throw new Error("取消或丢失指针捕获应清除已显示及待刷新的预览，不提交草稿");
      }
    }
  }
  if (args.activeStageId === UI_SKETCH_END_STAGE_ID) {
    const saved = dragDraftChanges.at(-1)!;
    if (
      saved.rectangles[0]!.x !== outsideFrameFixture.rectangles[0]!.x
      || saved.texts[0]!.x !== outsideFrameFixture.texts[0]!.x
      || saved.images[0]!.x !== outsideFrameFixture.images[0]!.x
    ) {
      throw new Error("结束阶段的拖动不能改动开始阶段位置");
    }
  }
}

export const NodesOutsideFrame: Story = {
  name: "范围外节点自由移动与提示词过滤",
  args: {
    draft: outsideFrameFixture,
    writePrompt: async (content) => { copiedPrompt = content; },
  },
  play: async ({ canvasElement }) => {
    await waitForCanvasRender();
    const scene = canvasElement.querySelector<SVGSVGElement>("[data-ui-sketch-scene]");
    if (!scene) throw new Error("缺少 UI 画布");
    const moves = [
      { key: "rectangle:rectangle-sidebar", x: -180, y: 0 },
      { key: "image:image-1", x: 300, y: 0 },
      { key: "text:text-title", x: 0, y: 240 },
    ];
    for (const [index, move] of moves.entries()) {
      const node = canvasElement.querySelector<SVGGElement>(`[data-ui-sketch-item="${move.key}"]`)!;
      const start = { x: Number(node.dataset.nodeX), y: Number(node.dataset.nodeY) };
      const end = { x: start.x + move.x, y: start.y + move.y };
      node.dispatchEvent(pointerEvent("pointerdown", { pointerId: 90 + index, ...clientPointForWorld(scene, start) }));
      scene.dispatchEvent(pointerEvent("pointermove", { pointerId: 90 + index, ...clientPointForWorld(scene, end) }));
      scene.dispatchEvent(pointerEvent("pointerup", { pointerId: 90 + index, ...clientPointForWorld(scene, end) }));
      await waitForCanvasRender();
      if (Math.abs(Number(node.dataset.nodeX) - end.x) > 0.01 || Math.abs(Number(node.dataset.nodeY) - end.y) > 0.01) {
        throw new Error("节点应能完整移到界面范围外");
      }
      node.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      await waitForCanvasRender();
      if (Math.abs(Number(node.dataset.nodeX) - end.x + 1) > 0.01) throw new Error("范围外节点应能继续用键盘移动");
    }
    findButton(canvasElement, "复制提示词").click();
    await waitForCanvasRender();
    if (copiedPrompt.includes("范围外") || copiedPrompt.includes("界面元素：")) throw new Error("完全在范围外的节点不应进入提示词");
    if (!copiedPrompt.includes(outsideFrameFixture.overallNote)) throw new Error("应保留全局要求");
    if (canvasElement.querySelectorAll("[data-ui-sketch-item]").length !== 3) throw new Error("范围外节点必须继续保留在画布");

    const node = canvasElement.querySelector<SVGGElement>('[data-ui-sketch-item="rectangle:rectangle-sidebar"]')!;
    const start = { x: Number(node.dataset.nodeX), y: Number(node.dataset.nodeY) };
    const end = { x: start.x + 140, y: start.y };
    node.dispatchEvent(pointerEvent("pointerdown", { pointerId: 94, ...clientPointForWorld(scene, start) }));
    scene.dispatchEvent(pointerEvent("pointermove", { pointerId: 94, ...clientPointForWorld(scene, end) }));
    scene.dispatchEvent(pointerEvent("pointerup", { pointerId: 94, ...clientPointForWorld(scene, end) }));
    await waitForCanvasRender();
    findButton(canvasElement, "复制提示词").click();
    await waitForCanvasRender();
    if (!copiedPrompt.includes("范围外区域") || copiedPrompt.includes("范围外图片") || copiedPrompt.includes("范围外文字")) {
      throw new Error("部分移回界面范围的节点应重新进入提示词");
    }
    assertStoryText(canvasElement, "界面范围 · 320 × 240");
  },
};

export const SeparateCopyActions: Story = {
  name: "未开启动效时直接复制",
  args: {
    draft: UI_SKETCH_FIXTURE,
    writePrompt: async (content) => {
      copiedPrompt = content;
    },
    writeSketch: async () => {
      sketchCopyTracker.count += 1;
      return "copied";
    },
  },
  play: async ({ canvasElement }: StoryContext) => {
    copiedPrompt = "";
    sketchCopyTracker.count = 0;
    const promptButton = findButton(canvasElement, "复制提示词");
    const sketchButton = findButton(canvasElement, "复制预览图");
    promptButton.click();
    await waitForCanvasRender();
    if (
      !copiedPrompt.startsWith("请根据以下信息设计并实现界面。")
      || copiedPrompt.includes("状态过渡")
      || findMenuItems("开始").length > 0
      || currentSketchCopyCount() !== 0
    ) {
      throw new Error("未开启动效时必须直接复制开始阶段提示词且不显示菜单");
    }
    sketchButton.click();
    await waitForCanvasRender();
    if (findMenuItems("开始").length > 0 || currentSketchCopyCount() !== 1) {
      throw new Error("未开启动效时必须直接复制开始阶段草图且不显示菜单");
    }
  },
};

export const TransientCopyNotice: Story = {
  name: "复制提醒自动消失",
  args: {
    draft: UI_SKETCH_FIXTURE,
    writePrompt: async () => undefined,
  },
  play: async ({ canvasElement }: StoryContext) => {
    findButton(canvasElement, "复制提示词").click();
    await waitForCanvasRender();
    assertStoryText(canvasElement, "复制成功");
    await new Promise((resolve) => window.setTimeout(resolve, 2_100));
    await waitForCanvasRender();
    if (canvasElement.textContent?.includes("复制成功")) {
      throw new Error("复制提示词成功提醒必须自动消失");
    }
  },
};

export const NarrowViewport: Story = {
  name: "最小桌面视口",
  args: { draft: UI_SKETCH_FIXTURE },
  parameters: { viewport: { defaultViewport: "desktopMinimum" } },
  play: ({ canvasElement }: StoryContext) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="human2ai/ui-sketch-canvas"]');
    assertStoryText(canvasElement, "复制提示词");
    assertStoryText(canvasElement, "复制预览图");
    assertStoryText(canvasElement, "界面范围 · 960 × 560");
  },
};

function ControlledUiSketchCanvas({
  draft: initialDraft,
  onDraftChange,
  ...props
}: UiSketchCanvasProps) {
  const [draft, setDraft] = useState(() => cloneUiSketchDraft(initialDraft));

  return (
    <UiSketchCanvas
      {...props}
      draft={draft}
      onDraftChange={(nextDraft) => {
        setDraft(nextDraft);
        onDraftChange?.(nextDraft);
      }}
    />
  );
}

function ExternalToolHostFixture(props: UiSketchCanvasProps) {
  const [toolHost, setToolHost] = useState<HTMLDivElement | null>(null);
  const [clearActionHost, setClearActionHost] = useState<HTMLDivElement | null>(null);
  return (
    <div style={{ display: "grid", height: "100vh", gridTemplateColumns: "1fr 320px" }}>
      <ControlledUiSketchCanvas
        {...props}
        toolHost={toolHost}
        clearActionHost={clearActionHost}
        showCanvasTools={false}
      />
      <aside style={{ padding: 20 }} aria-label="AppShellFrame 右侧栏">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2>操作工具</h2>
          <div ref={setClearActionHost} />
        </div>
        <div ref={setToolHost} />
      </aside>
    </div>
  );
}

function currentSketchCopyCount(): number {
  return sketchCopyTracker.count;
}

function textResizeSnapshot(node: SVGGElement, text: SVGTextElement) {
  const rect = text.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    nodeX: Number(node.dataset.nodeX),
    nodeY: Number(node.dataset.nodeY),
    fontSize: Number(text.getAttribute("font-size")),
  };
}

function findButton(canvasElement: HTMLElement, label: string): HTMLButtonElement {
  const button = findButtons(canvasElement, label)[0];
  if (!button) throw new Error(`找不到按钮：${label}`);
  return button;
}

function findButtons(canvasElement: HTMLElement, label: string): HTMLButtonElement[] {
  return Array.from(canvasElement.querySelectorAll<HTMLButtonElement>("button"))
    .filter((candidate) => (
      candidate.getAttribute("aria-label") === label
      || candidate.textContent?.replaceAll(" ", "").trim() === label.replaceAll(" ", "")
    ));
}

function findMenuItems(label: string): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    .filter((candidate) => candidate.textContent?.trim() === label);
}

function findMenuItem(label: string): HTMLElement {
  const item = findMenuItems(label).at(-1);
  if (!item) throw new Error(`找不到菜单项：${label}`);
  return item;
}

function setTextAreaValue(textarea: HTMLTextAreaElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  if (!valueSetter) throw new Error("浏览器缺少 textarea value setter");
  valueSetter.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!valueSetter) throw new Error("浏览器缺少 input value setter");
  valueSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function promptElementBlock(prompt: string, label: string, nextLabel: string): string {
  return prompt.split(`${label}\n`)[1]?.split(`\n\n${nextLabel}\n`)[0] ?? "";
}

function pointerEvent(
  type: string,
  options: PointerEventInit,
): PointerEvent {
  return new PointerEvent(type, { bubbles: true, button: 0, ...options });
}

function clientPointForWorld(
  scene: SVGSVGElement,
  point: { x: number; y: number },
): { clientX: number; clientY: number } {
  const rect = scene.getBoundingClientRect();
  const viewBox = scene.viewBox.baseVal;
  return {
    clientX: rect.left + ((point.x - viewBox.x) / viewBox.width) * rect.width,
    clientY: rect.top + ((point.y - viewBox.y) / viewBox.height) * rect.height,
  };
}

function waitForCanvasRender(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
