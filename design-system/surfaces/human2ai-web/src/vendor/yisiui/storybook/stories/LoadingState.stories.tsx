import type { Meta, StoryObj } from "@storybook/react-webpack5";

import { LoadingState } from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

const meta = {
  id: "components-states-loadingstate",
  title: "yisiui-Components/States/LoadingState",
  component: LoadingState,
  parameters: { layout: "padded" },
  argTypes: {
    label: { control: "text" },
    rows: { control: { type: "number", min: 1, max: 12, step: 1 } },
    compact: { control: "boolean" },
    motion: { control: "radio", options: ["auto", "none"] },
    className: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof LoadingState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "默认加载边界",
  args: {
    label: "正在加载内容",
    rows: 5,
  },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/loading-state"]');
    assertStorySelector(canvasElement, '[aria-busy="true"][aria-label="正在加载内容"]');
    assertStoryText(canvasElement, "正在加载内容");
    if (canvasElement.querySelectorAll(".ant-skeleton-paragraph > li").length !== 5) {
      throw new Error("LoadingState 应呈现调用方指定的五行骨架");
    }
  },
};

export const Compact: Story = {
  name: "紧凑加载边界",
  args: {
    label: "正在加载面板",
    rows: 2,
    compact: true,
  },
};

export const ReducedMotion: Story = {
  name: "关闭动效",
  args: {
    label: "正在加载静态内容",
    rows: 4,
    motion: "none",
  },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-motion="none"]');
    if (canvasElement.querySelector(".ant-skeleton-active")) {
      throw new Error("motion=none 时不应启用 Skeleton 动画");
    }
  },
};

export const RowBoundary: Story = {
  name: "骨架行数边界",
  args: {
    label: "正在加载边界示例",
    rows: 99,
  },
  play: ({ canvasElement }) => {
    if (canvasElement.querySelectorAll(".ant-skeleton-paragraph > li").length !== 12) {
      throw new Error("LoadingState 应把骨架行数限制在十二行以内");
    }
  },
};
