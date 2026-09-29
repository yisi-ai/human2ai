import { CopyOutlined } from "@ant-design/icons";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { expect, userEvent, waitFor } from "storybook/test";
import zh from "../../../../../locales/zh-CN/common.json";
import { CompositeButton } from "../vendor/yisiui/runtime/src/components/CompositeButton";
import { PromptPreviewHover } from "./PromptPreviewHover";

const prompt = Array.from({ length: 80 }, (_, index) => `${index + 1}. ${"保留当前布局与元素说明。".repeat(6)}`).join("\n");
let copied = "";
const meta = {
  id: "human2ai-prompt-preview-hover",
  title: "human2ai/PromptPreviewHover",
  component: PromptPreviewHover,
  parameters: { layout: "centered" },
  args: {
    readPrompt: (): string | Promise<string> => prompt,
    label: zh.clipboard.promptPreview,
    loadingLabel: zh.clipboard.promptPreviewLoading,
    errorLabel: zh.clipboard.promptPreviewFailed,
    children: <CompositeButton icon={<CopyOutlined aria-hidden="true" />} label={zh.clipboard.copyPrompt} onClick={() => { copied = prompt; }} />,
  },
} satisfies Meta<typeof PromptPreviewHover>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "长提示词预览与滚动",
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector('button')!;
    const doc = canvasElement.ownerDocument;
    const view = doc.defaultView!;
    const before = button.getBoundingClientRect().toJSON();
    const frames: number[][] = [];
    let frame = 0;
    const sample = () => {
      frames.push([doc.documentElement.scrollWidth, doc.documentElement.scrollHeight]);
      frame = view.requestAnimationFrame(sample);
    };
    sample();
    try {
      copied = "";
      await userEvent.hover(button);
      await waitFor(() => expect(doc.querySelector('.human2ai-prompt-preview-hover__content pre')?.textContent).toBe(prompt));
      const content = doc.querySelector<HTMLElement>('.human2ai-prompt-preview-hover__content')!;
      await userEvent.unhover(button);
      await userEvent.hover(content);
      content.scrollTop = content.scrollHeight;
      await new Promise(resolve => setTimeout(resolve, 250));
      expect(content.scrollTop).toBeGreaterThan(0);
      expect(content.getBoundingClientRect().height).toBeLessThanOrEqual(360);
      const popup = content.closest<HTMLElement>('.ant-popover')!;
      const bounds = popup.getBoundingClientRect();
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.bottom).toBeLessThanOrEqual(view.innerHeight);
      expect(bounds.right).toBeLessThanOrEqual(view.innerWidth);
      expect(button.getBoundingClientRect().toJSON()).toEqual(before);
      expect(frames.every(([width, height]) => width <= view.innerWidth && height <= view.innerHeight)).toBe(true);
      expect(content.closest('.ant-popover')?.classList.contains('ant-popover-hidden')).toBe(false);
      expect(copied).toBe("");
      await userEvent.click(button);
      expect(copied).toBe(prompt);
      canvasElement.dataset.promptPreviewPassed = 'true';
    } finally {
      view.cancelAnimationFrame(frame);
    }
  },
};
export const Loading: Story = { name: "等待提示词", args: { readPrompt: () => new Promise<string>(() => undefined) } };
export const Failure: Story = { name: "提示词预览失败", args: { readPrompt: () => Promise.reject(new Error('fixture')) } };
export const Disabled: Story = { name: "暂不可预览", args: { disabled: true } };
