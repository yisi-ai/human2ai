import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";
import { createAppI18n } from "../../../../../web/i18n/createI18n";
import { UiSketchStateTabs, type UiSketchStateTabItem, type UiSketchStateTabsLabels } from "./UiSketchStateTabs";

const t = createAppI18n("zh-CN").t;
const labels: UiSketchStateTabsLabels = {
  add: t("uiSketch.views.enableMotion"),
  switch: t("uiSketch.views.switch"), rename: t("actions.rename"), name: t("uiSketch.states.name"),
  new: t("uiSketch.states.new"), delete: t("uiSketch.states.delete"), cancel: t("actions.cancel"),
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
    const tabs = () => [...canvasElement.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    const rows = () => [...canvasElement.querySelectorAll<HTMLElement>("[data-tab-key]")];
    const order = () => tabs().map((tab) => tab.value).join("|");
    const action = async (index: number, text: string) => {
      // Keyboard-accessible trigger is also retained in hover mode.
      const button = rows()[index].querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
      button.focus();
      button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
      button.click();
      await wait(300);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const menu = [...document.querySelectorAll<HTMLElement>('[role="menu"]')]
        .find((element) => element.getBoundingClientRect().width && !element.closest(".ant-dropdown-hidden"))!;
      const rect = menu.getBoundingClientRect();
      const anchor = rows()[index].getBoundingClientRect();
      if (Math.abs(rect.top - anchor.bottom) > 20 || rect.right < anchor.left || rect.left > anchor.right) {
        throw new Error(`状态菜单必须定位在对应标签下方：${JSON.stringify({ menu: rect.toJSON(), anchor: anchor.toJSON() })}`);
      }
      const options = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];
      if (options[0]?.textContent !== labels.new) throw new Error("新建状态必须是菜单第一项");
      options.find((option) => option.textContent === text)!.click();
      await wait(300);
    };
    await action(1, labels.rename);
    if (!tabs()[0].checked) throw new Error("非活动状态菜单不应切换状态");
    const input = document.querySelector<HTMLInputElement>(".human2ai-state-tabs__name")!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "激活");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await wait();
    document.querySelector<HTMLButtonElement>(".ant-modal .ant-btn-primary")!.click();
    await wait(400);
    if (!rows()[1].textContent?.includes("激活")) throw new Error("重命名没有更新标签");
    await action(1, labels.new);
    if (tabs().length !== 4 || !tabs()[2].checked) throw new Error("新状态应插在来源后并选中");

    const drag = async (cancel: boolean) => {
      const original = rows();
      const originalOrder = order();
      const label = original[2].querySelector<HTMLElement>("label")!;
      const source = label.getBoundingClientRect();
      const target = original[3].getBoundingClientRect();
      const root = canvasElement.querySelector<HTMLElement>(".yisi-tab-switch")!;
      const y = source.y + source.height / 2;
      const event = (type: string, x: number, clientY = y) => new PointerEvent(type, {
        bubbles: true, pointerId: 21, pointerType: "mouse", isPrimary: true,
        button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: x, clientY,
      });
      label.dispatchEvent(event("pointerdown", source.x + source.width / 2));
      await wait(400);
      if (root.dataset.dragState !== "dragging") throw new Error("长按未进入拖动");
      window.dispatchEvent(event("pointermove", target.right - 2));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!original[3].style.transform || original[3].style.transform === "translate3d(0px, 0px, 0px)") {
        throw new Error("拖动时其他标签必须实时让位");
      }
      if (order() !== originalOrder || rows().some((row, index) => row !== original[index])) {
        throw new Error("拖动预览不得提交正式顺序或替换标签节点");
      }
      if (cancel) {
        window.dispatchEvent(event("pointermove", target.right - 2, root.getBoundingClientRect().bottom + 30));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (root.getAttribute("data-drag-state") !== "cancel") throw new Error("移出应显示取消反馈");
        window.dispatchEvent(event("pointerup", target.right - 2, root.getBoundingClientRect().bottom + 30));
        await wait();
        if (order() !== originalOrder) throw new Error("组件外松手不得提交排序");
      } else {
        window.dispatchEvent(event("pointerup", target.right - 2));
        await wait();
        if (order() !== "1|2|3|4" || !tabs()[3].checked) throw new Error("内部松手应提交排序并保留选择");
      }
      if (root.hasAttribute("data-drag-state") || original.some((row) => row.style.transform)) {
        throw new Error("手势结束必须清理预览");
      }
    };
    await drag(true);
    await drag(false);
    await action(3, labels.delete);
    document.querySelector<HTMLButtonElement>(".ant-modal .ant-btn-primary")!.click();
    await wait(400);
    if (tabs().length !== 3) throw new Error("删除状态失败");
    canvasElement.dataset.interactionsPassed = "true";
  },
};
