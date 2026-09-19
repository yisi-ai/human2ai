import {
  ApartmentOutlined,
  BranchesOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FormOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Flex, Space, Typography } from "antd";

import { TabSwitch, type TabSwitchProps } from "@human2ai/ui/yisiui";
import { assertStoryRole, assertStorySelector, assertStoryText } from "../interactionChecks";

const meta = {
  id: "switching-tabswitch",
  title: "yisiui-Components/Switching/TabSwitch",
  component: TabSwitch,
  parameters: { layout: "padded" },
  argTypes: {
    items: { control: "object", description: "至少两个子项；可分别配置 Icon、文字、显示模式和 disabled。" },
    tabBackground: { control: "text", description: "整个 tab 组的底色。" },
    selectedBackground: { control: "text", description: "所有选中项统一使用的底色。" },
    selectedTextColor: { control: "radio", options: ["black", "white"], description: "所有选中项统一使用的字体颜色。" },
    unselectedTextColor: { control: "radio", options: ["black", "white"], description: "所有未选中项统一使用的字体颜色。" },
    value: { control: "text", description: "受控选中项 key。" },
    defaultValue: { control: "text", description: "非受控模式的初始选中项 key。" },
    "aria-label": { control: "text", description: "切换组的无障碍名称。" },
    onChange: { control: false },
    className: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof TabSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

const REFERENCE_ITEMS = [
  { key: "conversation", label: "执行", icon: <PlayCircleOutlined /> },
  { key: "material", label: "文章资料", icon: <FormOutlined /> },
  { key: "context", label: "上下文包", icon: <FileSearchOutlined /> },
  { key: "outline", label: "逻辑骨架", icon: <ApartmentOutlined /> },
  { key: "draft", label: "稿件批注", icon: <FileTextOutlined /> },
  { key: "history", label: "版本图", icon: <BranchesOutlined />, disabled: true },
  { key: "exploration", label: "探索", icon: <ExperimentOutlined /> },
] satisfies TabSwitchProps["items"];

export const Default: Story = {
  name: "文章工作台风格",
  args: {
    "aria-label": "文章工作台视图",
    defaultValue: "conversation",
    items: REFERENCE_ITEMS,
    tabBackground: "var(--yisiui-color-surface-page)",
    selectedBackground: "var(--yisiui-color-surface-panel)",
    selectedTextColor: "black",
    unselectedTextColor: "black",
  },
  play: ({ canvasElement }) => {
    assertStoryRole(canvasElement, "radiogroup");
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/tab-switch"]');
    assertStorySelector(canvasElement, 'input[value="conversation"]:checked');
    assertStorySelector(canvasElement, 'input[value="history"]:disabled');
    assertStoryText(canvasElement, "文章资料");

    const materialInput = canvasElement.querySelector<HTMLInputElement>('input[value="material"]');
    if (!materialInput) {
      throw new Error("Story interaction contract missing material tab input");
    }
    materialInput.click();
    assertStorySelector(canvasElement, 'input[value="material"]:checked');
  },
};

const MODE_ITEMS = [
  { key: "execution", label: "执行", icon: <PlayCircleOutlined /> },
  { key: "material", label: "文章资料", icon: <FormOutlined /> },
] satisfies TabSwitchProps["items"];

export const DisplayModes: Story = {
  name: "三种显示模式",
  render: () => (
    <Flex vertical gap={16}>
      <Flex align="center" gap={12}>
        <Typography.Text type="secondary" style={{ width: 72 }}>
          Icon + 文字
        </Typography.Text>
        <TabSwitch
          aria-label="Icon 加文字切换"
          items={MODE_ITEMS.map((item) => ({ ...item, mode: "icon-text" as const })) as TabSwitchProps["items"]}
        />
      </Flex>
      <Flex align="center" gap={12}>
        <Typography.Text type="secondary" style={{ width: 72 }}>
          纯文字
        </Typography.Text>
        <TabSwitch
          aria-label="纯文字切换"
          items={MODE_ITEMS.map((item) => ({ ...item, mode: "text-only" as const })) as TabSwitchProps["items"]}
        />
      </Flex>
      <Flex align="center" gap={12}>
        <Typography.Text type="secondary" style={{ width: 72 }}>
          纯 Icon
        </Typography.Text>
        <TabSwitch
          aria-label="纯 Icon 切换"
          items={MODE_ITEMS.map((item) => ({ ...item, mode: "icon-only" as const })) as TabSwitchProps["items"]}
        />
      </Flex>
    </Flex>
  ),
  play: ({ canvasElement }) => {
    assertStoryText(canvasElement, "Icon + 文字");
    assertStoryText(canvasElement, "纯文字");
    assertStoryText(canvasElement, "纯 Icon");
    assertStorySelector(canvasElement, ".yisi-tab-switch-visually-hidden");
  },
};

export const ItemColors: Story = {
  name: "统一颜色和底色",
  render: () => (
    <Space orientation="vertical" size={16}>
      <TabSwitch
        aria-label="浅色切换"
        items={[
          {
            key: "light-active",
            label: "当前视图",
            icon: <PlayCircleOutlined />,
          },
          { key: "light-other", label: "其他视图", icon: <FormOutlined /> },
        ]}
        tabBackground="var(--yisiui-color-surface-page)"
        selectedBackground="var(--yisiui-color-surface-panel)"
        selectedTextColor="black"
        unselectedTextColor="black"
      />
      <TabSwitch
        aria-label="深色切换"
        items={[
          {
            key: "dark-active",
            label: "高亮视图",
            icon: <ExperimentOutlined />,
          },
          {
            key: "dark-other",
            label: "其他视图",
            icon: <BranchesOutlined />,
          },
        ]}
        tabBackground="var(--yisiui-color-neutral-900)"
        selectedBackground="var(--yisiui-color-brand-primary-active)"
        selectedTextColor="white"
        unselectedTextColor="white"
        defaultValue="dark-active"
      />
    </Space>
  ),
};

export const DisabledItem: Story = {
  name: "禁用子项",
  args: {
    "aria-label": "不可用的文章工作台视图",
    defaultValue: "conversation",
    items: [
      { key: "conversation", label: "执行", icon: <PlayCircleOutlined /> },
      { key: "outline", label: "逻辑骨架", icon: <ApartmentOutlined />, disabled: true },
      { key: "draft", label: "稿件批注", icon: <FileTextOutlined /> },
    ],
  },
};
