import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Button, Input } from "antd";
import { useState } from "react";

import {
  TextMarkEditor,
  TextMarkEditorField,
  TextMarkEditorTextArea,
} from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";
import styles from "./TextMarkEditor.stories.module.css";

interface EditorExampleProps {
  open: boolean;
  onCancel: () => void;
  saveLoading?: boolean;
  error?: string;
  longContent?: boolean;
}

const LONG_SELECTED_TEXT = Array.from(
  { length: 12 },
  (_, index) => `第 ${index + 1} 段选中文字用于验证长内容滚动边界和连续换行。`,
).join("\n");

const LONG_NOTE = Array.from(
  { length: 8 },
  (_, index) => `备注第 ${index + 1} 行，用于验证输入框在六行后停止增高。`,
).join("\n");

function EditorExample({
  open,
  onCancel,
  saveLoading = false,
  error,
  longContent = false,
}: EditorExampleProps) {
  const [note, setNote] = useState(
    longContent ? LONG_NOTE : "补充一个能说明论点的具体例子。",
  );

  return (
    <TextMarkEditor
      open={open}
      title="编辑文字标记"
      selectedText={longContent ? LONG_SELECTED_TEXT : "清晰的例子会让推理过程更容易理解。"}
      selectedTextLabel="选中的文字"
      saveLabel="保存"
      cancelLabel="取消"
      saveLoading={saveLoading}
      error={error}
      onCancel={onCancel}
      onSave={onCancel}
      deleteAction={{
        label: "删除标记",
        confirmTitle: "确认删除这条标记？",
        confirmDescription: "原文不会被删除。",
        confirmLabel: "确认删除",
        confirmCancelLabel: "保留标记",
        onConfirm: onCancel,
      }}
    >
      <TextMarkEditorField label="备注" hint="向调用方拥有的字段提供说明">
        <TextMarkEditorTextArea
          autoFocus
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </TextMarkEditorField>
      {longContent
        ? Array.from({ length: 6 }, (_, index) => (
            <TextMarkEditorField key={index} label={`补充字段 ${index + 1}`}>
              <Input defaultValue={`字段 ${index + 1} 的调用方数据`} />
            </TextMarkEditorField>
          ))
        : null}
    </TextMarkEditor>
  );
}

function ControlledEditorFixture() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("编辑器尚未打开");

  function closeEditor() {
    setOpen(false);
    setStatus("编辑器已关闭");
  }

  return (
    <main className={styles.storyFrame}>
      <div className={styles.triggerSurface}>
        <p>{status}</p>
        <Button
          type="primary"
          onClick={() => {
            setOpen(true);
            setStatus("编辑器已打开");
          }}
        >
          打开文字标记编辑器
        </Button>
      </div>
      <EditorExample open={open} onCancel={closeEditor} />
    </main>
  );
}

async function waitForCondition(check: () => boolean, message: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (check()) return;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 20));
  }
  throw new Error(message);
}

const meta = {
  id: "modules-textmarkeditor",
  title: "yisiui-Modules/TextMarkEditor",
  component: TextMarkEditor,
  parameters: { layout: "fullscreen" },
  argTypes: {
    open: { control: "boolean" },
    title: { control: "text" },
    selectedText: { control: "text" },
    selectedTextLabel: { control: "text" },
    saveLabel: { control: "text" },
    cancelLabel: { control: "text" },
    saveLoading: { control: "boolean" },
    saveDisabled: { control: "boolean" },
    children: { control: false },
    deleteAction: { control: false },
    error: { control: false },
    onCancel: { control: false },
    onSave: { control: false },
  },
} satisfies Meta<typeof TextMarkEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "默认编辑器",
  render: () => <EditorExample open onCancel={() => undefined} />,
  play: async () => {
    await waitForCondition(
      () => Boolean(document.querySelector('[data-yisiui-asset="yisiui/text-mark-editor"]')),
      "TextMarkEditor 未挂载共享资产标记",
    );
    const body = document.body;
    assertStorySelector(body, '[role="dialog"]');
    assertStorySelector(body, '[role="region"][aria-labelledby]');
    assertStorySelector(
      body,
      'textarea[aria-describedby][data-yisiui-auto-size="content"][data-yisiui-min-rows="3"][data-yisiui-max-rows="6"]',
    );
    const textarea = body.querySelector<HTMLTextAreaElement>(
      'textarea[data-yisiui-auto-size="content"]',
    );
    const transitionProperties = textarea
      ? getComputedStyle(textarea).transitionProperty
          .split(",")
          .map((property) => property.trim())
      : [];
    if (
      !textarea ||
      transitionProperties.includes("all") ||
      transitionProperties.includes("height")
    ) {
      throw new Error("多行输入框高度不得参与过渡动画");
    }
    assertStoryText(body, "选中的文字");

    const deleteButton = [...body.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("删除标记"));
    deleteButton?.click();
    await waitForCondition(
      () => body.textContent?.includes("确认删除这条标记？") === true,
      "删除确认未打开",
    );
    assertStoryText(body, "确认删除");
    const keepButton = [...body.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("保留标记"));
    keepButton?.click();
  },
};

export const KeyboardAndFocus: Story = {
  name: "键盘关闭与焦点归还",
  render: () => <ControlledEditorFixture />,
  play: async ({ canvasElement }) => {
    const trigger = [...canvasElement.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("打开文字标记编辑器"));
    if (!trigger) throw new Error("缺少编辑器触发按钮");

    trigger.click();
    await waitForCondition(
      () => Boolean(document.querySelector('[role="dialog"]')),
      "点击触发按钮后编辑器未打开",
    );
    assertStoryText(canvasElement, "编辑器已打开");

    const cancel = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.replaceAll(" ", "") === "取消");
    cancel?.click();
    await waitForCondition(
      () => document.activeElement === trigger,
      "关闭编辑器后焦点未归还触发按钮",
    );
    assertStoryText(canvasElement, "编辑器已关闭");

    trigger.click();
    await waitForCondition(
      () => Boolean(document.querySelector('[role="dialog"]')),
      "第二次打开编辑器失败",
    );
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitForCondition(
      () => canvasElement.textContent?.includes("编辑器已关闭") === true,
      "Escape 未请求关闭编辑器",
    );
    await waitForCondition(
      () => document.activeElement === trigger,
      "Escape 关闭后焦点未归还触发按钮",
    );
  },
};

export const Saving: Story = {
  name: "保存中锁定",
  render: () => <EditorExample open saveLoading onCancel={() => undefined} />,
  play: async () => {
    await waitForCondition(
      () => Boolean(document.querySelector('[aria-busy="true"]')),
      "保存中状态没有暴露 aria-busy",
    );
    const buttons = [...document.querySelectorAll<HTMLButtonElement>("button")];
    for (const label of ["取消", "删除标记"]) {
      const button = buttons.find((candidate) => candidate.textContent?.includes(label));
      if (!button?.disabled) throw new Error(`保存中应禁用${label}操作`);
    }
  },
};

export const ErrorAndLongContent: Story = {
  name: "错误与长内容",
  render: () => (
    <EditorExample
      open
      longContent
      error="保存失败，请检查内容后重试。"
      onCancel={() => undefined}
    />
  ),
  play: async () => {
    await waitForCondition(
      () => Boolean(document.querySelector('[role="alert"]')),
      "TextMarkEditor 未呈现错误状态",
    );
    assertStoryText(document.body, "保存失败，请检查内容后重试。");
    const context = document.querySelector<HTMLElement>(".yisi-text-mark-editor-context");
    const fields = document.querySelector<HTMLElement>(".yisi-text-mark-editor-fields");
    const textarea = document.querySelector<HTMLTextAreaElement>(
      'textarea[data-yisiui-auto-size="content"]',
    );
    if (!context || !fields || getComputedStyle(context).overflowY !== "auto" || getComputedStyle(fields).overflowY !== "auto") {
      throw new Error("长内容区域没有建立独立滚动边界");
    }
    if (!textarea || textarea.hasAttribute("rows") || getComputedStyle(textarea).resize !== "none") {
      throw new Error("多行输入框应由 3–6 行自动高度契约控制");
    }
  },
};
