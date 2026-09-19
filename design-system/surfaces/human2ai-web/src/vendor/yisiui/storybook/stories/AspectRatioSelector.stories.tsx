import type { Meta, StoryObj } from "@storybook/react-webpack5";

import { AspectRatioSelector } from "@human2ai/ui/yisiui";
import { assertStoryRole, assertStorySelector, assertStoryText } from "../interactionChecks";

const meta = {
  id: "modules-aspectratioselector",
  title: "yisiui-Modules/AspectRatioSelector",
  component: AspectRatioSelector,
  parameters: { layout: "centered" },
  argTypes: {
    options: { control: "object", description: "按环绕位置排列的 1 至 7 个正数比例选项。" },
    value: { control: "text", description: "受控选中项 key。" },
    defaultValue: { control: "text", description: "非受控模式的初始选中项 key。" },
    ratio: { control: "object", description: "受控的当前宽高比例值。" },
    defaultRatio: { control: "object", description: "非受控模式的初始宽高比例值。" },
    title: { control: "text", description: "选择器标题。" },
    widthLabel: { control: "text", description: "宽度输入框的可见及无障碍标签。" },
    heightLabel: { control: "text", description: "高度输入框的可见及无障碍标签。" },
    "aria-label": { control: "text", description: "比例选择组的无障碍名称。" },
    disabled: { control: "boolean", description: "禁用整个比例选择器。" },
    onChange: { control: false },
    onRatioChange: { control: false },
    className: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof AspectRatioSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

async function waitForStorySelector(root: HTMLElement, selector: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (root.querySelector(selector)) {
      return;
    }
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }
  throw new Error(`Story interaction contract missing selector: ${selector}`);
}

export const Default: Story = {
  name: "环绕比例选择",
  args: {
    defaultValue: "1:1",
  },
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/aspect-ratio-selector"]');
    assertStoryRole(canvasElement, "radiogroup");
    assertStoryText(canvasElement, "比例");
    assertStorySelector(canvasElement, 'input[aria-label="w"][value="1"]');
    assertStorySelector(canvasElement, 'input[aria-label="h"][value="1"]');
    assertStorySelector(canvasElement, '[role="radio"][data-ratio-key="1:1"][aria-checked="true"]');

    const wideOption = canvasElement.querySelector<HTMLButtonElement>(
      '[role="radio"][data-ratio-key="16:9"]',
    );
    if (!wideOption) {
      throw new Error("Story interaction contract missing 16:9 option");
    }
    wideOption.click();
    await waitForStorySelector(canvasElement, '[data-ratio="16:9"]');
    await waitForStorySelector(
      canvasElement,
      '[data-ratio-key="16:9"][aria-checked="true"]',
    );

    wideOption.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await waitForStorySelector(canvasElement, '[data-ratio="9:16"]');
    await waitForStorySelector(
      canvasElement,
      '[data-ratio-key="9:16"][aria-checked="true"]',
    );
  },
};

export const DisabledOption: Story = {
  name: "禁用项与长标签",
  args: {
    options: [
      { key: "cinema", label: "超宽银幕比例", width: 21, height: 9 },
      { key: "portrait", label: "9:16", width: 9, height: 16, disabled: true },
      { key: "square", label: "1:1", width: 1, height: 1 },
    ],
    defaultValue: "square",
  },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-ratio-key="portrait"][disabled]');
    assertStorySelector(canvasElement, '[data-ratio-key="cinema"][title="超宽银幕比例"]');
  },
};

export const CustomRatio: Story = {
  name: "手动比例与本地化标签",
  args: {
    defaultRatio: { width: 21, height: 9 },
    title: "画幅",
    widthLabel: "宽",
    heightLabel: "高",
    "aria-label": "画幅预设",
  },
  play: ({ canvasElement }) => {
    assertStoryText(canvasElement, "画幅");
    assertStorySelector(canvasElement, 'input[aria-label="宽"][value="21"]');
    assertStorySelector(canvasElement, 'input[aria-label="高"][value="9"]');
    assertStorySelector(canvasElement, '[data-ratio-value="21:9"]');
    if (canvasElement.querySelector('[role="radio"][aria-checked="true"]')) {
      throw new Error("Custom ratio must not leave a preset selected");
    }
  },
};

export const Disabled: Story = {
  name: "整体禁用",
  args: {
    defaultValue: "4:3",
    disabled: true,
  },
  play: ({ canvasElement }) => {
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="yisiui/aspect-ratio-selector"][aria-disabled="true"]',
    );
    assertStorySelector(
      canvasElement,
      '[role="radiogroup"][aria-disabled="true"]',
    );
  },
};
