import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { BulbOutlined, CompassOutlined, FireOutlined, StarOutlined } from "@ant-design/icons";
import { DecorativeTitle } from "@human2ai/ui/yisiui";

const meta = {
  id: "typography-decorativetitle",
  title: "yisiui-Components/Typography/DecorativeTitle",
  component: DecorativeTitle,
  parameters: { layout: "centered" },
  argTypes: {
    title: { control: "text", description: "单行标题；超出宽度显示省略号。" },
    variant: { control: "select", options: ["blue", "mint", "amber", "rose"] },
    pattern: { control: "select", options: ["arcs", "waves", "dots", "none"] },
    as: { control: "select", options: ["div", "h1", "h2", "h3", "h4", "h5", "h6"] },
    icon: { control: false },
    decoration: { control: false },
    colors: { control: "object", description: "覆盖边框、圆底色、背景、文字、图标和花纹颜色。" },
  },
  args: { title: "灵感时刻", icon: <BulbOutlined />, as: "h2" },
} satisfies Meta<typeof DecorativeTitle>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "默认装饰标题",
  play: ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>(".yisi-decorative-title")!;
    const icon = root.querySelector<HTMLElement>(".yisi-decorative-title-icon")!;
    const bounds = icon.getBoundingClientRect();
    const rootBounds = root.getBoundingClientRect();
    const styles = getComputedStyle(root);
    if (Math.abs(bounds.width - bounds.height) > 0.5) throw new Error("图标区域必须保持正圆");
    if (Math.abs(bounds.height - rootBounds.height) > 1 || Math.abs(bounds.left - rootBounds.left) > 1
      || Math.abs(bounds.top - rootBounds.top) > 1) throw new Error("左侧圆形必须覆盖并贴合标题条左端");
    if (parseFloat(styles.borderRightWidth) <= parseFloat(styles.borderLeftWidth)
      || parseFloat(styles.borderBottomWidth) <= parseFloat(styles.borderTopWidth)) {
      throw new Error("右侧和底部必须使用厚边框");
    }
    if (root.tagName !== "H2" || root.querySelector("[tabindex], button, a")) {
      throw new Error("标题应保留调用方指定的标题层级，不新增交互焦点");
    }
  },
};

export const Presets: Story = {
  name: "四组预设",
  render: () => (
    <div style={{ display: "grid", gap: 24, width: "min(420px, 85vw)" }}>
      <DecorativeTitle as="h2" title="灵感时刻" icon={<BulbOutlined />} variant="blue" />
      <DecorativeTitle as="h2" title="探索新方向" icon={<CompassOutlined />} variant="mint" />
      <DecorativeTitle as="h2" title="本周精选" icon={<StarOutlined />} variant="amber" />
      <DecorativeTitle as="h2" title="正在发生" icon={<FireOutlined />} variant="rose" />
    </div>
  ),
};

export const Custom: Story = {
  name: "自定义配色与花纹",
  args: {
    title: "收藏一点奇思妙想",
    icon: <StarOutlined />,
    colors: { border: "#6943a5", iconBackground: "#543684", background: "#f6f1fc", text: "#352249" },
    decoration: <svg viewBox="0 0 160 96" fill="none" aria-hidden="true" focusable="false"><path d="m85 8 8 25 26 1-21 16 7 26-20-16-22 16 8-26-21-16 27-1Z" stroke="currentColor" strokeWidth="2" /><circle cx="142" cy="70" r="24" stroke="currentColor" strokeWidth="2" /></svg>,
    style: { width: "min(420px, 85vw)" },
  },
};

export const BorderColor: Story = {
  name: "圆底色自动跟随厚边",
  args: { title: "一处改色，整体呼应", colors: { border: "#6943a5" }, style: { width: "min(420px, 85vw)" } },
};

export const LongTitle: Story = {
  name: "窄屏单行截断",
  args: { title: "把沿途遇见的奇思妙想整理成下一次创作的起点 SuperLongUnbrokenTitle", variant: "mint", style: { width: 240 } },
  play: ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>(".yisi-decorative-title")!;
    const icon = root.querySelector<HTMLElement>(".yisi-decorative-title-icon")!.getBoundingClientRect();
    const title = root.querySelector<HTMLElement>(".yisi-decorative-title-text")!;
    if (root.scrollWidth > root.clientWidth || Math.abs(icon.width - icon.height) > 0.5) {
      throw new Error("长标题不得溢出或挤压图标圆");
    }
    if (getComputedStyle(title).whiteSpace !== "nowrap" || getComputedStyle(title).textOverflow !== "ellipsis"
      || title.scrollWidth <= title.clientWidth) throw new Error("窄屏长标题必须单行截断");
  },
};

export const Plain: Story = {
  name: "无花纹与空图标槽",
  args: { title: "保持简单", pattern: "none", icon: null, variant: "amber" },
};
