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
        <div><h2>YisiUI 动效图标</h2><p>24 × 24 · 各具含义的动态反馈 · 首尾复位</p></div>
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
  name: "十六个图标与单次播放",
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
