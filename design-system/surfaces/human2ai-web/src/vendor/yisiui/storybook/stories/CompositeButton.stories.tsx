import {
  CopyOutlined,
  DatabaseOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  MoreOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type { Meta, StoryObj } from "@storybook/react-webpack5";

import { CompositeButton } from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

const meta = {
  id: "buttons-compositebutton",
  title: "Components/Buttons/CompositeButton",
  component: CompositeButton,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CompositeButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "四行复合按钮",
  render: () => (
    <div className="yisi-composite-button-story-list">
      <CompositeButton
        icon={<FileTextOutlined />}
        label="文章列表"
        onClick={() => undefined}
      />
      <CompositeButton
        icon={<DatabaseOutlined />}
        label="内容库"
        description="12 个待处理项目"
        onClick={() => undefined}
      />
      <CompositeButton
        icon={<ExperimentOutlined />}
        label="沙盒探索"
        description="最近更新 2 分钟前"
        actions={[{ key: "edit", icon: <EditOutlined />, label: "编辑沙盒", onClick: () => undefined }]}
        onClick={() => undefined}
      />
      <CompositeButton
        icon={<SettingOutlined />}
        label="设置"
        description="3 项需要确认"
        actions={[
          { key: "copy", icon: <CopyOutlined />, label: "复制设置", onClick: () => undefined },
          { key: "more", icon: <MoreOutlined />, label: "更多设置", onClick: () => undefined },
        ]}
        onClick={() => undefined}
      />
    </div>
  ),
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/composite-button"]');
    assertStorySelector(canvasElement, '[aria-label="编辑沙盒"]');
    assertStorySelector(canvasElement, '[aria-label="复制设置"]');
    assertStoryText(canvasElement, "12 个待处理项目");
  },
};

export const Collapsed: Story = {
  name: "收起状态",
  render: () => (
    <div style={{ width: 24 }}>
      <CompositeButton
        collapsed
        icon={<FileTextOutlined />}
        label="文章列表"
        onClick={() => undefined}
      />
    </div>
  ),
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/composite-button"][data-collapsed="true"]');
    assertStorySelector(canvasElement, 'button[aria-label="文章列表"]');
  },
};
