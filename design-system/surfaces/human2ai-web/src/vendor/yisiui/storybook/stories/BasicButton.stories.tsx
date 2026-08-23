import { PlusOutlined, SettingOutlined } from "@ant-design/icons";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Space } from "antd";

import {
  BasicButton,
  basicButtonColorTokens,
  type BasicButtonProps,
} from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

const colorOptions = ["none", ...basicButtonColorTokens];

const meta = {
  id: "buttons-basicbutton",
  title: "Components/Buttons/BasicButton",
  component: BasicButton,
  parameters: { layout: "centered" },
  argTypes: {
    mode: {
      control: "select",
      options: ["with-icon", "without-icon", "icon-only"],
      description: "按钮内容模式",
    },
    backgroundColor: {
      control: "select",
      options: colorOptions,
      description: "背景 Token；none 表示无底色",
    },
    textColor: {
      control: "select",
      options: colorOptions,
      description: "文字 Token；none 表示交给 Ant Design 默认颜色",
    },
    size: {
      control: "select",
      options: ["small", "middle", "large"],
      description: "Ant Design 按钮尺寸",
    },
    icon: { control: false },
    iconLabel: { control: "text", description: "纯 Icon 模式的无障碍名称" },
    style: { control: false },
  },
} satisfies Meta<typeof BasicButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "可配置按钮",
  args: {
    mode: "with-icon",
    children: "新建文章",
    icon: <PlusOutlined />,
    backgroundColor: "color.brand.primary",
    textColor: "color.brand.onPrimary",
    size: "middle",
    iconLabel: "新建文章",
  } satisfies BasicButtonProps,
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/basic-button"]');
    assertStorySelector(canvasElement, "button");
    assertStoryText(canvasElement, "新建文章");
  },
};

export const Modes: Story = {
  name: "三种 Icon 模式",
  render: () => (
    <Space wrap>
      <BasicButton
        mode="with-icon"
        icon={<PlusOutlined />}
        backgroundColor="color.brand.primary"
        textColor="color.brand.onPrimary"
      >
        带 Icon
      </BasicButton>
      <BasicButton mode="without-icon" backgroundColor="color.surface.panel" textColor="color.text.primary">
        不带 Icon
      </BasicButton>
      <BasicButton
        mode="icon-only"
        icon={<SettingOutlined />}
        iconLabel="打开设置"
        backgroundColor="none"
        textColor="color.brand.primary"
        title="打开设置"
      />
    </Space>
  ),
};

export const TokenColors: Story = {
  name: "Token 颜色",
  render: () => (
    <Space wrap>
      <BasicButton backgroundColor="color.brand.primary" textColor="color.brand.onPrimary">
        品牌主色
      </BasicButton>
      <BasicButton backgroundColor="color.status.successBg" textColor="color.status.success">
        成功状态
      </BasicButton>
      <BasicButton backgroundColor="color.status.dangerBg" textColor="color.status.danger">
        危险状态
      </BasicButton>
      <BasicButton backgroundColor="none" textColor="color.text.secondary">
        无底色
      </BasicButton>
    </Space>
  ),
};

export const Sizes: Story = {
  name: "三种大小",
  render: () => (
    <Space align="center" wrap>
      <BasicButton size="small" backgroundColor="color.brand.primary" textColor="color.brand.onPrimary">
        小
      </BasicButton>
      <BasicButton size="middle" backgroundColor="color.brand.primary" textColor="color.brand.onPrimary">
        中
      </BasicButton>
      <BasicButton size="large" backgroundColor="color.brand.primary" textColor="color.brand.onPrimary">
        大
      </BasicButton>
    </Space>
  ),
};
