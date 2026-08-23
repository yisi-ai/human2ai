import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Flex, Typography } from "antd";

import {
  NumberBadge,
  type NumberBadgeProps,
} from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

const meta = {
  id: "numbers-numberbadge",
  title: "Components/Numbers/NumberBadge",
  component: NumberBadge,
  parameters: { layout: "padded" },
  argTypes: {
    value: {
      control: { type: "number", min: 1, max: 99, step: 1 },
      description: "显示数字；小于 1 显示 1，大于 99 显示 99。",
    },
    size: {
      control: { type: "number", min: 1, step: 1 },
      description: "圆形外框的固定宽高，单位为 px。",
    },
    className: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof NumberBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

const FIXED_SIZE_VALUES: NumberBadgeProps[] = [
  { value: 1, size: 32 },
  { value: 8, size: 32 },
  { value: 99, size: 32 },
];

export const Default: Story = {
  name: "固定尺寸数字",
  render: () => (
    <Flex align="center" gap={16}>
      {FIXED_SIZE_VALUES.map((props) => (
        <NumberBadge key={props.value} {...props} />
      ))}
    </Flex>
  ),
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/number-badge"]');
    assertStoryText(canvasElement, "1");
    assertStoryText(canvasElement, "8");
    assertStoryText(canvasElement, "99");

    const badges = canvasElement.querySelectorAll<HTMLElement>('[data-yisiui-asset="yisiui/number-badge"]');
    if (badges.length !== FIXED_SIZE_VALUES.length) {
      throw new Error("NumberBadge story should render three fixed-size examples");
    }
    if (badges[0].style.width !== badges[2].style.width || badges[0].style.height !== badges[2].style.height) {
      throw new Error("NumberBadge outer size must not depend on the number of digits");
    }
  },
};

export const ConfigurableSize: Story = {
  name: "可配置尺寸",
  render: () => (
    <Flex align="center" gap={16}>
      {[24, 32, 40].map((size) => (
        <Flex key={size} vertical align="center" gap={4}>
          <NumberBadge value={8} size={size} />
          <Typography.Text type="secondary">{size}px</Typography.Text>
        </Flex>
      ))}
    </Flex>
  ),
};

export const Bounds: Story = {
  name: "数字边界",
  render: () => (
    <Flex align="center" gap={16}>
      <Flex vertical align="center" gap={4}>
        <NumberBadge value={0} size={32} />
        <Typography.Text type="secondary">最小显示 1</Typography.Text>
      </Flex>
      <Flex vertical align="center" gap={4}>
        <NumberBadge value={120} size={32} />
        <Typography.Text type="secondary">最大显示 99</Typography.Text>
      </Flex>
    </Flex>
  ),
  play: ({ canvasElement }) => {
    assertStoryText(canvasElement, "最小显示 1");
    assertStoryText(canvasElement, "最大显示 99");
    const badges = canvasElement.querySelectorAll<HTMLElement>('[data-yisiui-asset="yisiui/number-badge"]');
    if (badges[0]?.textContent !== "1" || badges[1]?.textContent !== "99") {
      throw new Error("NumberBadge must clamp values to the inclusive 1–99 range");
    }
  },
};
