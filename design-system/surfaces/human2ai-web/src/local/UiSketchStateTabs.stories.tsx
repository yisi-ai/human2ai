import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";
import { createAppI18n } from "../../../../../web/i18n/createI18n";
import { UiSketchStateTabs, type UiSketchStateTabItem, type UiSketchStateTabsLabels } from "./UiSketchStateTabs";

const t = createAppI18n("zh-CN").t;
const labels: UiSketchStateTabsLabels = {
  add: t("uiSketch.views.enableMotion"),
  switch: t("uiSketch.views.switch"), rename: t("actions.rename"), name: t("uiSketch.states.name"),
  new: t("uiSketch.states.new"), delete: t("uiSketch.states.delete"), cancel: t("actions.cancel"),
  reorderHint: t("uiSketch.states.reorderHint"),
  actions: (name) => t("uiSketch.states.actions", { name }),
  deleteTitle: (name) => t("uiSketch.states.deleteTitle", { name }),
};
function Fixture({ initialItems }: { initialItems: UiSketchStateTabItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [value, setValue] = useState(items[0].id);
  return <UiSketchStateTabs
    items={items} value={value} labels={labels} onChange={setValue}
    onRename={(id, label) => setItems((current) => current.map((item) => item.id === id ? { id, label } : item))}
    onDelete={(id) => {
      const next = items.filter((item) => item.id !== id);
      setItems(next);
      if (value === id) setValue(next[0].id);
    }}
    onCreate={(id) => {
      const next = [...items];
      const created = { id: String(Math.max(...items.map((item) => Number(item.id))) + 1), label: t("uiSketch.states.defaultName", { number: items.length + 1 }) };
      next.splice(next.findIndex((item) => item.id === id) + 1, 0, created);
      setItems(next); setValue(created.id);
    }}
    onReorder={(ids) => setItems(ids.map((id) => items.find((item) => item.id === id)!))}
  />;
}
const meta = {
  id: "human2ai-ui-sketch-state-tabs",
  title: "human2ai/UiSketchStateTabs",
  component: UiSketchStateTabs,
  parameters: { layout: "padded" },
} satisfies Meta<typeof UiSketchStateTabs>;
export default meta;
type Story = StoryObj;
const items = [1, 2, 3].map((number) => ({ id: String(number), label: t("uiSketch.states.defaultName", { number }) }));
export const Default: Story = { name: "状态菜单与长按排序", render: () => <Fixture initialItems={items} /> };
export const SingleState: Story = { name: "最后一个状态不可删除", render: () => <Fixture initialItems={items.slice(0, 1)} /> };
export const LongNames: Story = {
  name: "长名称与横向滚动",
  render: () => <Fixture initialItems={Array.from({ length: 12 }, (_, index) => ({ id: String(index + 1), label: index === 0 ? "包含长内容和多项操作的激活状态名称".repeat(4) : t("uiSketch.states.defaultName", { number: index + 1 }) }))} />,
};

export const Interactions: Story = {
  name: "菜单及排序交互验证",
  render: () => <Fixture initialItems={items} />,
  play: async ({ canvasElement }) => {
    const wait = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
    const tabs = () => [...canvasElement.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')];
    const order = () => tabs().map((tab) => tab.textContent?.trim()).join("|");
    const action = async (index: number, text: string) => {
      canvasElement.querySelectorAll<HTMLButtonElement>(".human2ai-state-tabs__more")[index].click();
      await wait(200);
      const menus = [...document.querySelectorAll<HTMLElement>('[role="menu"]')].filter((menu) => menu.getBoundingClientRect().width);
      const options = [...menus.at(-1)!.querySelectorAll<HTMLElement>('[role="menuitem"]')];
      if (options[0]?.textContent !== labels.new) throw new Error("新建状态必须是菜单第一项");
      options.find((option) => option.textContent === text)!.click();
      await wait(250);
    };
    await action(1, labels.rename);
    const input = document.querySelector<HTMLInputElement>(".human2ai-state-tabs__name")!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "激活");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await wait();
    const ok = document.querySelector<HTMLButtonElement>(".ant-modal .ant-btn-primary")!;
    ok.click();
    await wait(350);
    if (tabs()[1].textContent !== "激活") throw new Error("重命名没有更新标签");
    await action(1, labels.new);
    if (tabs().length !== 4 || tabs()[2].getAttribute("aria-pressed") !== "true") throw new Error("新状态应插在来源后并选中");
    tabs()[2].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", ctrlKey: true, shiftKey: true, bubbles: true }));
    await wait();
    if (tabs()[1].textContent !== "状态 4") throw new Error("键盘排序失败");

    const dragged = tabs()[1];
    const source = dragged.getBoundingClientRect();
    const target = tabs()[3].getBoundingClientRect();
    // Synthetic pointers have no browser capture owner; only the Story supplies this stub.
    const capture = dragged.setPointerCapture;
    dragged.setPointerCapture = () => {};
    const pointerEvent = (type: string, x: number) => new PointerEvent(type, { bubbles: true, pointerId: 21, pointerType: "mouse", button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: x, clientY: source.y + source.height / 2 });
    dragged.dispatchEvent(pointerEvent("pointerdown", source.x + 5));
    await wait(400);
    if (!document.querySelector(".human2ai-state-tabs__ghost")) throw new Error("长按未进入拖动");
    dragged.dispatchEvent(pointerEvent("pointermove", target.right - 2));
    await wait();
    dragged.dispatchEvent(pointerEvent("pointerup", target.right - 2));
    dragged.setPointerCapture = capture;
    await wait();
    if (order() !== "状态 1|激活|状态 3|状态 4") throw new Error("长按拖动排序失败：" + order());
    await action(3, labels.delete);
    document.querySelector<HTMLButtonElement>(".ant-modal .ant-btn-primary")!.click();
    await wait(350);
    if (tabs().length !== 3) throw new Error("删除状态失败");
    canvasElement.dataset.interactionsPassed = "true";
  },
};
