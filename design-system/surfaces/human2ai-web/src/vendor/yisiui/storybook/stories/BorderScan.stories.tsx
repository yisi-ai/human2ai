import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Flex, Typography } from "antd";

import {
  BORDER_SCAN_DIRECTIONS,
  BorderScan,
} from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

const meta = {
  id: "motion-borderscan",
  title: "yisiui-Components/Motion/BorderScan",
  component: BorderScan,
  parameters: { layout: "padded" },
  argTypes: {
    active: { control: "boolean", description: "是否显示并运行边框扫光。" },
    width: { control: { type: "number", min: 20 }, description: "固定宽度，单位 px。" },
    height: { control: { type: "number", min: 20 }, description: "固定高度，单位 px。" },
    color: { control: "color", description: "扫光线条颜色。" },
    duration: { control: { type: "number", min: 200 }, description: "完成一圈运动的毫秒数。" },
    lineWidth: { control: { type: "number", min: 1 }, description: "扫光线宽，单位 px。" },
    lineLength: { control: { type: "number", min: 1 }, description: "扫光线段目标长度，单位 px。" },
    borderRadius: { control: { type: "number", min: 0 }, description: "与被包装组件一致的圆角半径，单位 px。" },
    direction: { control: "radio", options: BORDER_SCAN_DIRECTIONS, description: "顺时针或逆时针运动。" },
    children: { control: false },
    className: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof BorderScan>;

export default meta;
type Story = StoryObj<typeof meta>;

function DemoSurface({ label }: { label: string }) {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: "100%",
        height: "100%",
        border: "1px solid var(--yisiui-color-border-default)",
        borderRadius: 8,
        background: "var(--yisiui-color-surface-panel)",
        boxShadow: "var(--yisiui-component-card-shadow)",
        padding: 20,
      }}
    >
      <Typography.Text strong>{label}</Typography.Text>
    </div>
  );
}

export const Default: Story = {
  name: "默认扫光",
  args: {
    active: true,
    width: 520,
    height: 120,
    borderRadius: 8,
    direction: "clockwise",
    children: <DemoSurface label="边框扫光" />,
  },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/border-scan"]');
    assertStorySelector(canvasElement, ".yisi-border-scan-overlay");
    assertStorySelector(canvasElement, ".yisi-border-scan-line");
    assertStoryText(canvasElement, "边框扫光");
    const root = canvasElement.querySelector<HTMLElement>('[data-yisiui-asset="yisiui/border-scan"]');
    const overlay = root?.querySelector("svg");
    if (root?.style.width !== "520px" || root.style.height !== "120px") {
      throw new Error("BorderScan must use its explicit fixed width and height props.");
    }
    if (overlay?.getAttribute("viewBox") !== "0 0 520 120") {
      throw new Error("BorderScan SVG viewBox must match its fixed geometry.");
    }
    if (root.querySelectorAll(".yisi-border-scan-line").length !== 1) {
      throw new Error("BorderScan must render exactly one visible scan path.");
    }
  },
};

export const FixedSizes: Story = {
  name: "固定宽高组合",
  render: () => (
    <Flex gap={24} wrap align="flex-start">
      <BorderScan width={560} height={96} borderRadius={8}>
        <DemoSurface label="横向 560 × 96" />
      </BorderScan>
      <BorderScan width={180} height={320} borderRadius={8} color="#13A8A8">
        <DemoSurface label="竖向 180 × 320" />
      </BorderScan>
      <BorderScan width={220} height={220} borderRadius={8} color="#722ED1">
        <DemoSurface label="方形 220 × 220" />
      </BorderScan>
    </Flex>
  ),
  play: ({ canvasElement }) => {
    const scans = canvasElement.querySelectorAll('[data-yisiui-asset="yisiui/border-scan"]');
    if (scans.length !== 3) {
      throw new Error("BorderScan fixed-size story should render three size variants.");
    }
    const expectedViewBoxes = ["0 0 560 96", "0 0 180 320", "0 0 220 220"];
    scans.forEach((scan, index) => {
      if (scan.querySelector("svg")?.getAttribute("viewBox") !== expectedViewBoxes[index]) {
        throw new Error(`BorderScan fixed geometry mismatch at variant ${index}.`);
      }
      if (scan.querySelectorAll(".yisi-border-scan-line").length !== 1) {
        throw new Error(`BorderScan variant ${index} must have exactly one visible scan path.`);
      }
    });
    assertStoryText(canvasElement, "横向 560 × 96");
    assertStoryText(canvasElement, "竖向 180 × 320");
  },
};

export const Inactive: Story = {
  name: "关闭动效",
  args: {
    active: false,
    width: 420,
    height: 100,
    borderRadius: 8,
    children: <DemoSurface label="普通边框" />,
  },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, ".yisi-border-scan-inactive");
    if (canvasElement.querySelector(".yisi-border-scan-overlay")) {
      throw new Error("Inactive BorderScan must not render the scan overlay.");
    }
  },
};
