import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  ResizableCollapseGroup,
  type ResizableCollapseGroupProps,
  type ResizableCollapseItem,
  type ResizableCollapseSizes,
} from "@human2ai/ui/yisiui";

import styles from "./ResizableCollapseGroup.stories.module.css";

function Properties() {
  const [count, setCount] = useState(0);
  return <div className={styles.content}>
    <label className={styles.field}>名称<input defaultValue="新的页面" /></label>
    <label className={styles.field}>布局<select defaultValue="vertical"><option value="vertical">竖向布局</option><option value="horizontal">横向布局</option></select></label>
    <button type="button" className={styles.button} onClick={() => setCount((value) => value + 1)}>已操作 {count} 次</button>
    <p className={styles.hint}>收起后再展开，输入内容和计数都会保留。</p>
  </div>;
}

const ITEMS: readonly ResizableCollapseItem[] = [
  { key: "resources", title: "资源列表", minHeight: 80, content: <ul className={styles.list}>
    {Array.from({ length: 24 }, (_, index) => <li key={index}><button type="button">页面 {String(index + 1).padStart(2, "0")}</button></li>)}
  </ul> },
  { key: "properties", title: "属性设置", content: <Properties /> },
  { key: "notes", title: "备注", content: <div className={styles.content}>
    <label className={styles.field}>当前任务<textarea rows={4} defaultValue="在这里记录待办事项，或填写下一步需要处理的内容。" /></label>
  </div> },
];

function Frame({ children }: { children: ReactNode }) {
  return <main className={styles.frame}><div className={styles.container}>{children}</div></main>;
}

const meta = {
  id: "modules-resizablecollapsegroup",
  title: "yisiui-Modules/ResizableCollapseGroup",
  component: ResizableCollapseGroup,
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "占满父容器高度的竖向折叠组。各项独立展开，拖动项间空隙调整上下两个已展开项的高度；标题栏使用浅色背景和顶部圆角。子项默认使用圆点滚动条，当前区域高亮，悬停拉长，点击跳转，收起后保留内容状态。" } },
  },
  args: { items: ITEMS, ariaLabel: "功能面板", defaultSizes: { resources: 2, properties: 1.5, notes: 1 }, minPanelHeight: 64, scrollbar: "dots", maxScrollDots: 12 },
  argTypes: {
    items: { control: false },
    ariaLabel: { control: "text" },
    expandedKeys: { control: false },
    defaultExpandedKeys: { control: false },
    onExpandedChange: { control: false },
    sizes: { control: false },
    defaultSizes: { control: "object", description: "初始内容高度比例；缺失项为 1，数值须为正数。" },
    onSizesChange: { control: false },
    onResizeEnd: { control: false },
    minPanelHeight: { control: { type: "number", min: 16, max: 160 } },
    scrollbar: { control: "inline-radio", options: ["dots", "native"], description: "各子项内容区的滚动条模式。" },
    maxScrollDots: { control: { type: "number", min: 2, max: 24 } },
    resizable: { control: "boolean" },
    disabled: { control: "boolean" },
    resizeLabel: { control: false },
    emptyContent: { control: false },
  },
} satisfies Meta<typeof ResizableCollapseGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "多个功能面板与独立折叠",
  render: (args) => <Frame>
    <h1 className={styles.heading}>功能面板</h1>
    <p className={styles.description}>点击标题独立折叠，拖动面板间的空隙调整高度。子项右侧圆点表示滚动位置，悬停拉长，点击跳转。Tab 聚焦拖动区域后，可用上下方向键调整，Shift 加速，Home / End 到达最小或最大位置。</p>
    <div className={styles.panel} style={{ height: 600 }}><ResizableCollapseGroup {...args} /></div>
    <p className={styles.hint}>下方位置固定：折叠、展开和拖动均不会改变组件的总高度。</p>
  </Frame>,
};

export const CollapsedBetweenPanels: Story = {
  name: "跨收起项调整与全部收起",
  render: (args) => <Frame>
    <h1 className={styles.heading}>保留标题，分配剩余高度</h1>
    <p className={styles.description}>左侧收起中间项，拖动资源列表下方的拖动区域会调整资源列表与备注的高度。右侧全部收起，展开任意一项即可占满剩余空间。</p>
    <div className={styles.columns}>
      <div className={styles.panel} style={{ height: 520 }}><ResizableCollapseGroup {...args} defaultExpandedKeys={["resources", "notes"]} /></div>
      <div className={styles.panel} style={{ height: 520 }}><ResizableCollapseGroup {...args} ariaLabel="初始全部收起的面板" defaultExpandedKeys={[]} /></div>
    </div>
  </Frame>,
};

function ResponsiveFixture(props: ResizableCollapseGroupProps) {
  const [height, setHeight] = useState(540);
  const [width, setWidth] = useState(380);
  const items = ITEMS.map((item, index) => index === 0 ? { ...item, title: "资源列表：当前项目中正在整理的页面、参考资料和其他内容" } : item);
  return <Frame>
    <h1 className={styles.heading}>跟随父容器尺寸</h1>
    <label className={styles.field}>父容器高度 {height}px<input type="range" min={160} max={820} value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label>
    <label className={styles.field}>父容器宽度 {width}px<input type="range" min={240} max={620} value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label>
    <p className={styles.description}>先调整面板比例，再改变父容器高度，观察各子项圆点数量和高亮位置随之更新。空间不足以容纳标题和最小内容高度时，仅在组内滚动。</p>
    <div className={styles.panel} style={{ height, width }}><ResizableCollapseGroup {...props} items={items} /></div>
  </Frame>;
}

export const ResponsiveContainer: Story = {
  name: "父容器缩放与最小高度",
  render: (args) => <ResponsiveFixture {...args} />,
};

function ControlledFixture() {
  const [expandedKeys, setExpandedKeys] = useState<readonly string[]>(["resources", "properties"]);
  const [sizes, setSizes] = useState<ResizableCollapseSizes>({ resources: 2, properties: 1, notes: 1 });
  return <Frame>
    <h1 className={styles.heading}>受控配置</h1>
    <div className={styles.actions}>
      <button type="button" className={styles.button} onClick={() => setExpandedKeys(ITEMS.map((item) => item.key))}>展开全部</button>
      <button type="button" className={styles.button} onClick={() => setExpandedKeys([])}>收起全部</button>
      <button type="button" className={styles.button} onClick={() => setSizes({ resources: 1, properties: 1, notes: 1 })}>等分内容高度</button>
    </div>
    <div className={styles.columns}>
      <div className={styles.panel} style={{ height: 560 }}>
        <ResizableCollapseGroup items={ITEMS} ariaLabel="受控功能面板" expandedKeys={expandedKeys}
          onExpandedChange={setExpandedKeys} sizes={sizes} onSizesChange={setSizes} />
      </div>
      <div className={styles.stateColumn}>
        <p className={styles.hint}>当前展开：{expandedKeys.join("、") || "无"}</p>
        <p className={styles.hint}>内容比例：{ITEMS.map((item) => `${item.title} ${(sizes[item.key] ?? 1).toFixed(2)}`).join(" / ")}</p>
        <div style={{ height: 230 }}><ResizableCollapseGroup ariaLabel="带禁用项的面板" items={[
          { key: "enabled", title: "可用功能", content: <p className={styles.content}>这一项可以正常折叠。</p> },
          { key: "locked", title: "暂不可用", content: null, disabled: true },
        ]} defaultExpandedKeys={["enabled"]} /></div>
        <div style={{ height: 100 }}><ResizableCollapseGroup items={[]} ariaLabel="空面板组" emptyContent="暂无功能面板" /></div>
      </div>
    </div>
  </Frame>;
}

export const ControlledAndStates: Story = {
  name: "受控比例、禁用与空状态",
  render: () => <ControlledFixture />,
};
