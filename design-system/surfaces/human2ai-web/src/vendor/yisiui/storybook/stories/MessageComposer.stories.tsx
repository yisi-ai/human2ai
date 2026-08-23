import { QuestionCircleOutlined } from "@ant-design/icons";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";

import { MessageComposer } from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";
import styles from "./MessageComposer.stories.module.css";

const EXAMPLE_QUICK_PROMPTS = [
  {
    icon: <QuestionCircleOutlined aria-hidden="true" />,
    label: "什么意思",
    message: "解释一下这一段是什么意思?",
  },
] as const;

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  valueSetter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

async function waitForStoryUpdate() {
  for (let frame = 0; frame < 3; frame += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

function InteractiveFixture() {
  const [singleLineValue, setSingleLineValue] = useState("");
  const [multiLineValue, setMultiLineValue] = useState(
    "请检查这段论证中被省略的前提，并说明它为什么会影响结论。",
  );
  const [status, setStatus] = useState("还没有发送消息");

  return (
    <main className={styles.storyFrame}>
      <div className={styles.storyContent}>
        <section className={styles.example} aria-labelledby="single-line-title">
          <h2 id="single-line-title" className={styles.heading}>单行模式</h2>
          <p className={styles.description}>从一行开始，随换行增高到三行；Enter 换行，Ctrl/Cmd + Enter 发送。</p>
          <MessageComposer
            variant="single-line"
            value={singleLineValue}
            ariaLabel="单行 AI 消息"
            placeholder="输入你想弄清的问题…"
            quickPrompts={EXAMPLE_QUICK_PROMPTS}
            onChange={setSingleLineValue}
            onSubmit={(message) => {
              setStatus(`单行已发送：${message}`);
              setSingleLineValue("");
            }}
            onCancel={() => setStatus("已取消单行消息")}
          />
        </section>

        <section className={styles.example} aria-labelledby="multi-line-title">
          <h2 id="multi-line-title" className={styles.heading}>多行模式</h2>
          <p className={styles.description}>用于完整对话输入；Enter 换行，Ctrl/Cmd + Enter 发送。</p>
          <MessageComposer
            variant="multi-line"
            value={multiLineValue}
            ariaLabel="多行 AI 消息"
            placeholder="描述需要 AI 处理的任务…"
            quickPrompts={EXAMPLE_QUICK_PROMPTS}
            onChange={setMultiLineValue}
            onSubmit={(message) => {
              setStatus(`多行已发送：${message}`);
              setMultiLineValue("");
            }}
            onCancel={() => setStatus("已取消多行消息")}
          />
        </section>

        <p className={styles.status} aria-live="polite" data-composer-status>{status}</p>
      </div>
    </main>
  );
}

const meta = {
  id: "modules-messagecomposer",
  title: "Modules/MessageComposer",
  component: MessageComposer,
  parameters: { layout: "fullscreen" },
  argTypes: {
    value: { control: "text" },
    variant: { control: "radio", options: ["single-line", "multi-line"] },
    surface: { control: "radio", options: ["standalone", "embedded"] },
    ariaLabel: { control: "text" },
    placeholder: { control: "text" },
    submitLabel: { control: "text" },
    onChange: { control: false },
    onSubmit: { control: false },
    onCancel: { control: false },
    quickPrompts: { control: false },
    footer: { control: false },
    error: { control: false },
  },
} satisfies Meta<typeof MessageComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "单行与多行",
  render: () => <InteractiveFixture />,
  play: async ({ canvasElement }) => {
    const singleLineInput = canvasElement.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="单行 AI 消息"]',
    );
    const multiLineInput = canvasElement.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="多行 AI 消息"]',
    );
    if (!singleLineInput || !multiLineInput) {
      throw new Error("MessageComposer Story 缺少单行或多行输入区");
    }

    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/message-composer"]');
    assertStorySelector(canvasElement, '[data-variant="single-line"]');
    assertStorySelector(canvasElement, '[data-variant="multi-line"]');
    assertStorySelector(canvasElement, '[data-message-composer-footer]');

    const initialSingleLineHeight = singleLineInput.getBoundingClientRect().height;
    setTextareaValue(singleLineInput, "第一行\n第二行\n第三行");
    await waitForStoryUpdate();
    const threeLineHeight = singleLineInput.getBoundingClientRect().height;
    if (threeLineHeight <= initialSingleLineHeight) {
      throw new Error("单行模式没有随换行增加高度");
    }
    setTextareaValue(singleLineInput, "第一行\n第二行\n第三行\n第四行");
    await waitForStoryUpdate();
    const cappedHeight = singleLineInput.getBoundingClientRect().height;
    const computedMaxHeight = Number.parseFloat(getComputedStyle(singleLineInput).maxHeight);
    if (!Number.isFinite(computedMaxHeight) || cappedHeight > computedMaxHeight + 0.5) {
      throw new Error("单行模式超过了三行最大高度");
    }

    setTextareaValue(singleLineInput, "解释这句话");
    await waitForStoryUpdate();
    singleLineInput.dispatchEvent(new CompositionEvent("compositionstart", {
      bubbles: true,
      data: "解释",
    }));
    singleLineInput.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      isComposing: true,
    }));
    singleLineInput.dispatchEvent(new CompositionEvent("compositionend", {
      bubbles: true,
      data: "解释",
    }));
    await waitForStoryUpdate();
    assertStoryText(canvasElement, "还没有发送消息");

    singleLineInput.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
    }));
    await waitForStoryUpdate();
    assertStoryText(canvasElement, "还没有发送消息");

    singleLineInput.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      ctrlKey: true,
      bubbles: true,
    }));
    await waitForStoryUpdate();
    assertStoryText(canvasElement, "单行已发送：解释这句话");

    setTextareaValue(multiLineInput, "第一行\n第二行");
    await waitForStoryUpdate();
    multiLineInput.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
    }));
    await waitForStoryUpdate();
    assertStoryText(canvasElement, "单行已发送：解释这句话");

    multiLineInput.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      ctrlKey: true,
      bubbles: true,
    }));
    await waitForStoryUpdate();
    assertStoryText(canvasElement, "多行已发送：第一行\n第二行");

    singleLineInput.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    }));
    await waitForStoryUpdate();
    assertStoryText(canvasElement, "已取消单行消息");

    const singleLineComposer = canvasElement.querySelector<HTMLElement>(
      '[data-variant="single-line"]',
    );
    const quickPrompt = singleLineComposer?.querySelector<HTMLButtonElement>(
      '[data-message-composer-quick-prompt="什么意思"] button',
    );
    if (!quickPrompt) {
      throw new Error("单行模式缺少业务侧配置的快捷语言");
    }
    quickPrompt.click();
    await waitForStoryUpdate();
    assertStoryText(canvasElement, "单行已发送：解释一下这一段是什么意思?");
  },
};

export const States: Story = {
  name: "状态与边界",
  render: () => (
    <main className={styles.storyFrame}>
      <div className={styles.storyContent}>
        <div className={styles.stateGrid}>
          <section className={styles.example}>
            <h2 className={styles.heading}>发送中</h2>
            <MessageComposer
              value="正在发送的消息"
              ariaLabel="发送中的 AI 消息"
              loading
              onChange={() => undefined}
              onSubmit={() => undefined}
            />
          </section>
          <section className={styles.example}>
            <h2 className={styles.heading}>禁用</h2>
            <MessageComposer
              value=""
              ariaLabel="禁用的 AI 消息"
              disabled
              placeholder="当前不可发送消息"
              onChange={() => undefined}
              onSubmit={() => undefined}
            />
          </section>
        </div>
        <section className={styles.example}>
          <h2 className={styles.heading}>错误</h2>
          <MessageComposer
            variant="multi-line"
            value="请重新检查这一段。"
            ariaLabel="发送失败的 AI 消息"
            error="消息发送失败，请检查连接后重试。"
            onChange={() => undefined}
            onSubmit={() => undefined}
          />
        </section>
      </div>
    </main>
  ),
};
