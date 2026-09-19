import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";

import { SessionStylePicker, type SessionStylePickerProps } from "./SessionStylePicker";
import { fixtureStyles, image, labels as libraryLabels } from "./styleLibraryFixtures";

const labels = {
  title: "会话风格", choose: "选择风格", dialogTitle: "为当前会话选择风格",
  unbind: "解除风格绑定", select: "使用此风格", pending: "尚未按当前风格加工",
};

function Harness(props: SessionStylePickerProps) {
  const [styleId, setStyleId] = useState(props.currentStyle?.id ?? null);
  return <div style={{ width: 280, padding: 16 }}><SessionStylePicker {...props}
    currentStyle={props.styles.find((style) => style.id === styleId) ?? null}
    onBind={async (id) => setStyleId(id)}
  /></div>;
}

const meta = {
  id: "human2ai-session-style-picker", title: "human2ai/SessionStylePicker",
  component: SessionStylePicker, render: Harness,
  args: { styles: fixtureStyles, currentStyle: null, category: "visual", labels, libraryLabels,
    imageUrl: () => image, onBind: async () => undefined, onRetry: () => undefined },
} satisfies Meta<typeof SessionStylePicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "选择与绑定", play: async ({ canvasElement, args }) => {
  const document = canvasElement.ownerDocument;
  const click = (label: string) => {
    const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.getAttribute('aria-label') === label || item.textContent?.trim() === label);
    if (!button) throw new Error(`Missing button: ${label}`);
    button.click();
  };
  const wait = () => new Promise((resolve) => setTimeout(resolve, 100));
  const chosen = args.styles.find(style => style.category === args.category)!;
  click("选择风格"); await wait();
  click(libraryLabels.openStyle(chosen.name)); await wait();
  click("使用此风格"); await wait();
  if (!canvasElement.textContent?.includes(chosen.name)) throw new Error("Selected style did not appear in the session");
  click("解除风格绑定"); await wait();
  if (!canvasElement.textContent?.includes("选择风格")) throw new Error("Style was not unbound");
} };
export const Spatial: Story = { name: "3D 建模指导", args: { category: "spatial" }, play: Default.play };
export const Bound: Story = { name: "已绑定", args: { currentStyle: fixtureStyles[0] } };
export const Pending: Story = { name: "等待按新规范加工", args: { currentStyle: fixtureStyles[0], pending: true } };
export const Loading: Story = { name: "加载中", args: { loading: true } };
export const Empty: Story = { name: "空风格库", args: { styles: [] } };
export const ErrorState: Story = { name: "加载失败", args: { error: "风格加载失败" } };
export const Disabled: Story = { name: "保存中禁用", args: { currentStyle: fixtureStyles[0], saving: true } };
export const LongName: Story = { name: "窄侧栏与长名称", args: { styles: [{ ...fixtureStyles[0], name: "具有很长名称的克制风格，用来验证侧栏布局" }], currentStyle: fixtureStyles[0] } };
