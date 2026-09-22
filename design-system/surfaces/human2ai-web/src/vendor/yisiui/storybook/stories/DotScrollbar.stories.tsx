import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DotScrollbar, type DotScrollbarProps } from "@human2ai/ui/yisiui";

import styles from "./DotScrollbar.stories.module.css";

function Frame({ children }: { children: ReactNode }) {
  return <main className={styles.frame}><div className={styles.container}>{children}</div></main>;
}

function ScrollFixture({ height = 360, pages = 5, pageHeight = 360, short = false, ...props }:
  DotScrollbarProps & { height?: number; pages?: number; pageHeight?: number; short?: boolean }) {
  const targetRef = useRef<HTMLDivElement>(null);
  const id = useId();
  return <div className={styles.scrollFrame} style={{ height }}>
    <div ref={targetRef} id={id} className={styles.viewport} tabIndex={0} role="region" aria-label="示例正文">
      <div>
        {short ? <p className={styles.short}>这段内容没有超出可视区域，因此右侧不显示圆点。</p>
          : Array.from({ length: pages }, (_, index) => <section key={index} className={styles.page} style={{ minHeight: pageHeight }}>
            <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
            <h2>第 {index + 1} 段内容</h2>
            <p>滚动查看下一段，或点击右侧的圆点跳转。当前区域的圆点会高亮。</p>
            <p>每个圆点的点击区域保持固定，悬停时圆点拉长，其他圆点的位置不变。</p>
          </section>)}
      </div>
    </div>
    <DotScrollbar {...props} targetRef={targetRef} />
  </div>;
}

const meta = {
  id: "switching-dotscrollbar",
  title: "yisiui-Components/Switching/DotScrollbar",
  component: DotScrollbar,
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "绑定现有纵向滚动容器的圆点滚动条。按内容屏数生成圆点，当前区域高亮，悬停拉长，点击平滑跳转；数量受上限和可用高度约束，内容不足一屏时隐藏。" } },
  },
  args: { targetRef: { current: null }, ariaLabel: "正文滚动位置", maxDots: 12, hideNativeScrollbar: true, behavior: "smooth", disabled: false },
  argTypes: {
    targetRef: { control: false, table: { disable: true } },
    ariaLabel: { control: "text" },
    maxDots: { control: { type: "number", min: 2, max: 24 } },
    hideNativeScrollbar: { control: "boolean" },
    behavior: { control: "inline-radio", options: ["smooth", "auto"] },
    disabled: { control: "boolean" },
    dotColor: { control: "color" },
    activeColor: { control: "color" },
    getDotLabel: { control: false },
  },
} satisfies Meta<typeof DotScrollbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "按屏生成圆点与点击跳转",
  render: (args) => <Frame>
    <h1 className={styles.heading}>圆点滚动条</h1>
    <p className={styles.description}>默认示例为五屏内容，圆点紧密排列，高亮时保持原大小。试试滚轮、点击圆点，以及 Tab 聚焦后使用上下方向键、Home / End 跳转。</p>
    <ScrollFixture {...args} />
  </Frame>,
};

function ResponsiveFixture(props: DotScrollbarProps) {
  const [height, setHeight] = useState(300);
  const [pages, setPages] = useState(24);
  return <Frame>
    <h1 className={styles.heading}>长内容与容器变化</h1>
    <p className={styles.description}>内容较长或显示区域较矮时，合并圆点对应的滚动范围。最后一个圆点始终到达底部。</p>
    <label className={styles.field}>显示高度 {height}px<input type="range" min={64} max={600} value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label>
    <div className={styles.actions}>
      <button type="button" onClick={() => setPages((value) => value + 4)}>增加内容</button>
      <button type="button" onClick={() => setPages((value) => Math.max(1, value - 4))}>减少内容</button>
      <span>当前 {pages} 段</span>
    </div>
    <ScrollFixture {...props} height={height} pages={pages} pageHeight={240} />
  </Frame>;
}

export const ResponsiveLongContent: Story = {
  name: "长内容压缩与动态高度",
  args: { maxDots: 8 },
  render: (args) => <ResponsiveFixture {...args} />,
};

export const ShortContent: Story = {
  name: "不足一屏时自动隐藏",
  render: (args) => <Frame>
    <h1 className={styles.heading}>短内容</h1>
    <ScrollFixture {...args} short height={240} />
  </Frame>,
};

export const NativeAndDisabled: Story = {
  name: "保留原生滚动条与禁用导航",
  render: (args) => <Frame>
    <h1 className={styles.heading}>按需附加圆点导航</h1>
    <div className={styles.columns}>
      <section><h2 className={styles.subheading}>保留原生滚动条</h2><ScrollFixture {...args} hideNativeScrollbar={false} /></section>
      <section><h2 className={styles.subheading}>禁用圆点操作</h2><ScrollFixture {...args} disabled /><p className={styles.description}>正文仍可通过滚轮滚动。</p></section>
    </div>
  </Frame>,
};
