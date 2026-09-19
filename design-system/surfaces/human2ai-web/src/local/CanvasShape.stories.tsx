import type { Meta, StoryObj } from "@storybook/react-webpack5";

import { assertStorySelector } from "../vendor/yisiui/storybook/interactionChecks";
import { CanvasNode } from "./CanvasNode";
import { CanvasScene } from "./CanvasScene";
import { CanvasShape } from "./CanvasShape";

import "./CanvasElements.stories.css";

const meta = {
  id: "human2ai-canvas-shape",
  title: "human2ai/Canvas/Elements/Shape",
  component: CanvasShape,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CanvasShape>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllShapes: Story = {
  name: "圆形、椭圆、三角形和矩形",
  args: { type: "circle", size: 120 },
  render: () => (
    <main className="human2ai-canvas-story">
      <div className="human2ai-canvas-story__stage human2ai-canvas-story__stage--compact">
        <CanvasScene bounds={{ x: -460, y: -180, width: 920, height: 360 }} aria-label="图形组件场景">
          <CanvasNode id="circle" label="圆形" x={-330} y={0}>
            <CanvasShape type="circle" size={128} className="human2ai-canvas-story__shape--sage" />
          </CanvasNode>
          <CanvasNode id="ellipse" label="椭圆" x={-110} y={0}>
            <CanvasShape type="circle" width={170} height={108} className="human2ai-canvas-story__shape--sage" />
          </CanvasNode>
          <CanvasNode id="triangle" label="三角形" x={110} y={0} rotation={12}>
            <CanvasShape type="triangle" width={150} height={132} className="human2ai-canvas-story__shape--amber" />
          </CanvasNode>
          <CanvasNode id="rectangle" label="矩形" x={330} y={0} rotation={-8}>
            <CanvasShape type="rectangle" width={180} height={112} className="human2ai-canvas-story__shape--rose" />
          </CanvasNode>
        </CanvasScene>
      </div>
    </main>
  ),
  play: async ({ canvasElement }) => {
    for (const type of ["circle", "triangle", "rectangle"]) {
      assertStorySelector(canvasElement, `[data-shape-type="${type}"]`);
    }
    if (canvasElement.querySelectorAll('[data-shape-type="circle"]').length !== 2) {
      throw new Error("CanvasShape must render both circle and freely resized ellipse geometry");
    }
  },
};
