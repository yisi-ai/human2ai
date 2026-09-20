import type { Meta, StoryObj } from "@storybook/react-webpack5";

import { assertStorySelector } from "../vendor/yisiui/storybook/interactionChecks";
import { CanvasNode } from "./CanvasNode";
import { CanvasPoint } from "./CanvasPoint";
import { CanvasScene } from "./CanvasScene";

import "./CanvasElements.stories.css";

const meta = {
  id: "human2ai-canvas-point",
  title: "human2ai/Canvas/Elements/Point",
  component: CanvasPoint,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CanvasPoint>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  name: "世界坐标中的点",
  args: { radius: 6 },
  render: () => (
    <main className="human2ai-canvas-story">
      <div className="human2ai-canvas-story__stage human2ai-canvas-story__stage--compact">
        <CanvasScene bounds={{ x: -320, y: -180, width: 640, height: 360 }} aria-label="点组件场景">
          <CanvasNode
            id="point-small"
            label="小点"
            x={-100}
            y={0}
            selected
            onDoubleClick={() => undefined}
          >
            <CanvasPoint radius={8} aria-label="小点" />
          </CanvasNode>
          <CanvasNode id="point-large" label="大点" x={100} y={0}>
            <CanvasPoint radius={18} className="human2ai-canvas-story__point--large" aria-label="大点" />
          </CanvasNode>
        </CanvasScene>
      </div>
    </main>
  ),
  play: async ({ canvasElement }) => {
    const points = canvasElement.querySelectorAll('[data-yisiui-asset="human2ai/canvas-point"]');
    if (points.length !== 2) throw new Error("CanvasPoint story must render both point sizes");
    assertStorySelector(canvasElement, '[data-canvas-node="point-large"]');
    const point = canvasElement.querySelector<SVGGElement>('[data-canvas-node="point-small"]');
    if (
      !point ||
      point.dataset.resizable !== "false" ||
      point.dataset.rotatable !== "false" ||
      point.querySelector("[data-resize-handle], [data-rotation-handle]")
    ) {
      throw new Error("CanvasPoint must not expose resize or rotation controls");
    }
  },
};
