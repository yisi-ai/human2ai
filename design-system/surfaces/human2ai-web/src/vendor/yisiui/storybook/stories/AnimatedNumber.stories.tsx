import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Button, Flex, Typography } from "antd";

import { AnimatedNumber } from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

const meta = {
  id: "numbers-animatednumber",
  title: "Components/Numbers/AnimatedNumber",
  component: AnimatedNumber,
  parameters: { layout: "padded" },
  argTypes: {
    value: { control: { type: "number" }, description: "当前数字值。" },
    unit: { control: "text", description: "数字后的文字单位。" },
    fontSize: { control: "text", description: "数字字号，可填写数字（px）或 CSS 尺寸。" },
    color: { control: "text", description: "数字颜色，可使用 Surface CSS Token。" },
    fontWeight: {
      control: "select",
      options: [400, 500, 600, 700],
      description: "数字字重。",
    },
    precision: { control: { type: "number", min: 0, max: 20, step: 1 }, description: "固定小数位数。" },
    duration: { control: { type: "number", min: 0, step: 10 }, description: "个位的基础动画时长，单位为 ms。高位逐级增加。" },
    motion: { control: "radio", options: ["auto", "always", "none"] },
    className: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof AnimatedNumber>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "默认数字与单位",
  args: {
    value: 1286,
    unit: "篇",
    fontSize: 32,
    color: "var(--yisiui-color-brand-primary)",
    fontWeight: 700,
  },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/animated-number"]');
    assertStorySelector(canvasElement, ".yisi-animated-number-digit");
    assertStoryText(canvasElement, "1286篇");
  },
};

function DynamicFixture() {
  const [value, setValue] = useState(1286);

  return (
    <Flex vertical gap={16} align="flex-start">
      <AnimatedNumber value={value} unit="篇" fontSize={36} fontWeight={700} aria-live="polite" />
      <Button
        data-testid="animated-number-update"
        onClick={() => setValue((currentValue) => (currentValue === 1286 ? 1329 : 1286))}
      >
        模拟数字变化
      </Button>
    </Flex>
  );
}

export const Dynamic: Story = {
  name: "逐位动态变化",
  render: () => <DynamicFixture />,
  play: async ({ canvasElement }) => {
    const updateButton = canvasElement.querySelector<HTMLButtonElement>(
      '[data-testid="animated-number-update"]',
    );
    if (!updateButton) {
      throw new Error("AnimatedNumber dynamic story is missing its update control");
    }
    updateButton.click();
    await new Promise((resolve) => window.setTimeout(resolve, 40));
    assertStoryText(canvasElement, "1329篇");
  },
};

export const TypographyControls: Story = {
  name: "字号、颜色与字重",
  render: () => (
    <Flex vertical gap={16}>
      <Flex align="baseline" gap={12}>
        <AnimatedNumber
          value={1286}
          unit="篇"
          fontSize={24}
          color="var(--yisiui-color-text-primary)"
          fontWeight={500}
        />
        <Typography.Text type="secondary">24px / 500</Typography.Text>
      </Flex>
      <Flex align="baseline" gap={12}>
        <AnimatedNumber
          value={1286}
          unit="篇"
          fontSize={32}
          color="var(--yisiui-color-brand-primary)"
          fontWeight={700}
        />
        <Typography.Text type="secondary">32px / 700</Typography.Text>
      </Flex>
    </Flex>
  ),
};

export const PrecisionAndReducedMotion: Story = {
  name: "小数与关闭动画",
  render: () => (
    <Flex vertical gap={16}>
      <AnimatedNumber value={98.6} precision={1} unit="%" fontSize={32} />
      <AnimatedNumber value={-12} unit="°C" fontSize={28} motion="none" />
    </Flex>
  ),
};
