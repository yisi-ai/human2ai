import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Space, Typography } from "antd";

import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { StatusCard } from "@human2ai/ui/yisiui/status-card";

function ProjectOverview() {
  return (
    <main style={{ minHeight: "100vh", padding: 40, background: "var(--yisiui-color-background-canvas)" }}>
      <Space direction="vertical" size={20}>
        <Typography.Title level={1}>human2ai UI</Typography.Title>
        <Typography.Paragraph>项目本地组件的 Stories 放在 design-system/surfaces/human2ai-web/src/local，YisiUI Stories 由源码同步只读维护。</Typography.Paragraph>
        <StatusCard title="Storybook ready" subtitle="Shared and product-local UI render in one workspace." />
        <BasicButton>开始编写本地 Story</BasicButton>
      </Space>
    </main>
  );
}

const meta = { title: "human2ai/Overview", component: ProjectOverview } satisfies Meta<typeof ProjectOverview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
