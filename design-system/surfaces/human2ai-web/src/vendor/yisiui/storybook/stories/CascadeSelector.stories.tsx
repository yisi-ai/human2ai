import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";
import { CascadeSelector, type CascadeSelectorProps, type CascadeSelectorOption } from "@human2ai/ui/yisiui";
import { assertStorySelector } from "../interactionChecks";

const options: readonly CascadeSelectorOption[] = [
  { key: "design", label: "设计资源", children: [
    { key: "docs", label: "规范文档", children: [
      { key: "color", label: "色彩设计规范" }, { key: "type", label: "文字与排版" },
      { key: "spacing", label: "间距与布局" }, { key: "a11y", label: "无障碍设计" },
    ] },
    { key: "icons", label: "图标设计", children: [
      { key: "outline", label: "线性图标" }, { key: "solid", label: "面性图标" }, { key: "motion", label: "动态图标设计" },
    ] },
    { key: "illustration", label: "插画", children: [{ key: "scene", label: "场景插画" }] },
    { key: "archived", label: "已归档", disabled: true },
  ] },
  { key: "product", label: "产品资源", children: [
    { key: "interface", label: "界面方案", children: [{ key: "desktop", label: "桌面端设计" }, { key: "mobile", label: "移动端设计" }] },
    { key: "research", label: "用户研究", children: [{ key: "interview", label: "访谈记录" }] },
  ] },
  { key: "engineering", label: "研发资源", children: [
    { key: "contracts", label: "接口约定", children: [{ key: "api", label: "API 设计" }, { key: "events", label: "事件协议" }] },
  ] },
  { key: "other", label: "其他资源" },
];
const columns = [{ width: 1 }, { width: 1 }, { width: 1.4 }];
const meta = {
  id: "modules-cascadeselector",
  title: "yisiui-Modules/CascadeSelector",
  component: CascadeSelector,
  parameters: { layout: "padded" },
  args: { options, columns, title: "资源分类", "aria-label": "资源分类", height: 360, width: 780 },
  argTypes: {
    title: { control: "text", description: "搜索框左侧的可选标题插槽，支持 ReactNode；不传时由搜索区使用整行。" },
    options: { control: "object", description: "不可变层级数据；同级 key 唯一，label 用于全层级搜索。" },
    columns: { control: "object", description: "至少两栏，覆盖全部数据层级；width 为宽度比例，minWidth 为最小像素宽度。" },
    value: { control: "object", description: "受控路径；切换某一级时，onChange 返回截断后的完整有效路径。" },
    defaultValue: { control: "object" },
    height: { control: "number" }, width: { control: "number" },
    disabled: { control: "boolean" },
    renderOption: { control: false }, onChange: { control: false },
    className: { control: false }, style: { control: false }, labels: { control: false },
  },
} satisfies Meta<typeof CascadeSelector>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledDemo(args: CascadeSelectorProps) {
  const [value, setValue] = useState<readonly string[]>(["design", "docs", "color"]);
  const [path, setPath] = useState("设计资源 / 规范文档 / 色彩设计规范");
  return <div style={{ display: "grid", gap: 12, maxWidth: "100%" }}>
    <CascadeSelector {...args} value={value} onChange={(next, selected) => {
      setValue(next); setPath(selected.map((option) => option.label).join(" / "));
    }} />
    <span style={{ color: "var(--yisiui-color-text-secondary)", fontSize: 13 }}>当前路径：{path}</span>
    <span style={{ color: "var(--yisiui-color-text-secondary)", fontSize: 13 }}>搜索“设计”可查看各层级匹配，以及其他分支中的匹配提示。</span>
  </div>;
}
export const Default: Story = {
  name: "三级联动与全层级搜索",
  render: (args) => <ControlledDemo {...args} />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, 'input[type="search"]');
    assertStorySelector(canvasElement, '[role="radio"][aria-label="设计资源"][aria-checked="true"]');
    const component = canvasElement.querySelector<HTMLElement>(".yisi-cascade-selector")!;
    const columns = [...component.querySelectorAll<HTMLElement>(".yisi-cascade-selector-column")];
    const height = component.getBoundingClientRect().height;
    if (columns.length !== 3 || columns.some((column) => Math.abs(column.getBoundingClientRect().height - columns[0].getBoundingClientRect().height) > 1)) {
      throw new Error("各栏必须等高");
    }
    canvasElement.querySelector<HTMLButtonElement>('[role="radio"][aria-label="图标设计"]')!.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    assertStorySelector(canvasElement, '[role="radio"][aria-label="线性图标"][aria-checked="false"]');
    if (Math.abs(component.getBoundingClientRect().height - height) > 1) throw new Error("选择变化不得改变整体高度");
    canvasElement.querySelector<HTMLButtonElement>('[role="radio"][aria-label="规范文档"]')!.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    canvasElement.querySelector<HTMLButtonElement>('[role="radio"][aria-label="色彩设计规范"]')!.click();
  },
};

export const TwoLevels: Story = {
  name: "两级选择与空分支",
  args: {
    width: 560,
    columns: [{ width: 1 }, { width: 2 }],
    options: options.map((item) => ({ ...item, children: item.children?.map(({ children: _, ...child }) => child) })),
    defaultValue: ["design"],
  },
};

const largeOptions: readonly CascadeSelectorOption[] = Array.from({ length: 24 }, (_, i) => ({
  key: `group-${i}`, label: `资源分组 ${i + 1}`,
  children: Array.from({ length: 24 }, (_, j) => ({
    key: `section-${j}`, label: `二级分组 ${j + 1}`,
    children: Array.from({ length: 24 }, (_, k) => ({
      key: `collection-${k}`, label: k === 2 ? "这是一段需要完整展示的较长设计资源集合名称" : `资源集合 ${k + 1}`,
      children: [{ key: "detail", label: `第四级设计条目 ${i + 1}-${j + 1}-${k + 1}` }],
    })),
  })),
}));
export const FourLevels: Story = {
  name: "四级、长列表与窄容器",
  args: {
    options: largeOptions,
    columns: [...columns, { width: 1.6 }],
    defaultValue: ["group-0", "section-0", "collection-2"],
    width: 620, height: 320,
  },
};

export const States: Story = {
  name: "加载、错误、禁用与空数据",
  render: (args) => <div style={{ display: "grid", gap: 20 }}>
    <CascadeSelector {...args} height={220} defaultValue={["design"]} columns={[columns[0], { ...columns[1], loading: true }, columns[2]]} aria-label="加载中" />
    <CascadeSelector {...args} height={220} defaultValue={["design"]} columns={[columns[0], { ...columns[1], error: "选项加载失败，请稍后重试" }, columns[2]]} aria-label="加载失败" />
    <CascadeSelector {...args} height={220} defaultValue={["design", "docs"]} disabled aria-label="禁用选择" />
    <CascadeSelector {...args} height={220} options={[]} aria-label="空数据" />
  </div>,
};
