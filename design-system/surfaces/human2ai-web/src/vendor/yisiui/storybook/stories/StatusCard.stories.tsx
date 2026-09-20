import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Flex } from "antd";

import { StatusCard } from "@human2ai/ui/yisiui";
import { STATUS_LIGHT_COLORS } from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

const meta = {
  id: "cards-statuscard",
  title: "yisiui-Components/Cards/StatusCard",
  component: StatusCard,
  parameters: { layout: "padded" },
  argTypes: {
    title: { control: "text", description: "左上角的粗体标题。" },
    subtitle: { control: "text", description: "左下角的小号浅色说明。" },
    state: {
      control: "radio",
      options: ["idle", "running"],
      description: "running 时暴露 aria-busy=true，并按卡片实际尺寸叠加边框扫光。",
    },
    statusLightColor: {
      control: "radio",
      options: STATUS_LIGHT_COLORS,
      description: "右侧 StatusLight 当前亮起的灯。",
    },
    statusLightMotion: {
      control: "radio",
      options: ["steady", "blink"],
      description: "右侧 StatusLight 常亮或闪烁。",
    },
    className: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof StatusCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "普通状态卡片",
  args: {
    title: "写作 Agent",
    subtitle: "等待开始任务",
    state: "idle",
    statusLightColor: "green",
    statusLightMotion: "steady",
  },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/status-card"]');
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/status-light"]');
    assertStoryText(canvasElement, "写作 Agent");
    assertStoryText(canvasElement, "等待开始任务");
    if (canvasElement.querySelector(".yisi-border-scan")) {
      throw new Error("Idle StatusCard must not render a border scan.");
    }
  },
};

export const Running: Story = {
  name: "运行中",
  args: {
    title: "内容分析任务",
    subtitle: "正在读取参考资料",
    state: "running",
    statusLightColor: "yellow",
    statusLightMotion: "blink",
  },
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, ".yisi-status-card-state-running");
    assertStorySelector(canvasElement, ".yisi-status-light-motion-blink");
    await waitForStorySelector(canvasElement, ".yisi-status-card-border-scan");
    const card = canvasElement.querySelector<HTMLElement>('[data-yisiui-asset="yisiui/status-card"]');
    if (card?.getAttribute("aria-busy") !== "true") {
      throw new Error("Running StatusCard should expose aria-busy=true");
    }
    const scan = card?.querySelector<HTMLElement>(".yisi-status-card-border-scan");
    if (!scan || scan.getAttribute("aria-hidden") !== "true") {
      throw new Error("Running StatusCard should render an aria-hidden border scan.");
    }
    const width = Number.parseFloat(scan.style.width);
    const height = Number.parseFloat(scan.style.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error("StatusCard border scan must use the card's measured dimensions.");
    }
    const overlay = scan.querySelector("svg");
    if (overlay?.getAttribute("viewBox") !== `0 0 ${width} ${height}`) {
      throw new Error("StatusCard border scan SVG must match the measured card dimensions.");
    }
    if (scan.querySelectorAll(".yisi-border-scan-line").length !== 1) {
      throw new Error("Running StatusCard should render one visible border scan line.");
    }
  },
};

export const Interactive: Story = {
  name: "可点击状态卡片",
  args: {
    title: "打开执行详情",
    subtitle: "鼠标悬停查看交互反馈",
    state: "idle",
    statusLightColor: "green",
    statusLightMotion: "steady",
    role: "button",
    tabIndex: 0,
    onClick: () => undefined,
  },
  play: ({ canvasElement }) => {
    const card = canvasElement.querySelector<HTMLElement>('[data-yisiui-asset="yisiui/status-card"]');
    if (!card?.classList.contains("yisi-status-card-interactive")) {
      throw new Error("StatusCard with onClick should expose the interactive class.");
    }
    if (getComputedStyle(card).cursor !== "pointer") {
      throw new Error("Interactive StatusCard should use a pointer cursor.");
    }
  },
};

export const Variants: Story = {
  name: "状态灯配置",
  render: () => (
    <Flex vertical gap={12} style={{ maxWidth: 420 }}>
      <StatusCard title="服务已就绪" subtitle="稳定运行" statusLightColor="green" />
      <StatusCard
        title="等待人工确认"
        subtitle="黄灯闪烁提示"
        statusLightColor="yellow"
        statusLightMotion="blink"
      />
      <StatusCard
        title="任务失败"
        subtitle="请检查输入后重试"
        statusLightColor="red"
      />
    </Flex>
  ),
  play: ({ canvasElement }) => {
    const cards = canvasElement.querySelectorAll('[data-yisiui-asset="yisiui/status-card"]');
    if (cards.length !== 3) {
      throw new Error("StatusCard variants story should render three cards");
    }
    assertStorySelector(canvasElement, ".yisi-status-light-lamp-red.yisi-status-light-lamp-active");
  },
};

async function waitForStorySelector(root: HTMLElement, selector: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (root.querySelector(selector)) {
      return;
    }
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }
  throw new Error(`Story interaction contract missing selector: ${selector}`);
}
