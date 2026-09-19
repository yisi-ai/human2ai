import type { Meta, StoryObj } from "@storybook/react-webpack5";

import { assertStorySelector } from "../vendor/yisiui/storybook/interactionChecks";
import { CanvasScene } from "./CanvasScene";

import "./CanvasElements.stories.css";

const BOUNDS = { x: -400, y: -260, width: 800, height: 520 };

const meta = {
  id: "human2ai-canvas-scene",
  title: "human2ai/Canvas/Foundation/CanvasScene",
  component: CanvasScene,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CanvasScene>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WorldBounds: Story = {
  name: "有符号世界范围",
  args: {
    bounds: BOUNDS,
    children: (
      <>
        <line className="human2ai-canvas-story__axis" x1={-400} y1={0} x2={400} y2={0} />
        <line className="human2ai-canvas-story__axis" x1={0} y1={-260} x2={0} y2={260} />
        <text className="human2ai-canvas-story__label" x={16} y={28}>世界原点</text>
      </>
    ),
    "aria-label": "画布世界场景",
  },
  render: (args) => (
    <main className="human2ai-canvas-story">
      <div className="human2ai-canvas-story__stage">
        <CanvasScene {...args} className="human2ai-canvas-story__scene" />
      </div>
    </main>
  ),
  play: async ({ canvasElement }) => {
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="human2ai/canvas-scene"]',
    );
    const scene = canvasElement.querySelector<SVGSVGElement>(
      '[data-yisiui-asset="human2ai/canvas-scene"]',
    );
    if (!scene) throw new Error("CanvasScene story is missing its scene");
    if (scene.getAttribute("viewBox") !== "-400 -260 800 520") {
      throw new Error("CanvasScene did not preserve signed world bounds");
    }
  },
};
