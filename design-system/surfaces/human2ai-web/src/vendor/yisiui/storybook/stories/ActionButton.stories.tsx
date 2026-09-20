import type { Meta, StoryObj } from "@storybook/react-webpack5";

import { ActionButton } from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

const meta = {
  id: "buttons-actionbutton",
  title: "yisiui-Components/Buttons/ActionButton",
  component: ActionButton,
  parameters: { layout: "centered" },
  argTypes: {
    label: { control: "text", description: "空闲状态文字。" },
    pendingLabel: { control: "text", description: "动作执行中的明确状态文字。" },
    successLabel: { control: "text", description: "动作成功后的明确状态文字。" },
    errorLabel: { control: "text", description: "动作失败后的明确状态文字。" },
    feedbackDurationMs: { control: "number", description: "成功或失败反馈停留时间；null 表示保持当前反馈状态。" },
    motion: { control: "select", options: ["auto", "none"], description: "反馈动效策略。" },
    onAction: { control: false },
    onStatusChange: { control: false },
    onActionError: { control: false },
    idleIcon: { control: false },
    successIcon: { control: false },
    errorIcon: { control: false },
  },
} satisfies Meta<typeof ActionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

async function waitForActionStatus(
  root: HTMLElement,
  status: "pending" | "success" | "error",
): Promise<void> {
  const selector = `[data-action-status="${status}"]`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (root.querySelector(selector)) return;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }
  throw new Error(`ActionButton story did not reach ${status}.`);
}

export const Default: Story = {
  name: "执行成功反馈",
  args: {
    label: "复制摘要",
    pendingLabel: "复制中",
    successLabel: "已复制",
    errorLabel: "复制失败",
    feedbackDurationMs: null,
    onAction: async () => undefined,
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector<HTMLButtonElement>("button");
    if (!button) throw new Error("ActionButton story requires a button.");
    button.click();
    await waitForActionStatus(canvasElement, "success");
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/action-button"]');
    assertStorySelector(canvasElement, '[data-action-status="success"]');
    assertStoryText(canvasElement, "已复制");
  },
};

export const Uploading: Story = {
  name: "上传执行中",
  args: {
    label: "上传文件",
    pendingLabel: "上传中",
    successLabel: "上传成功",
    errorLabel: "上传失败",
    onAction: () => new Promise<void>(() => undefined),
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector<HTMLButtonElement>("button");
    if (!button) throw new Error("ActionButton upload story requires a button.");
    button.click();
    await waitForActionStatus(canvasElement, "pending");
    assertStorySelector(canvasElement, '[data-action-status="pending"]');
    assertStoryText(canvasElement, "上传中");
  },
};

export const Failed: Story = {
  name: "执行失败反馈",
  args: {
    label: "重新上传",
    pendingLabel: "上传中",
    successLabel: "上传成功",
    errorLabel: "上传失败",
    feedbackDurationMs: null,
    onAction: async () => {
      throw new Error("Upload failed for the deterministic Story.");
    },
    onActionError: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector<HTMLButtonElement>("button");
    if (!button) throw new Error("ActionButton failure story requires a button.");
    button.click();
    await waitForActionStatus(canvasElement, "error");
    assertStorySelector(canvasElement, '[data-action-status="error"]');
    assertStoryText(canvasElement, "上传失败");
  },
};

export const ReducedMotion: Story = {
  name: "减少动效",
  args: {
    label: "保存设置",
    pendingLabel: "保存中",
    successLabel: "已保存",
    errorLabel: "保存失败",
    feedbackDurationMs: null,
    motion: "none",
    onAction: async () => undefined,
  },
};
