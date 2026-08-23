import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Flex, Typography } from "antd";

import { StatusBadge } from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

const meta = { title: "Components/States/StatusBadge", component: StatusBadge } satisfies Meta<typeof StatusBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "默认",
  render: () => (
    <Flex gap={16} wrap align="flex-start">
      <Flex vertical gap={4} align="center">
        <Typography.Text type="secondary">Icon + 文字</Typography.Text>
        <StatusBadge label="运行中" tone="processing" mode="icon-text" />
      </Flex>
      <Flex vertical gap={4} align="center">
        <Typography.Text type="secondary">纯文字</Typography.Text>
        <StatusBadge label="运行中" tone="processing" mode="text-only" />
      </Flex>
      <Flex vertical gap={4} align="center">
        <Typography.Text type="secondary">纯 Icon</Typography.Text>
        <StatusBadge label="运行中" tone="processing" mode="icon-only" />
      </Flex>
    </Flex>
  ),
  play: ({ canvasElement }) => {
    assertStoryText(canvasElement, "Icon + 文字");
    assertStoryText(canvasElement, "纯文字");
    assertStoryText(canvasElement, "纯 Icon");
    assertStorySelector(canvasElement, ".yisi-status-badge-icon-only");
  },
};

export const Info: Story = { name: "信息状态", args: { label: "等待审核", tone: "info" } };

export const Success: Story = { name: "成功状态", args: {
  label: "资料已就绪",
  tone: "success",
  tooltip: null
} };

export const Warning: Story = { name: "警告状态", args: { label: "需要补充输入", tone: "warning" } };

export const Danger: Story = { name: "失败状态", args: { label: "运行失败", tone: "danger" } };

export const Processing: Story = { name: "处理中", args: { label: "正在生成草稿", tone: "processing" } };

export const LongLabel: Story = {
  name: "超长状态文字",
  args: { label: "等待完成前置资料配置后才能继续运行", tone: "warning" },
};
