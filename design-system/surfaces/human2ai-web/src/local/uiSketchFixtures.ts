import type { UiSketchDraft } from "./uiSketchDraft.ts";

export const UI_SKETCH_FIXTURE: UiSketchDraft = {
  version: 1,
  kind: "ui-layout-draft",
  groups: [],
  frame: { x: 0, y: 0, width: 960, height: 560 },
  overallNote: "保持界面安静，把当前任务和主要操作放在视觉中心。",
  rectangles: [
    {
      id: "rectangle-sidebar",
      x: 40,
      y: 52,
      width: 216,
      height: 456,
      note: "项目与会话导航",
      annotation: "保持导航层级清晰",
      semanticType: "导航区域",
      origin: "user",
      visible: true,
      weight: "medium",
    },
    {
      id: "rectangle-summary",
      x: 304,
      y: 132,
      width: 600,
      height: 176,
      note: "当前任务摘要和运行状态",
      annotation: "状态需要优先被识别",
      semanticType: "状态区域",
      origin: "agent",
      visible: true,
      weight: "high",
    },
    {
      id: "rectangle-action",
      x: 650,
      y: 396,
      width: 254,
      height: 72,
      note: "进入任务详情的主要操作",
      annotation: "主要操作与摘要保持邻近",
      semanticType: "操作区域",
      origin: "import",
      visible: true,
      weight: "high",
    },
  ],
  images: [],
  texts: [
    {
      id: "text-title",
      x: 304,
      y: 64,
      text: "运行概览",
      fontSize: 32,
      note: "页面主标题",
      annotation: "标题层级最高",
      semanticType: "标题",
      origin: "import",
      visible: true,
      weight: "high",
    },
    {
      id: "text-supporting",
      x: 304,
      y: 332,
      text: "最近更新于 2 分钟前",
      fontSize: 16,
      note: "更新时间说明",
      annotation: "使用次要文字颜色",
      semanticType: "辅助说明",
      origin: "user",
      visible: true,
      weight: "low",
    },
  ],
  stages: [],
};

export const LONG_UI_SKETCH_FIXTURE: UiSketchDraft = {
  ...UI_SKETCH_FIXTURE,
  rectangles: UI_SKETCH_FIXTURE.rectangles.map((rectangle, index) => (
    index === 1
      ? {
          ...rectangle,
          note: "这里用于表达一段很长的区域备注\n第二行只表示内容层级和大致占位，不代表最终组件结构",
        }
      : { ...rectangle }
  )),
  texts: UI_SKETCH_FIXTURE.texts.map((text, index) => (
    index === 0
      ? {
          ...text,
          text: "这是一个需要保留用户手动换行的长标题\n第二行继续说明当前界面的主要目的",
          fontSize: 26,
        }
      : { ...text }
  )),
};
