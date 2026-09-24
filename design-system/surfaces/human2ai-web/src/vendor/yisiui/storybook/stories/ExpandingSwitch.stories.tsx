import { AppstoreOutlined, EditOutlined, EyeOutlined, FolderOutlined, SearchOutlined, SettingOutlined, StarOutlined, TagOutlined } from "@ant-design/icons";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";
import { ExpandingSwitch, type ExpandingSwitchItem, type ExpandingSwitchProps } from "@human2ai/ui/yisiui";
import { assertStoryRole, assertStorySelector } from "../interactionChecks";

const items: ExpandingSwitchItem[] = [
  { key: "edit", label: "编辑", icon: <EditOutlined /> },
  { key: "preview", label: "预览", icon: <EyeOutlined /> },
  { key: "browse", label: "浏览全部", icon: <AppstoreOutlined /> },
];

const meta = {
  id: "switching-expandingswitch",
  title: "yisiui-Components/Switching/ExpandingSwitch",
  component: ExpandingSwitch,
  parameters: { layout: "padded" },
  args: { items, "aria-label": "显示方式" },
  argTypes: {
    items: { control: "object", description: "选项的 key、文字、可选 icon 和 disabled；收起时显示 icon，展开时只显示文字。" },
    colors: { control: "object", description: "multicolor 固定循环纸感八色；duotone 可配置选中／未选中的背景色与前景色，颜色跟随实际选中值。" },
    value: { control: "text", description: "受控选中值；hover 不触发 onChange。" },
    defaultValue: { control: "text" },
    disabled: { control: "boolean" },
    onChange: { control: false },
    className: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof ExpandingSwitch>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledDemo(args: ExpandingSwitchProps) {
  const [value, setValue] = useState("browse");
  return (
    <div style={{ display: "grid", justifyItems: "start", gap: 16 }}>
      <ExpandingSwitch {...args} value={value} onChange={setValue} />
      <span role="status">当前选择：{args.items.find((item) => item.key === value)?.label}</span>
      <span style={{ color: "var(--yisiui-color-text-secondary)", fontSize: 13 }}>悬停预览，点击选中。移出后恢复选中项；方向键也可切换。</span>
    </div>
  );
}

export const Default: Story = {
  name: "悬停展开与选中",
  render: (args) => <ControlledDemo {...args} />,
  play: async ({ canvasElement }) => {
    assertStoryRole(canvasElement, "radiogroup");
    assertStorySelector(canvasElement, '[role="radio"][aria-label="浏览全部"][aria-checked="true"]');
    assertStorySelector(canvasElement, '[role="radio"][aria-label="预览"][aria-checked="false"]');

    // Real layout regression: interrupt hover animations before they complete.
    // jsdom cannot catch the independent-transition width drift this prevents.
    const group = canvasElement.querySelector<HTMLElement>('[role="radiogroup"]')!;
    const track = group.querySelector<HTMLElement>(".yisi-expanding-switch-track")!;
    const buttons = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await frame();
    const initialWidth = group.getBoundingClientRect().width;
    function assertWidth() {
      const bounds = buttons.map((button) => button.getBoundingClientRect());
      const visibleWidth = Math.max(...bounds.map((box) => box.right)) - Math.min(...bounds.map((box) => box.left));
      if (Math.abs(group.getBoundingClientRect().width - initialWidth) > 0.1
        || Math.abs(visibleWidth - track.getBoundingClientRect().width) > 0.5) {
        throw new Error("快速 hover 时组件外框与彩色条必须保持固定总宽度");
      }
    }
    for (const index of [0, 1, 0, 2, 1, 2, 0, 1, 2]) {
      buttons[index].dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
      for (let i = 0; i < 2; i++) { await frame(); assertWidth(); }
    }
    buttons[2].dispatchEvent(new PointerEvent("pointerout", {
      bubbles: true, pointerType: "mouse", relatedTarget: canvasElement.ownerDocument.body,
    }));
    for (let i = 0; i < 16; i++) { await frame(); assertWidth(); }
    assertStorySelector(canvasElement, '[role="radio"][aria-label="浏览全部"][aria-checked="true"][data-expanded="true"]');
  },
};

export const Duotone: Story = {
  name: "深浅双色与自定义配色",
  render: (args) => (
    <div style={{ display: "grid", justifyItems: "start", gap: 20 }}>
      <ExpandingSwitch {...args} colors={{ mode: "duotone" }} aria-label="主题深浅色" />
      <ExpandingSwitch {...args} colors={{ mode: "duotone", selectedBackground: "#68445C", unselectedBackground: "#F1E5ED", selectedForeground: "#FFFFFF", unselectedForeground: "#503448" }} aria-label="自定义深浅色" />
    </div>
  ),
};

const paletteIcons = [<EditOutlined />, <EyeOutlined />, <AppstoreOutlined />, <FolderOutlined />, <SearchOutlined />, <SettingOutlined />, <StarOutlined />, <TagOutlined />];
export const EightColors: Story = {
  name: "固定八色循环与纯色方格",
  render: (args) => (
    <div style={{ display: "grid", justifyItems: "start", gap: 20, maxWidth: "100%" }}>
      <ExpandingSwitch {...args} aria-label="带图标的八色循环" items={Array.from({ length: 10 }, (_, i) => ({ key: String(i), label: `选项 ${i + 1}`, icon: paletteIcons[i % 8] }))} />
      <ExpandingSwitch {...args} aria-label="纯色方格" items={Array.from({ length: 10 }, (_, i) => ({ key: String(i), label: `选项 ${i + 1}` }))} />
    </div>
  ),
};

export const Boundaries: Story = {
  name: "禁用、长文字与窄容器",
  render: (args) => (
    <div style={{ display: "grid", justifyItems: "start", gap: 20, maxWidth: "100%" }}>
      <ExpandingSwitch {...args} items={items.map((item, i) => ({ ...item, disabled: i === 1 }))} aria-label="跳过禁用项" />
      <ExpandingSwitch {...args} disabled aria-label="整组禁用" />
      <div style={{ width: 240, maxWidth: "100%" }}>
        <ExpandingSwitch {...args} aria-label="窄容器中的长文字" items={[...items, { key: "long", label: "查看所有已保存的版本与修改记录", icon: <FolderOutlined /> }]} />
      </div>
    </div>
  ),
};
