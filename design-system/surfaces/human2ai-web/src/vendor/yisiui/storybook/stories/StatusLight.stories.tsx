import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Flex, Typography } from "antd";

import {
  STATUS_LIGHT_BACKGROUND_MODES,
  STATUS_LIGHT_COLORS,
  StatusLight,
  type StatusLightBackgroundMode,
  type StatusLightColor,
} from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

const meta = {
  id: "components-status-statuslight",
  title: "Components/States/StatusLight",
  component: StatusLight,
  parameters: { layout: "padded" },
  argTypes: {
    activeColor: {
      control: "radio",
      options: STATUS_LIGHT_COLORS,
      description: "指定当前亮起的灯，固定顺序为绿、黄、红。",
    },
    motion: {
      control: "radio",
      options: ["steady", "blink"],
      description: "常亮或让当前灯闪烁；系统开启 reduced-motion 时自动停用闪烁。",
    },
    backgroundMode: {
      control: "radio",
      options: STATUS_LIGHT_BACKGROUND_MODES,
      description: "状态灯底色模式；none 为无底色，dark 为黑底色。默认无底色。",
    },
    className: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof StatusLight>;

export default meta;
type Story = StoryObj<typeof meta>;

const COLOR_LABELS: Record<StatusLightColor, string> = {
  green: "绿灯",
  yellow: "黄灯",
  red: "红灯",
};

export const Default: Story = {
  name: "绿灯常亮",
  args: { activeColor: "green", motion: "steady", backgroundMode: "none" },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/status-light"]');
    assertStorySelector(canvasElement, ".yisi-status-light-lamp-green.yisi-status-light-lamp-active");
    assertStorySelector(canvasElement, ".yisi-status-light-background-none");
  },
};

export const BackgroundModes: Story = {
  name: "底色模式",
  render: () => (
    <Flex align="flex-start" gap={20}>
      {(["none", "dark"] as StatusLightBackgroundMode[]).map((backgroundMode) => (
        <Flex key={backgroundMode} vertical align="center" gap={8}>
          <StatusLight activeColor="yellow" backgroundMode={backgroundMode} />
          <Typography.Text type="secondary">
            {backgroundMode === "none" ? "无底色" : "黑底色"}
          </Typography.Text>
        </Flex>
      ))}
    </Flex>
  ),
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, ".yisi-status-light-background-none");
    assertStorySelector(canvasElement, ".yisi-status-light-background-dark");
    const plainLamp = canvasElement.querySelector<HTMLElement>(
      ".yisi-status-light-background-none .yisi-status-light-lamp-yellow.yisi-status-light-lamp-active",
    );
    const darkLamp = canvasElement.querySelector<HTMLElement>(
      ".yisi-status-light-background-dark .yisi-status-light-lamp-yellow.yisi-status-light-lamp-active",
    );
    if (!plainLamp || !darkLamp) {
      throw new Error("StatusLight background modes story should render active yellow lamps.");
    }
    if (getComputedStyle(plainLamp).backgroundColor === getComputedStyle(darkLamp).backgroundColor) {
      throw new Error("StatusLight yellow should use the requested no-background color.");
    }
  },
};

export const Colors: Story = {
  name: "三种颜色",
  render: () => (
    <Flex align="flex-start" gap={20}>
      {STATUS_LIGHT_COLORS.map((color) => (
        <Flex key={color} vertical align="center" gap={8}>
          <StatusLight activeColor={color} aria-label={`${COLOR_LABELS[color]}状态灯`} />
          <Typography.Text type="secondary">{COLOR_LABELS[color]}</Typography.Text>
        </Flex>
      ))}
    </Flex>
  ),
  play: ({ canvasElement }) => {
    assertStoryText(canvasElement, "绿灯");
    assertStoryText(canvasElement, "黄灯");
    assertStoryText(canvasElement, "红灯");
    const lights = canvasElement.querySelectorAll('[data-yisiui-asset="yisiui/status-light"]');
    if (lights.length !== STATUS_LIGHT_COLORS.length) {
      throw new Error("StatusLight colors story should render green, yellow, and red examples");
    }
  },
};

export const Blinking: Story = {
  name: "黄灯闪烁",
  args: { activeColor: "yellow", motion: "blink", backgroundMode: "none" },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, ".yisi-status-light-motion-blink");
    assertStorySelector(canvasElement, ".yisi-status-light-lamp-yellow.yisi-status-light-lamp-active");
  },
};
