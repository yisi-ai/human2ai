import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { ModelSelector, type ModelSelectorMode, type ModelSelectorProps, type ModelSelectorValue } from "@human2ai/ui/yisiui";
import { assertStoryRole, assertStorySelector } from "../interactionChecks";

// Fixture names and capabilities describe this Story only, not commercial model specifications.
const levels = [{ key: "low", label: "低" }, { key: "medium", label: "中" }, { key: "high", label: "高" }];
const models = [
  { key: "alpha", label: "Alpha", reasoningLevels: levels },
  { key: "beta", label: "Beta", reasoningLevels: levels },
  { key: "gamma", label: "Gamma", reasoningLevels: levels },
  { key: "delta", label: "Delta", description: "通用模型", reasoningLevels: levels },
  { key: "fast", label: "Fast", description: "不提供推理档位" },
  { key: "unavailable", label: "Unavailable", disabled: true },
  { key: "extended", label: "Extended", reasoningLevels: levels },
  { key: "compact", label: "Compact", reasoningLevels: levels },
];
const modes: ModelSelectorMode[] = [
  { key: "agent", label: "AGENT", sources: [
    { key: "desktop", label: "桌面 Agent", models },
    { key: "remote", label: "远程 Agent", models: models.slice(0, 2) },
  ] },
  { key: "api", label: "API", sources: [
    { key: "service-a", label: "服务商 A", models },
    { key: "service-b", label: "服务商 B", models: [models[4]] },
  ] },
];
const initialValue: ModelSelectorValue = { modeKey: "agent", sourceKey: "desktop", modelKey: "alpha", reasoningKey: "medium" };

function ControlledSelector(props: ModelSelectorProps) {
  const [value, setValue] = useState(props.value);
  return <ModelSelector {...props} value={value} onChange={setValue} />;
}

const meta = {
  id: "modules-modelselector",
  title: "yisiui-Modules/ModelSelector",
  component: ModelSelector,
  parameters: { layout: "fullscreen" },
  // Give percentage max-width a bounded parent even in a narrow Storybook iframe.
  render: (args) => <div style={{ boxSizing: "border-box", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100dvh", padding: 16 }}>
    <ControlledSelector {...args} />
  </div>,
  args: { modes, value: initialValue, modeLayout: "vertical", onChange: () => undefined },
  argTypes: {
    modes: { control: "object", description: "调用方提供的模式、来源、型号及推理档位。" },
    value: { control: "object", description: "受控选择；回调给出一致的下一组 key。" },
    title: { control: "text", description: "可选标题 slot，null 隐藏。" },
    modeLayout: { control: "inline-radio", options: ["vertical", "horizontal"], description: "竖向位于内容左侧；横向位于标题右侧并等宽占满剩余空间。" },
    visibleModelCount: { control: { type: "number", min: 1, max: 6 }, description: "主区域最多展示的型号数量。" },
    disabled: { control: "boolean" },
    loading: { control: "boolean" },
    error: { control: "text" },
    labels: { control: false },
    onChange: { control: false },
  },
} satisfies Meta<typeof ModelSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "竖向模式、型号与推理选择",
  parameters: { docs: { description: { story: "切换推理档位时，轨道填充和圆点同步平滑过渡；圆点在悬停、按下和聚焦时保持 32px，不显示描边。键盘聚焦以当前档位文字的下划线提示。" } } },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/model-selector"]');
    assertStoryRole(canvasElement, "radiogroup");
    assertStoryRole(canvasElement, "slider");
    assertStorySelector(canvasElement, 'button[aria-label="更多模型"]');
  },
};

export const Horizontal: Story = {
  name: "横向模式与标题同行",
  args: { modeLayout: "horizontal" },
  play: ({ canvasElement }) => {
    const header = canvasElement.querySelector<HTMLElement>(".yisi-model-selector-header")!;
    const title = header.querySelector<HTMLElement>(".yisi-model-selector-title")!.getBoundingClientRect();
    const group = header.querySelector<HTMLElement>('[role="radiogroup"][aria-orientation="horizontal"]')!;
    const rows = Array.from(group.children, (element) => element.getBoundingClientRect());
    const groupRect = group.getBoundingClientRect();
    const content = canvasElement.querySelector<HTMLElement>(".yisi-model-selector-content")!.getBoundingClientRect();
    const root = canvasElement.querySelector<HTMLElement>(".yisi-model-selector")!.getBoundingClientRect();
    if (root.left < 0 || root.right > canvasElement.ownerDocument.documentElement.clientWidth) {
      throw new Error("The horizontal preview must fit the available viewport width");
    }
    if (title.right >= groupRect.left || Math.abs(title.top + title.height / 2 - groupRect.top - groupRect.height / 2) > 1 ||
      Math.abs(rows[0].width - rows[1].width) > 1 || Math.abs(rows[0].top - rows[1].top) > 1 ||
      Math.abs(groupRect.right - content.right) > 1 || Math.abs(header.getBoundingClientRect().left - content.left) > 1) {
      throw new Error("Horizontal modes must share the title row, divide the remaining space equally and leave full-width content below");
    }
  },
};

export const HighestReasoning: Story = {
  name: "最高推理强度与星点闪烁",
  args: { value: { ...initialValue, reasoningKey: "high" } },
  parameters: { docs: { description: { story: "可从最高档切换至其他档位查看过渡，再切回最高档并点击组件空白区域：滑块和星点区域不显示文本插入光标。" } } },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '.yisi-model-selector-stars[aria-hidden="true"]');
    assertStorySelector(canvasElement, '[role="slider"][aria-valuetext="高"]');
  },
};

type ExpectedPlacement = "left" | "up" | "left-up" | "stacked";

async function waitForMenuPlacement(canvasElement: HTMLElement, expected: ExpectedPlacement) {
    const doc = canvasElement.ownerDocument;
    for (let i = 0; i < 90; i += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const menu = doc.querySelector<HTMLElement>('[role="menu"][aria-label="模型型号"]');
      const content = canvasElement.querySelector<HTMLElement>(".yisi-model-selector-body");
      if (!menu || !content) continue;
      const menuRect = menu.closest(".ant-dropdown")!.getBoundingClientRect();
      const anchorRect = content.getBoundingClientRect();
      const inside = menuRect.height > 0 && menuRect.top >= 0 && menuRect.left >= 0 &&
        menuRect.bottom <= (doc.defaultView?.innerHeight ?? 0) && menuRect.right <= (doc.defaultView?.innerWidth ?? 0);
      const left = menuRect.right < anchorRect.left;
      const up = menuRect.top < anchorRect.top && Math.abs(menuRect.bottom - anchorRect.bottom) < 1;
      const stacked = menuRect.top >= anchorRect.bottom - 1 || menuRect.bottom <= anchorRect.top + 1;
      const sideFits = Math.max(anchorRect.left, (doc.defaultView?.innerWidth ?? 0) - anchorRect.right) >= menuRect.width + 8;
      const verticalFits = Math.max(anchorRect.top, (doc.defaultView?.innerHeight ?? 0) - anchorRect.bottom) >= menuRect.height;
      // The same boundary Stories also remain valid in a narrow/short preview.
      const directionMatches = !sideFits || expected === "stacked" ? stacked || !verticalFits
        : expected === "left" ? left : expected === "up" ? up : left && up;
      if (inside && directionMatches) return;
    }
    throw new Error(`Model menu must use ${expected} placement and stay inside the viewport`);
}

function assertMenuPlacement(expected: ExpectedPlacement): NonNullable<Story["play"]> {
  return async ({ canvasElement }) => {
    const button = canvasElement.querySelector<HTMLButtonElement>('button[aria-label="更多模型"]');
    if (!button) throw new Error("Missing model menu trigger");
    button.click();
    await waitForMenuPlacement(canvasElement, expected);
  };
}

export const OpensUpward: Story = {
  name: "下方空间不足时向上展开",
  parameters: { layout: "fullscreen" },
  render: (args) => <div style={{ height: "100dvh", boxSizing: "border-box", display: "flex", alignItems: "flex-end", padding: 24 }}>
    <ControlledSelector {...args} />
  </div>,
  play: assertMenuPlacement("up"),
};

export const OpensLeftward: Story = {
  name: "右侧空间不足时向左展开",
  parameters: { layout: "fullscreen" },
  render: (args) => <div style={{ display: "flex", justifyContent: "flex-end", padding: 24 }}>
    <ControlledSelector {...args} />
  </div>,
  play: async (context) => {
    await assertMenuPlacement("left")(context);
    const root = context.canvasElement.querySelector<HTMLElement>(".yisi-model-selector")!;
    const previousWidth = root.style.width;
    const focused = context.canvasElement.ownerDocument.activeElement;
    try {
      root.style.width = "100%";
      await waitForMenuPlacement(context.canvasElement, "stacked");
    } finally {
      root.style.width = previousWidth;
    }
    await waitForMenuPlacement(context.canvasElement, "left");
    if (context.canvasElement.ownerDocument.activeElement !== focused) {
      throw new Error("Resizing an open menu must preserve keyboard focus");
    }
  },
};

export const OpensUpperLeft: Story = {
  name: "右下角空间不足时向左上展开",
  args: { modeLayout: "horizontal" },
  parameters: { layout: "fullscreen" },
  render: (args) => <div style={{ height: "100dvh", boxSizing: "border-box", display: "flex", justifyContent: "flex-end", alignItems: "flex-end", padding: 24 }}>
    <ControlledSelector {...args} />
  </div>,
  play: assertMenuPlacement("left-up"),
};

export const ConstrainedWidth: Story = {
  name: "两侧空间不足时在上下方展开",
  args: { modeLayout: "horizontal", style: { width: "100%" } },
  parameters: { layout: "fullscreen" },
  render: (args) => <div style={{ padding: 12 }}><ControlledSelector {...args} /></div>,
  play: assertMenuPlacement("stacked"),
};

export const SingleSource: Story = {
  name: "单一来源与少量型号",
  args: { modes: modes.map((mode) => ({ ...mode, sources: [{ ...mode.sources[0], models: models.slice(0, 2) }] })) },
};

export const NoReasoning: Story = {
  name: "不支持推理强度",
  args: { value: { modeKey: "agent", sourceKey: "desktop", modelKey: "fast" } },
};

export const LongContent: Story = {
  name: "长型号名称与滚动列表",
  args: { modes: [{ key: "agent", label: "AGENT", sources: [{ key: "desktop", label: "桌面 Agent",
    models: Array.from({ length: 24 }, (_, index) => ({ key: `model-${index}`, label: `模型 ${index + 1} · 长名称研究预览版本`, reasoningLevels: levels })),
  }] }], value: { modeKey: "agent", sourceKey: "desktop", modelKey: "model-0", reasoningKey: "medium" } },
};

export const Disabled: Story = { name: "整体禁用", args: { disabled: true } };
export const Loading: Story = { name: "加载状态", args: { loading: true } };
export const Empty: Story = { name: "没有可用模型", args: { modes: [], value: null } };
export const ErrorState: Story = { name: "错误提示", args: { error: "模型列表加载失败，请稍后重试。" } };
