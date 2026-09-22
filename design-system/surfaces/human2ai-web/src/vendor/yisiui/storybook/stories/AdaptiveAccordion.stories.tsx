import { QuestionCircleOutlined } from "@ant-design/icons";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";
import type { ReactNode } from "react";

import { AdaptiveAccordion, type AdaptiveAccordionItem } from "@human2ai/ui/yisiui";
import styles from "./AdaptiveAccordion.stories.module.css";

const QUESTIONS: readonly AdaptiveAccordionItem[] = [
  {
    key: "start",
    title: "如何开始使用？",
    content: <p>选择一个你感兴趣的主题，阅读说明后即可开始。你可以随时回来查看其他问题。</p>,
  },
  {
    key: "prepare",
    title: "开始之前，需要准备哪些资料？",
    content: <>
      <p>先整理与你当前目标有关的信息，不必一次准备齐全。</p>
      <ul>
        <li>写下一句清楚的目标说明。</li>
        <li>准备已有的文字、图片或参考链接。</li>
        <li>标记尚不确定的地方，后续逐项补充。</li>
      </ul>
      <p>这些内容可以逐步完善。先处理最重要的问题，通常比一次填写所有细节更容易推进。</p>
    </>,
  },
  {
    key: "save",
    title: "之后还可以修改吗？",
    content: <p>可以。保留当前资料，再根据新的信息更新内容即可。</p>,
  },
  {
    key: "help",
    title: "在哪里查看下一步说明？",
    content: <p>你可以先阅读本页的说明，再<a href="#accordion-next-step">查看下方提示</a>。内容里的链接可正常操作。</p>,
  },
];

function Frame({ children }: { children: ReactNode }) {
  return <main className={styles.frame}><div className={styles.container}>{children}</div></main>;
}

const meta = {
  id: "modules-adaptiveaccordion",
  title: "yisiui-Modules/AdaptiveAccordion",
  component: AdaptiveAccordion,
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "默认全部收起的竖向折叠列表。预留最高展开状态所需的总高度，切换时由标题区分配剩余空间；内容保持自然高度，标题字号与统一图标随可用空间适配。" } },
  },
  args: { items: QUESTIONS, ariaLabel: "常见问题", showIcon: true, minTitleFontSize: 16, maxTitleFontSize: 24 },
  argTypes: {
    items: { control: false },
    ariaLabel: { control: "text" },
    expandedKey: { control: false },
    defaultExpandedKey: { control: false },
    onExpandedChange: { control: false },
    icon: { control: false, description: "所有标题共用一个装饰图标，默认加号；不接收每项独立图标。" },
    showIcon: { control: "boolean" },
    minTitleFontSize: { control: { type: "number", min: 12, max: 32 } },
    maxTitleFontSize: { control: { type: "number", min: 16, max: 40 } },
    disabled: { control: "boolean" },
    emptyContent: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof AdaptiveAccordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "默认问答与稳定高度",
  render: (args) => <Frame>
    <h1 className={styles.heading}>常见问题</h1>
    <p className={styles.description}>默认全部收起。点击标题展开，点击其他标题切换，点击外部或按 Esc 收起。也可以使用方向键、Home 和 End 移动标题焦点。</p>
    <AdaptiveAccordion {...args} />
    <p id="accordion-next-step" className={styles.anchor}>下一步提示：切换上方问题时，这一行应保持在原来的位置。</p>
    <button type="button" className={styles.button}>组件外的操作</button>
  </Frame>,
};

export const UnifiedIcon: Story = {
  name: "统一问号图标与纯文字",
  render: (args) => <Frame>
    <h1 className={styles.heading}>统一图标</h1>
    <p className={styles.description}>同一个列表使用同一种图标。下面两个完整列表分别展示统一问号图标和关闭图标的排版。</p>
    <div className={styles.columns}>
      <AdaptiveAccordion {...args} ariaLabel="统一问号图标的问答" icon={<QuestionCircleOutlined />} />
      <AdaptiveAccordion {...args} ariaLabel="不带图标的问答" showIcon={false} />
    </div>
  </Frame>,
};

function ResponsiveFixture() {
  const [width, setWidth] = useState(520);
  const [description, setDescription] = useState("先明确目标，再整理已有资料。\n遇到需要补充的信息，可以先记录下来，稍后再逐项完善。\n即使文字变长或容器变窄，内容也会自然换行，组件会重新计算适合所有项目的总高度。");
  const items: AdaptiveAccordionItem[] = [
    { key: "short", title: "从哪一步开始？", content: <p>先选择一个最容易开始的小目标。</p> },
    { key: "details", title: "如果还没有准备好完整资料，并且需要与其他人一起补充说明，应该如何开始？", content: description.split("\n").map((line, index) => <p key={index}>{line || "\u00a0"}</p>) },
    { key: "later", title: "可以分几次完成吗？", content: <p>可以按自己的节奏处理。标题可以换行，展开内容也不会被截断。</p> },
  ];
  return <Frame>
    <h1 className={styles.heading}>宽度与内容变化</h1>
    <label className={styles.field}>容器宽度：{width}px
      <input type="range" min={280} max={720} value={width} onChange={(event) => setWidth(Number(event.target.value))} />
    </label>
    <label className={styles.field}>修改第二项的说明
      <textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
    </label>
    <div style={{ width, maxWidth: "100%" }}>
      <AdaptiveAccordion items={items} ariaLabel="可调整内容的问答" defaultExpandedKey="details" />
    </div>
    <p className={styles.anchor}>宽度或内容变化时重新计算；在当前条件下切换项目时，总高度保持一致。</p>
  </Frame>;
}

export const ResponsiveContent: Story = {
  name: "窄宽度、长标题与动态内容",
  render: () => <ResponsiveFixture />,
};

function StateFixture() {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  return <Frame>
    <h1 className={styles.heading}>受控展开与内容操作</h1>
    <div className={styles.actions}>
      <button className={styles.button} type="button" onClick={() => setExpandedKey("action")}>展开操作说明</button>
      <button className={styles.button} type="button" onClick={() => setExpandedKey(null)}>全部收起</button>
    </div>
    <AdaptiveAccordion
      ariaLabel="受控说明列表"
      expandedKey={expandedKey}
      onExpandedChange={setExpandedKey}
      items={[
        { key: "action", title: "内容里的按钮可以正常使用吗？", content: <>
          <p>可以。点击下面的按钮会更新计数，当前内容仍保持展开。收起再打开，计数也会保留。</p>
          <button className={styles.button} type="button" onClick={() => setCount((value) => value + 1)}>已操作 {count} 次</button>
        </> },
        { key: "disabled", title: "这项说明暂不可用", content: <p>由消费项目决定何时启用。</p>, disabled: true },
        { key: "keyboard", title: "如何使用键盘？", content: <p>Tab 到达标题，Enter 或空格展开。方向键可以移动到其他可用标题；Esc 收起并将焦点放回标题。</p> },
      ]}
    />
    <div className={styles.columns}>
      <section><h2 className={styles.subheading}>整体禁用</h2><AdaptiveAccordion items={QUESTIONS.slice(0, 2)} ariaLabel="禁用的说明列表" disabled /></section>
      <section><h2 className={styles.subheading}>空列表</h2><AdaptiveAccordion items={[]} ariaLabel="空的说明列表" emptyContent={<p>暂无说明内容。</p>} /></section>
    </div>
  </Frame>;
}

export const ControlledAndStates: Story = {
  name: "受控操作、禁用与空列表",
  render: () => <StateFixture />,
};
