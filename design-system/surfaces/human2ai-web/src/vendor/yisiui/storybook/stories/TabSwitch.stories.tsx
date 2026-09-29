import {
  ApartmentOutlined,
  BranchesOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FormOutlined,
  MoreOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Flex, Space, Typography } from "antd";
import { useState } from "react";

import { BasicButton, TabSwitch, type TabSwitchItem, type TabSwitchProps } from "@human2ai/ui/yisiui";
import { TabSwitchDynamicExample } from "./TabSwitchDynamicExample";
import { verifyTabSwitchDynamicLayout } from "./TabSwitch.browserChecks";
import { assertStoryRole, assertStorySelector, assertStoryText } from "../interactionChecks";

const meta = {
  id: "switching-tabswitch",
  title: "yisiui-Components/Switching/TabSwitch",
  component: TabSwitch,
  parameters: { layout: "padded" },
  argTypes: {
    items: { control: "object", description: "至少一个子项；可配置 Icon、文字、disabled、rightSlot 和 menu（trigger: button / hover）。两种菜单触发均独立于切换。" },
    compact: { control: "boolean", description: "紧密模式：减小高度和上下内边距。较高的插槽内容会自然撑高组件。" },
    tabBackground: { control: "text", description: "整个 tab 组的底色。" },
    selectedBackground: { control: "text", description: "选中背景色块随选择移动并适配目标宽度；遵守系统减少动效设置。" },
    selectedTextColor: { control: "radio", options: ["black", "white"], description: "所有选中项统一使用的字体颜色。" },
    unselectedTextColor: { control: "radio", options: ["black", "white"], description: "所有未选中项统一使用的字体颜色。" },
    value: { control: "text", description: "受控选中项 key。" },
    defaultValue: { control: "text", description: "非受控模式的初始选中项 key。" },
    "aria-label": { control: "text", description: "切换组的无障碍名称。" },
    trailingAction: { control: "object", description: "独立尾部操作按钮；不参与选择、方向键导航和排序。" },
    reorderable: { control: "boolean", description: "长按 350ms 拖动排序；范围内松手提交，范围外松手取消。" },
    scrollArrows: { control: "object", description: "左右箭头的 icon 与 label；label 是按钮的无障碍名称，保持物理左右方向。" },
    dragAnnouncements: { control: "object", description: "拖动 inside/outside 状态的读屏提示；空字符串可静音，省略使用兼容默认值。" },
    onReorder: { control: false, description: "仅在内部松手且顺序变化时请求完整 key 顺序，由消费方接受或拒绝。" },
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
    compact: false,
    defaultValue: "conversation",
    items: REFERENCE_ITEMS,
    tabBackground: "var(--yisiui-color-surface-page)",
    selectedBackground: "var(--yisiui-color-action-primary)",
    selectedTextColor: "white",
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

export const Compact: Story = {
  name: "默认与紧密模式",
  args: {
    "aria-label": "紧密视图切换",
    items: MODE_ITEMS,
    compact: true,
  },
  render: (args) => (
    <Flex vertical align="start" gap={16}>
      <Typography.Text type="secondary">默认密度</Typography.Text>
      <TabSwitch {...args} aria-label="默认视图切换" compact={false} />
      <Typography.Text type="secondary">紧密密度</Typography.Text>
      <TabSwitch {...args} />
    </Flex>
  ),
};

function RightActionsExample(args: TabSwitchProps) {
  const [lastAction, setLastAction] = useState("尚未执行操作");

  return (
    <Flex vertical align="start" gap={16}>
      <TabSwitch
        {...args}
        items={args.items.map((item) => ({
          ...item,
          rightSlot: (
            <BasicButton
              mode="icon-only"
              icon={<MoreOutlined />}
              iconLabel={`${item.label}的更多操作`}
              type="text"
              size="small"
              style={{ width: 24, height: 24 }}
              disabled={item.disabled}
              onClick={() => setLastAction(`已执行「${item.label}」的操作，选中项保持不变`)}
            />
          ),
        })) as TabSwitchProps["items"]}
      />
      <Typography.Text role="status">{lastAction}</Typography.Text>
    </Flex>
  );
}

export const RightActions: Story = {
  name: "每项右侧独立操作",
  args: {
    "aria-label": "带右侧操作的视图切换",
    compact: true,
    items: [
      ...MODE_ITEMS,
      { key: "locked", label: "已归档", mode: "text-only", disabled: true },
    ],
  },
  render: (args) => <RightActionsExample {...args} />,
  play: ({ canvasElement }) => {
    const action = canvasElement.querySelector<HTMLButtonElement>('[aria-label="文章资料的更多操作"]');
    if (!action) throw new Error("Story interaction contract missing right slot action");
    action.click();
    assertStorySelector(canvasElement, 'input[value="execution"]:checked');
    assertStorySelector(canvasElement, 'button[aria-label="已归档的更多操作"]:disabled');
    assertStoryText(canvasElement, "已执行「文章资料」的操作，选中项保持不变");
  },
};

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


const STATUS_ITEMS: TabSwitchItem[] = [
  { key: "draft", label: "草稿" }, { key: "review", label: "等待审核" },
  { key: "revising", label: "修改中" }, { key: "ready", label: "准备发布" },
  { key: "published", label: "已发布" }, { key: "archived", label: "已归档" },
].map((item) => ({ ...item, mode: "text-only" }));

function StatusBarExample({ scrollArrows, dragAnnouncements }: Pick<TabSwitchProps, "scrollArrows" | "dragAnnouncements">) {
  const [single, setSingle] = useState(true);
  const [menuTrigger, setMenuTrigger] = useState<"button" | "hover">("button");
  const [items, setItems] = useState(STATUS_ITEMS);
  const [value, setValue] = useState("draft");
  const [message, setMessage] = useState("尚未执行操作");
  const [count, setCount] = useState(0);
  const [accept, setAccept] = useState(true);
  const withMenus = (source: TabSwitchItem[]): TabSwitchProps["items"] => source.map((item) => ({
    ...item,
    rightSlot: item.key === "draft" ? <span aria-label="草稿数量">3</span> : undefined,
    menu: {
      trigger: menuTrigger,
      items: [
        { key: "rename", label: "重命名", icon: <EditOutlined /> },
        { key: "delete", label: "删除", icon: <DeleteOutlined />, danger: true },
        { key: "share", label: "共享（不可用）", disabled: true },
      ],
      onAction: (actionKey: string, tabKey: string) => setMessage(`${tabKey}：${actionKey}（交由消费方处理）`),
    },
  })) as TabSwitchProps["items"];
  return <Flex vertical align="start" gap={16}>
    <label>菜单触发方式：<select aria-label="菜单触发方式" value={menuTrigger} onChange={(event) => setMenuTrigger(event.target.value as "button" | "hover")}>
      <option value="button">三点按钮</option><option value="hover">悬停标签</option>
    </select></label>
    <Typography.Text>一个状态时显示新建按钮；新增后由消费方隐藏。</Typography.Text>
    <TabSwitch aria-label="新建状态示例" compact items={withMenus(single ? [STATUS_ITEMS[0]] : STATUS_ITEMS.slice(0, 2))}
      trailingAction={single ? { label: "新建状态", icon: <PlusOutlined />, onClick: () => setSingle(false) } : undefined} />
    <Typography.Text>长按标签拖动；悬停或按住两侧箭头连续滚动，点击箭头大步滚动。</Typography.Text>
    <div style={{ maxWidth: "100%" }}>
      <TabSwitch style={{ width: 420 }} aria-label="可排序状态栏" compact items={withMenus(items)} value={value} onChange={setValue} reorderable
        scrollArrows={scrollArrows} dragAnnouncements={dragAnnouncements}
        onReorder={(keys) => {
          setCount((n) => n + 1);
          setMessage(`排序请求：${keys.join(" → ")}`);
          if (accept) setItems((previous) => keys.map((key) => previous.find((item) => item.key === key)!));
        }} />
    </div>
    <label><input type="checkbox" checked={accept} onChange={(event) => setAccept(event.target.checked)} />接受排序请求</label>
    <BasicButton onClick={() => setItems((previous) => previous.map((item) => ({ ...item })))}>等价数据刷新</BasicButton>
    <Typography.Text role="status">当前选择：{value}；排序回调：{count} 次；{message}</Typography.Text>
  </Flex>;
}

export const StatusBar: Story = {
  name: "状态标签栏与长按排序",
  args: {
    scrollArrows: { left: { label: "向左查看状态" }, right: { label: "向右查看状态" } },
    dragAnnouncements: { inside: "松开以应用新的状态顺序", outside: "已离开状态栏，松开以放弃调整" },
  },
  render: (args) => <StatusBarExample {...args} />,
};

export const DynamicItems: Story = {
  name: "动态标签与布局稳定性",
  render: () => <TabSwitchDynamicExample />,
  play: ({ canvasElement }) => verifyTabSwitchDynamicLayout(canvasElement),
};
