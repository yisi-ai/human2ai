import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Flex, Typography } from "antd";

import {
  TEXT_SHINE_SPEEDS,
  TextShine,
  type TextShineSpeed,
} from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

const SPEED_LABELS: Readonly<Record<TextShineSpeed, string>> = {
  slow: "慢速 · 57.6 px/s",
  medium: "中速 · 96 px/s",
  fast: "快速 · 153.6 px/s",
};

const meta = {
  id: "motion-textshine",
  title: "Components/Motion/TextShine",
  component: TextShine,
  parameters: { layout: "padded" },
  argTypes: {
    children: { control: "text", description: "附加扫光的纯文字内容。" },
    active: { control: "boolean", description: "是否显示并运行文字扫光。" },
    color: { control: "color", description: "光带颜色；默认使用白光 Token。" },
    speed: { control: "radio", options: TEXT_SHINE_SPEEDS, description: "复用通用文字动效的慢、中、快三档速度 Token；默认 medium。" },
    className: { control: false },
    style: { control: false },
  },
  render: (args) => (
    <div
      style={{
        display: "inline-flex",
        color: "var(--yisiui-color-text-primary)",
        fontSize: 22,
        fontWeight: 600,
      }}
    >
      <TextShine {...args} />
    </div>
  ),
} satisfies Meta<typeof TextShine>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "默认连续倾斜宽光带",
  args: {
    children: "AI 待确认",
    active: true,
  },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/text-shine"]');
    assertStorySelector(canvasElement, ".yisi-text-shine-base");
    assertStorySelector(canvasElement, '.yisi-text-shine-overlay[aria-hidden="true"]');
    assertStoryText(canvasElement, "AI 待确认");
    const root = canvasElement.querySelector<HTMLElement>('[data-yisiui-asset="yisiui/text-shine"]');
    if (root?.dataset.whTextShineSpeed !== "medium" || root.dataset.whTextShineVelocity !== "96") {
      throw new Error("TextShine must default to the medium 96 px/s preset.");
    }
    if (root?.style.getPropertyValue("--yisiui-text-shine-color")) {
      throw new Error("Default TextShine must inherit its white light color from the component Token.");
    }
  },
};

export const CustomColor: Story = {
  name: "自定义光色",
  args: {
    children: "正在整理关键语境",
    active: true,
    color: "#69B1FF",
  },
  play: ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-yisiui-asset="yisiui/text-shine"]');
    if (root?.style.getPropertyValue("--yisiui-text-shine-color") !== "#69B1FF") {
      throw new Error("TextShine custom color must be bound to its local light-color variable.");
    }
  },
};

export const FixedVelocity: Story = {
  name: "中档速度与不同长度",
  render: () => (
    <Flex vertical gap={24} style={{ maxWidth: 680 }}>
      <Typography.Text type="secondary">
        三段文字完成时间不同，但默认都以中档 96 CSS px/s 移动。
      </Typography.Text>
      {[
        "待确认",
        "AI 已补充关键语境，等待确认",
        "更长的文字会增加光带真实移动距离，因此扫光完成时间自然延长",
      ].map((text) => (
        <div
          key={text}
          style={{
            width: "fit-content",
            color: "var(--yisiui-color-text-primary)",
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          <TextShine>{text}</TextShine>
        </div>
      ))}
    </Flex>
  ),
  play: ({ canvasElement }) => {
    const effects = canvasElement.querySelectorAll<HTMLElement>('[data-yisiui-asset="yisiui/text-shine"]');
    if (effects.length !== 3) {
      throw new Error("TextShine velocity Story must render three text lengths.");
    }
    effects.forEach((effect) => {
      if (effect.dataset.whTextShineVelocity !== "96") {
        throw new Error("Every default TextShine instance must use the medium preset.");
      }
    });
  },
};

export const SpeedPresets: Story = {
  name: "慢中快三档",
  render: () => (
    <Flex vertical gap={24} style={{ maxWidth: 680 }}>
      <Typography.Text type="secondary">
        三档只改变光带移动速度；文字、光色和透明背景保持一致。
      </Typography.Text>
      {TEXT_SHINE_SPEEDS.map((speed) => (
        <Flex key={speed} vertical gap={6}>
          <Typography.Text type="secondary">{SPEED_LABELS[speed]}</Typography.Text>
          <div
            style={{
              width: "fit-content",
              color: "var(--yisiui-color-text-primary)",
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            <TextShine speed={speed}>AI 已补充关键语境，等待确认</TextShine>
          </div>
        </Flex>
      ))}
    </Flex>
  ),
  play: ({ canvasElement }) => {
    const effects = Array.from(
      canvasElement.querySelectorAll<HTMLElement>('[data-yisiui-asset="yisiui/text-shine"]'),
    );
    const expected = [
      ["slow", "57.6"],
      ["medium", "96"],
      ["fast", "153.6"],
    ];
    if (effects.length !== expected.length) {
      throw new Error("TextShine speed Story must render all three presets.");
    }
    effects.forEach((effect, index) => {
      const [speed, velocity] = expected[index];
      if (
        effect.dataset.whTextShineSpeed !== speed
        || effect.dataset.whTextShineVelocity !== velocity
      ) {
        throw new Error(`TextShine preset ${speed} must resolve to ${velocity} px/s.`);
      }
    });
  },
};

export const Inactive: Story = {
  name: "关闭动效",
  args: {
    children: "普通文字",
    active: false,
  },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, ".yisi-text-shine-inactive");
    if (canvasElement.querySelector(".yisi-text-shine-overlay")) {
      throw new Error("Inactive TextShine must not render a visual overlay.");
    }
  },
};
