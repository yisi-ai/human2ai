import { QuestionCircleOutlined } from "@ant-design/icons";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useRef, useState } from "react";

import { BasicButton, MessageComposer, type MessageComposerProps } from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";
import styles from "./MessageComposer.stories.module.css";

const EXAMPLE_QUICK_PROMPTS = [
  {
    icon: <QuestionCircleOutlined aria-hidden="true" />,
    label: "什么意思",
    message: "解释一下这一段是什么意思?",
  },
] as const;

const EXAMPLE_MESSAGE = "请检查这段论证中被省略的前提，并说明它为什么会影响结论。";
const EXAMPLE_ATTACHMENTS = ["项目背景说明.pdf", "本次访谈的完整记录.docx", "参考图片与设计说明.png"];
const LONG_MESSAGE = [
  "请根据下面的提纲整理一份说明：",
  ...Array.from({ length: 24 }, (_, index) => `第 ${index + 1} 项：说明当前问题、已有条件和下一步建议。`),
  "最后，请给出清晰的总结。",
].join("\n");

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

function InteractiveFixture({ starsEnabled = true, scrollbar = "dots", maxScrollDots = 12 }:
  Pick<MessageComposerProps, "starsEnabled" | "scrollbar" | "maxScrollDots">) {
  const [singleLineValue, setSingleLineValue] = useState("");
  const [multiLineValue, setMultiLineValue] = useState(LONG_MESSAGE);
  const [status, setStatus] = useState("还没有发送消息");

  return (
    <main className={styles.storyFrame}>
      <div className={styles.storyContent}>
        <div className={styles.exampleActions}>
          <BasicButton onClick={() => {
            setSingleLineValue(LONG_MESSAGE);
            setMultiLineValue(LONG_MESSAGE);
          }}>两种模式填入长消息</BasicButton>
          <BasicButton onClick={() => {
            setSingleLineValue("");
            setMultiLineValue(EXAMPLE_MESSAGE);
          }}>恢复短消息</BasicButton>
        </div>
        <section className={styles.example} aria-labelledby="single-line-title">
          <h2 id="single-line-title" className={styles.heading}>单行模式</h2>
          <p className={styles.description}>从一行自动增高到三行，超过后在输入区右侧显示圆点滚动条。点击上方按钮填入长消息，可查看紧凑间距、等大高亮和点击跳转；星星模式同时适用。</p>
          <MessageComposer
            variant="single-line"
            starsEnabled={starsEnabled}
            scrollbar={scrollbar}
            maxScrollDots={maxScrollDots}
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
          <p className={styles.description}>从三行自动增高到八行，长消息通过圆点跳转或滚轮浏览，当前位置只改变颜色，悬停圆点时拉长。星星背景避开文字和滚动按钮区域；底部发送和快捷区保持固定。</p>
          <MessageComposer
            variant="multi-line"
            starsEnabled={starsEnabled}
            scrollbar={scrollbar}
            maxScrollDots={maxScrollDots}
            topContentEnabled
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
  title: "yisiui-Modules/MessageComposer",
  component: MessageComposer,
  parameters: { layout: "fullscreen" },
  argTypes: {
    value: { control: "text" },
    variant: { control: "radio", options: ["single-line", "multi-line"] },
    surface: { control: "radio", options: ["standalone", "embedded"] },
    starsEnabled: {
      control: "boolean",
      description: "单行和多行共用的近黑灰色背景与白色圆点开关，由消费项目配置，默认关闭。",
      table: { defaultValue: { summary: "false" } },
    },
    scrollbar: {
      control: "radio", options: ["dots", "native"],
      description: "输入区默认使用圆点滚动条，仅在内容溢出时显示。",
      table: { defaultValue: { summary: "dots" } },
    },
    maxScrollDots: {
      control: { type: "number", min: 2, step: 1 },
      description: "圆点数量上限，实际数量还受可见高度限制。",
      table: { defaultValue: { summary: "12" } },
    },
    ariaLabel: { control: "text" },
    placeholder: { control: "text" },
    submitLabel: { control: "text" },
    onChange: { control: false },
    onSubmit: { control: false },
    onCancel: { control: false },
    quickPrompts: { control: false },
    topContent: { control: false },
    topContentEnabled: { control: "boolean", description: "开启且 topContent 非空时显示顶部容器；空内容不占位。" },
    topContentLabel: { control: "text" },
    uploadEnabled: { control: "boolean" },
    uploadLabel: { control: "text" },
    onUpload: { control: false },
    footer: { control: false },
    error: { control: false },
  },
} satisfies Meta<typeof MessageComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "单行与多行",
  args: { starsEnabled: true, scrollbar: "dots", maxScrollDots: 12 },
  render: (args) => <InteractiveFixture starsEnabled={args.starsEnabled} scrollbar={args.scrollbar} maxScrollDots={args.maxScrollDots} />,
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

    // Keep an overflowing draft visible for manual scroll navigation review.
    setTextareaValue(multiLineInput, LONG_MESSAGE);
    await waitForStoryUpdate();
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
              variant="multi-line"
              starsEnabled
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
              variant="multi-line"
              starsEnabled
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
            starsEnabled
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

function UploadFixture() {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState(EXAMPLE_ATTACHMENTS);
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <main className={styles.storyFrame}>
      <div className={styles.storyContent}>
        <p className={styles.description}>输入栏上内边距为 0；顶部插槽为空时，在组件顶部补回等量的 6px 留白。可切换附件查看两种状态。</p>
        <div className={styles.exampleActions}>
          <BasicButton onClick={() => setFiles(files.length ? [] : EXAMPLE_ATTACHMENTS)}>
            {files.length ? "清空顶部插槽" : "恢复顶部附件"}
          </BasicButton>
        </div>
      <input ref={fileInput} type="file" multiple hidden aria-label="选择附件"
        onChange={(event) => {
          setFiles(Array.from(event.target.files ?? [], (file) => file.name));
          event.target.value = "";
        }} />
      <MessageComposer
        variant="multi-line"
        starsEnabled
        style={{ width: "min(420px, 100%)" }}
        value={value}
        ariaLabel="带附件的消息"
        uploadEnabled
        onUpload={() => fileInput.current?.click()}
        onChange={setValue}
        onSubmit={() => setValue("")}
        quickPrompts={EXAMPLE_QUICK_PROMPTS}
        topContentEnabled
        topContentLabel="已选附件"
        topContent={files.map((name, index) => <span className={styles.attachment} key={`${name}:${index}`}>{name}</span>)}
      />
      </div>
    </main>
  );
}

export const UploadAndTopContent: Story = {
  name: "上传入口与顶部附件容器",
  render: () => <UploadFixture />,
  play: ({ canvasElement }) => {
    const top = canvasElement.querySelector<HTMLElement>("[data-message-composer-top-content]")!;
    const style = getComputedStyle(top);
    if (style.overflowX !== "auto" || style.scrollbarWidth !== "none" || top.scrollWidth <= top.clientWidth) {
      throw new Error("附件区应支持横向滚动且隐藏滚动条");
    }
    for (const selector of ["[data-message-composer-upload]", "[data-message-composer-submit]", "[data-message-composer-quick-prompt] button"]) {
      const button = canvasElement.querySelector<HTMLElement>(selector)!;
      const expectedHeight = 32;
      if (Math.abs(button.getBoundingClientRect().height - expectedHeight) > 0.5) throw new Error("底部操作尺寸与预期不符");
    }
  },
};

export const TopText: Story = {
  name: "顶部业务文字与关闭上传",
  render: () => (
    <main className={styles.storyFrame}>
      <MessageComposer ariaLabel="带上下文的消息" value="" onChange={() => undefined} onSubmit={() => undefined}
        topContentEnabled
        topContent={<span>当前引用：由业务项目提供的上下文说明，可以沿水平方向滚动查看完整内容。</span>}
        quickPrompts={EXAMPLE_QUICK_PROMPTS} />
    </main>
  ),
};
