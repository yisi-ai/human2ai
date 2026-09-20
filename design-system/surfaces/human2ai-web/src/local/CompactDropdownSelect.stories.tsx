import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";

import {
  assertStoryRole,
  assertStorySelector,
  assertStoryText,
} from "../vendor/yisiui/storybook/interactionChecks";
import {
  CompactDropdownSelect,
  type CompactDropdownSelectOption,
  type CompactDropdownSelectPlacement,
} from "./CompactDropdownSelect";

import "./CompactDropdownSelect.stories.css";

const languages: readonly CompactDropdownSelectOption[] = [
  { value: "zh-CN", label: "中文" },
  { value: "en", label: "EN" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
];

function LanguageHarness({
  options = languages,
  placement = "bottom",
  disabled = false,
}: {
  options?: readonly CompactDropdownSelectOption[];
  placement?: CompactDropdownSelectPlacement;
  disabled?: boolean;
}) {
  const [language, setLanguage] = useState(options[0]?.value ?? "");

  return (
    <div className={`human2ai-compact-dropdown-select-story human2ai-compact-dropdown-select-story--${placement}`}>
      <CompactDropdownSelect
        aria-label="界面语言"
        disabled={disabled}
        onChange={setLanguage}
        options={options}
        placement={placement}
        value={language}
      />
    </div>
  );
}

const meta = {
  id: "human2ai-compact-dropdown-select",
  title: "human2ai/CompactDropdownSelect",
  component: CompactDropdownSelect,
  parameters: { layout: "fullscreen" },
  args: {
    "aria-label": "界面语言",
    onChange: () => undefined,
    options: languages,
    value: "zh-CN",
  },
} satisfies Meta<typeof CompactDropdownSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "多语言选择",
  render: () => <LanguageHarness />,
  play: async ({ canvasElement }) => {
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="human2ai/compact-dropdown-select"]',
    );
    const root = getRequiredElement(
      canvasElement,
      '[data-yisiui-asset="human2ai/compact-dropdown-select"]',
    );
    assertStoryRole(canvasElement, "combobox");
    assertStoryText(canvasElement, "中文");

    root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await nextFrame();
    assertStorySelector(canvasElement, '[data-open="true"]');

    const englishOption = Array.from(
      canvasElement.ownerDocument.querySelectorAll<HTMLElement>('[role="option"]'),
    ).find((option) => option.textContent?.includes("EN"));
    if (!englishOption) throw new Error("Language selector did not expose the EN option");
    englishOption.click();
    await nextFrame();
    assertStoryText(root, "EN");
    assertStorySelector(canvasElement, '[data-open="false"]');
  },
};

export const TopPlacement: Story = {
  name: "向上展开",
  render: () => <LanguageHarness placement="top" />,
  play: async ({ canvasElement }) => {
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="human2ai/compact-dropdown-select"]',
    );
    const root = getRequiredElement(
      canvasElement,
      '[data-yisiui-asset="human2ai/compact-dropdown-select"]',
    );
    root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await nextFrame();
    assertStorySelector(canvasElement, '[data-open="true"][data-placement="top"]');
    assertStorySelector(
      canvasElement.ownerDocument.body,
      ".human2ai-compact-dropdown-select__popup.ant-select-dropdown-placement-topLeft",
    );
  },
};

export const LongList: Story = {
  name: "长列表滚动",
  render: () => (
    <LanguageHarness
      options={Array.from({ length: 18 }, (_, index) => ({
        value: `language-${index + 1}`,
        label: `语言选项 ${index + 1}`,
      }))}
    />
  ),
  play: async ({ canvasElement }) => {
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="human2ai/compact-dropdown-select"]',
    );
    const root = getRequiredElement(
      canvasElement,
      '[data-yisiui-asset="human2ai/compact-dropdown-select"]',
    );
    root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await nextFrame();
    assertStoryText(canvasElement.ownerDocument.body, "语言选项 18");
    assertStorySelector(
      canvasElement.ownerDocument.body,
      ".human2ai-compact-dropdown-select__list",
    );
    const list = getRequiredElement(
      canvasElement.ownerDocument.body,
      ".human2ai-compact-dropdown-select__list .rc-virtual-list-holder",
    );
    if (list.scrollHeight <= list.clientHeight) {
      throw new Error("Long language list must scroll inside its fixed maximum height");
    }
  },
};

export const Disabled: Story = {
  name: "整体禁用",
  render: () => <LanguageHarness disabled />,
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[role="combobox"][aria-disabled="true"]');
  },
};

export const Empty: Story = {
  name: "空选项禁用",
  render: () => <LanguageHarness options={[]} />,
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-empty="true"] [role="combobox"][aria-disabled="true"]');
  },
};

export const Unselected: Story = {
  name: "尚未选择",
  args: {
    placeholder: "请选择",
    value: undefined,
  },
  play: ({ canvasElement }) => {
    assertStoryRole(canvasElement, "combobox");
    assertStoryText(canvasElement, "请选择");
  },
};

export const LongLabel: Story = {
  name: "窄宽度长语言名",
  render: () => (
    <div className="human2ai-compact-dropdown-select-story human2ai-compact-dropdown-select-story--narrow">
      <CompactDropdownSelect
        aria-label="界面语言"
        onChange={() => undefined}
        options={[
          {
            value: "long",
            label: "一个用于验证紧凑选择器截断行为的很长语言名称",
          },
          { value: "en", label: "EN" },
        ]}
        value="long"
      />
    </div>
  ),
};

async function nextFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function getRequiredElement(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Story interaction contract missing selector: ${selector}`);
  return element;
}
