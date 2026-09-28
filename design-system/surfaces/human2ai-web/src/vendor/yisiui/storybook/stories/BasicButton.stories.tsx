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
  title: "yisiui-Components/Buttons/BasicButton",
  component: BasicButton,
  parameters: { layout: "centered" },
  argTypes: {
    mode: {
      control: "select",
      options: ["with-icon", "without-icon", "icon-only", "hover-text"],
      description: "hover-text 静止显示 Icon，悬停/键盘聚焦时动画展开并仅显示文字。",
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
    iconLabel: { control: "text", description: "纯 Icon/hover-text 模式的无障碍名称；hover-text 未传 children 时也用作展开文字。" },
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
    type: "primary",
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
  name: "四种 Icon 模式",
  render: () => (
    <Space wrap>
      <BasicButton
        mode="with-icon"
        icon={<PlusOutlined />}
        type="primary"
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
      <BasicButton mode="hover-text" icon={<SettingOutlined />}>
        打开设置
      </BasicButton>
    </Space>
  ),
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector<HTMLButtonElement>(".yisi-basic-button-hover-text")!;
    assertStorySelector(canvasElement, '.yisi-basic-button-hover-text[aria-label="打开设置"]');
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await frame();
    const collapsed = button.getBoundingClientRect().width;
    button.focus();
    // Establish the transition start even when a background preview has no paint frames.
    button.getBoundingClientRect();
    if (button.matches(":focus-visible")) {
      await Promise.allSettled(button.getAnimations({ subtree: true }).map((animation) => animation.finished));
      const label = button.querySelector<HTMLElement>(".yisi-basic-button-hover-label")!;
      const icon = button.querySelector<HTMLElement>(".yisi-basic-button-hover-icon")!;
      if (Number(getComputedStyle(label).opacity) !== 1 || Number(getComputedStyle(icon).opacity) !== 0
        || button.getBoundingClientRect().width < collapsed) {
        throw new Error("键盘聚焦应展开按钮，仅显示文字");
      }
    }
    button.blur();
  },
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
  name: "三种大小与交互状态",
  render: () => (
    <Space align="center" wrap>
      <BasicButton size="small" type="primary">
        小
      </BasicButton>
      <BasicButton size="middle" type="primary">
        中
      </BasicButton>
      <BasicButton size="large" type="primary">
        大
      </BasicButton>
      {(["small", "middle", "large"] as const).map((size) => (
        <BasicButton key={size} size={size} mode="hover-text" icon={<SettingOutlined />}>
          打开设置
        </BasicButton>
      ))}
      <BasicButton mode="hover-text" icon={<SettingOutlined />} disabled>暂不可用</BasicButton>
      <BasicButton mode="hover-text" icon={<SettingOutlined />} loading>正在加载</BasicButton>
    </Space>
  ),
};
