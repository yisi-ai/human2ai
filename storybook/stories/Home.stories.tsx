import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Human2AiAppShell } from "@human2ai/ui";

import { HomeView } from "../../web/components/HomeView";
import en from "../../locales/en/common.json";
import zh from "../../locales/zh-CN/common.json";

const meta = {
  title: "human2ai/Pages/Home",
  component: HomeView,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => (
    <Human2AiAppShell title={zh.app.title} sidebar={null}>
      <Story />
    </Human2AiAppShell>
  )],
  args: {
    labels: {
      composition: zh.home.createComposition,
      "ui-sketch": zh.home.createUiSketch,
      spatial: zh.home.createSpatial,
    },
    onCreate: () => undefined,
  },
} satisfies Meta<typeof HomeView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const buttons = [...canvasElement.querySelectorAll<HTMLButtonElement>("main button")];
    if (buttons.length !== 3) throw new Error("Home must offer three creation actions");
    const bounds = buttons.map(button => button.getBoundingClientRect());
    if (bounds.some(box => box.height <= box.width || Math.abs(box.top - bounds[0].top) > 1)) {
      throw new Error("Home cards must be portrait cards in one row");
    }
    for (const label of Object.values(args.labels)) {
      if (!buttons.some(button => button.textContent?.includes(label))) {
        throw new Error(`Missing creation action: ${label}`);
      }
    }
  },
};

export const Creating: Story = {
  args: { pending: "composition" },
  play: async ({ canvasElement }) => {
    const buttons = [...canvasElement.querySelectorAll<HTMLButtonElement>("main button")];
    if (buttons.some(button => !button.disabled)) throw new Error("Creation must prevent duplicate clicks");
    if (buttons.filter(button => button.getAttribute("aria-busy") === "true").length !== 1) {
      throw new Error("Only the selected creation action should be busy");
    }
  },
};

export const Failed: Story = { args: { errorMessage: zh.errors.operationFailed } };

export const English: Story = {
  args: {
    labels: {
      composition: en.home.createComposition,
      "ui-sketch": en.home.createUiSketch,
      spatial: en.home.createSpatial,
    },
  },
};
