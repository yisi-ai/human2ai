import type { Meta, StoryObj } from "@storybook/react-webpack5";

import {
  UnderlineTabSwitch,
  type UnderlineTabSwitchProps,
} from "@human2ai/ui/yisiui";
import { assertStoryRole, assertStorySelector, assertStoryText } from "../interactionChecks";

const meta = {
  id: "switching-underlinetabswitch",
  title: "Components/Switching/UnderlineTabSwitch",
  component: UnderlineTabSwitch,
  parameters: { layout: "padded" },
  argTypes: {
    items: { control: "object", description: "至少两个等分 tab 项，可配置 disabled。" },
    activeColor: { control: "text", description: "选中 tab 的文字和底部线条颜色。" },
    value: { control: "text", description: "受控选中项 key。" },
    defaultValue: { control: "text", description: "非受控模式的初始选中项 key。" },
    "aria-label": { control: "text", description: "切换组的无障碍名称。" },
    onChange: { control: false },
    className: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof UnderlineTabSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

const REFERENCE_ITEMS = [
  { key: "components", label: "组件" },
  { key: "copy", label: "文案" },
  { key: "resources", label: "资源" },
  { key: "compatibility", label: "兼容" },
  { key: "versions", label: "版本" },
] satisfies UnderlineTabSwitchProps["items"];

export const Default: Story = {
  name: "等分下划线切换",
  args: {
    "aria-label": "HTML 编排工具",
    items: REFERENCE_ITEMS,
    defaultValue: "components",
  },
  play: ({ canvasElement }) => {
    assertStoryRole(canvasElement, "tablist");
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/underline-tab-switch"]');
    assertStoryText(canvasElement, "兼容");
    assertStorySelector(canvasElement, '[role="tab"][data-tab-key="components"][aria-selected="true"]');

    const copyTab = canvasElement.querySelector<HTMLButtonElement>(
      '[role="tab"][data-tab-key="copy"]',
    );
    if (!copyTab) {
      throw new Error("Story interaction contract missing copy tab");
    }
    copyTab.click();
    assertStorySelector(canvasElement, '[role="tab"][data-tab-key="copy"][aria-selected="true"]');
  },
};

export const CustomActiveColor: Story = {
  name: "可配置选中颜色",
  args: {
    "aria-label": "内容区域",
    items: REFERENCE_ITEMS.slice(0, 3) as UnderlineTabSwitchProps["items"],
    defaultValue: "copy",
    activeColor: "var(--yisiui-color-feedback-success)",
  },
};

export const DisabledItem: Story = {
  name: "禁用项和长标签",
  args: {
    "aria-label": "编排状态",
    items: [
      { key: "ready", label: "已准备" },
      { key: "compatibility", label: "兼容检查中", disabled: true },
      { key: "version", label: "发布版本历史记录" },
    ],
    defaultValue: "ready",
  },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[role="tab"][data-tab-key="compatibility"][disabled]');
  },
};
