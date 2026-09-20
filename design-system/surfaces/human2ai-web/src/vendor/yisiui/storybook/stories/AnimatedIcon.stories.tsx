import { PreviousRedrawnGlyph } from "./AnimatedIcon.previous";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useRef, useState } from "react";
import { AnimatedIcon, animatedIconCatalog, BasicButton, DecorativeTitle, type AnimatedIconHandle } from "@human2ai/ui/yisiui";
import styles from "./AnimatedIcon.stories.module.css";

function IconTile({ icon, playKey, loop, motion }: {
  icon: (typeof animatedIconCatalog)[number]; playKey: number; loop: boolean; motion: "auto" | "none";
}) {
  const ref = useRef<AnimatedIconHandle>(null);
  return (
    <button className={styles.tile} type="button" aria-label={`播放${icon.label}图标`} onClick={() => ref.current?.play()}>
      <AnimatedIcon ref={ref} name={icon.name} size={32} playKey={playKey} loop={loop} motion={motion} />
      <span className={styles.label}>{icon.label}</span>
      <span className={styles.description}>{icon.motion}</span>
    </button>
  );
}

function Gallery({ loop = false, motion = "auto" }: { loop?: boolean; motion?: "auto" | "none" }) {
  const [playKey, setPlayKey] = useState(0);
  return (
    <div className={styles.gallery}>
      <div className={styles.heading}>
        <div><h2>YisiUI 动效图标</h2><p>24 × 24 · 圆角线条 · 首尾复位</p></div>
        <BasicButton onClick={() => setPlayKey((key) => key + 1)}>播放全部</BasicButton>
      </div>
      <div className={styles.grid}>
        {animatedIconCatalog.map((icon) => <IconTile key={icon.name} icon={icon} playKey={playKey} loop={loop} motion={motion} />)}
      </div>
    </div>
  );
}

const meta = {
  id: "icons-animatedicon",
  title: "yisiui-Components/Icons/AnimatedIcon",
  component: AnimatedIcon,
  parameters: { layout: "centered" },
  argTypes: {
    name: { control: "select", options: animatedIconCatalog.map((icon) => icon.name) },
    size: { control: "number" }, duration: { control: "number" }, loop: { control: "boolean" },
    motion: { control: "radio", options: ["auto", "none"] },
    playKey: { control: "number", description: "改变数值触发重播；初始值不自动播放。" },
    label: { control: "text", description: "独立传达含义时填写，按钮内的装饰图标省略。" },
    onAnimationComplete: { control: false },
  },
  args: { name: "bell", size: 32, playKey: 0 },
} satisfies Meta<typeof AnimatedIcon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "十二个图标与单次播放",
  render: () => <Gallery />,
};
export const Loop: Story = {
  name: "循环与默认姿态",
  render: () => <Gallery loop />,
};
export const ReducedMotion: Story = {
  name: "关闭动效的静态回退",
  render: () => <Gallery loop motion="none" />,
};
export const Playground: Story = { name: "单图标参数调节" };

function IntegrationFixture() {
  const icon = useRef<AnimatedIconHandle>(null);
  const [playKey, setPlayKey] = useState(0);
  const [completed, setCompleted] = useState(0);
  return (
    <div className={styles.integration}>
      <DecorativeTitle as="h2" title="收藏灵感" icon={<AnimatedIcon name="star" playKey={playKey} />} />
      <div className={styles.actions}>
        <BasicButton mode="with-icon" icon={<AnimatedIcon ref={icon} name="send" onAnimationComplete={() => setCompleted((count) => count + 1)} />}
          onClick={() => { icon.current?.play(); setPlayKey((key) => key + 1); }}>播放发送图标</BasicButton>
        <BasicButton onClick={() => icon.current?.stop()}>停止并复位</BasicButton>
      </div>
      <p role="status">已完成 {completed} 次图标播放</p>
      <div className={styles.actions}>{[16, 20, 24, 32].map((size) => <AnimatedIcon key={size} name="upload" size={size} label={`${size}px 上传图标`} />)}</div>
    </div>
  );
}
export const Integration: Story = {
  name: "按钮与标题插槽接入",
  render: () => <IntegrationFixture />,
};

const REDRAWN_SAMPLES = [
  { name: "plus", label: "添加", detail: "圆头短臂 · 中心对称 · 整体轻弹" },
  { name: "send", label: "发送", detail: "参数化机身 · 共用曲线连接点 · 整体飞出" },
  { name: "refresh", label: "刷新", detail: "开放圆弧 · 实心箭头 · 整体回旋" },
  { name: "star", label: "收藏", detail: "饱满星角 · 放宽内弧 · 整体轻弹" },
  { name: "close", label: "关闭", detail: "紧凑交叉 · 圆头短臂 · 同步缩放" },
  { name: "upload", label: "上传", detail: "实心箭头 · 加厚底座 · 整体上行" },
  { name: "copy", label: "复制", detail: "舒展内圆角 · 柔化折角 · 前页轻移" },
  { name: "bell", label: "通知", detail: "圆弧穹顶 · 柔化底角 · 实心铃舌" },
] as const;

function PreviousSample({ name }: { name: (typeof REDRAWN_SAMPLES)[number]["name"] }) {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <PreviousRedrawnGlyph name={name} />
    </svg>
  );
}

function RedrawnSample({ sample, playKey, loop }: {
  sample: (typeof REDRAWN_SAMPLES)[number]; playKey: number; loop: boolean;
}) {
  const ref = useRef<AnimatedIconHandle>(null);
  return (
    <section className={styles.sample} aria-label={sample.label}>
      <div className={styles.sampleHeading}><h3>{sample.label}</h3><p>{sample.detail}</p></div>
      <div className={styles.comparison}>
        <div className={styles.pose}><span>上一版</span><PreviousSample name={sample.name} /></div>
        <div className={styles.pose}><span>重画 · 静态</span><AnimatedIcon name={sample.name} size={48} /></div>
        <button className={styles.motionPose} type="button" aria-label={`播放重画${sample.label}`} onClick={() => ref.current?.play()}>
          <span>重画 · 点击播放</span><AnimatedIcon ref={ref} name={sample.name} size={48} playKey={playKey} loop={loop} duration={1000} />
        </button>
      </div>
      <div className={styles.sizeStrip}>{[16, 20, 24, 32].map((size) => <span key={size}><AnimatedIcon name={sample.name} size={size} /><small>{size}px</small></span>)}</div>
    </section>
  );
}

function RedrawnFixture() {
  const [playKey, setPlayKey] = useState(0);
  const [loop, setLoop] = useState(false);
  return (
    <div className={styles.redrawn}>
      <div className={styles.heading}>
        <div><h2>参数化曲线 · 平滑转角</h2><p>用成对贝塞尔曲线计算转角，保留造型、实心细节与对称动作。</p></div>
        <div className={styles.actions}>
          <BasicButton onClick={() => setPlayKey((key) => key + 1)}>播放全部样板</BasicButton>
          <BasicButton aria-pressed={loop} onClick={() => setLoop((value) => !value)}>{loop ? "关闭循环" : "开启循环"}</BasicButton>
        </div>
      </div>
      {REDRAWN_SAMPLES.map((sample) => <RedrawnSample key={sample.name} sample={sample} playKey={playKey} loop={loop} />)}
    </div>
  );
}

export const RedrawnSamples: Story = {
  name: "整套重画：新旧与多尺寸对比",
  render: () => <RedrawnFixture />,
};

function NewIconsFixture() {
  const [playKey, setPlayKey] = useState(0);
  const [loop, setLoop] = useState(false);
  const icons = animatedIconCatalog.filter(icon => ["reset", "sidebar-left", "sidebar-right", "loading"].includes(icon.name));
  return <div className={styles.gallery}>
    <div className={styles.heading}>
      <div><h2>重置、侧栏与加载</h2><p>侧栏为镜像设计；加载圆弧支持匀速循环。</p></div>
      <div className={styles.actions}>
        <BasicButton onClick={() => setPlayKey(key => key + 1)}>播放新增图标</BasicButton>
        <BasicButton aria-pressed={loop} onClick={() => setLoop(value => !value)}>{loop ? "关闭循环" : "开启循环"}</BasicButton>
      </div>
    </div>
    <div className={styles.grid}>{icons.map(icon => <IconTile key={icon.name} icon={icon} playKey={playKey} loop={loop} motion="auto" />)}</div>
    {icons.map(icon => <section key={icon.name} className={styles.sample} aria-label={icon.label}>
      <div className={styles.sampleHeading}><h3>{icon.label}</h3><p>{icon.motion}</p></div>
      <div className={styles.sizeStrip}>{[16, 20, 24, 32, 48].map(size => <span key={size}><AnimatedIcon name={icon.name} size={size} /><small>{size}px</small></span>)}</div>
    </section>)}
  </div>;
}
export const NewIcons: Story = {
  name: "新增：重置、左右侧栏与加载",
  render: () => <NewIconsFixture />,
};
