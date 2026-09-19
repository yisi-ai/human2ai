import type { Meta, StoryObj } from "@storybook/react-webpack5";

import { assertStorySelector } from "../vendor/yisiui/storybook/interactionChecks";
import { CanvasLine } from "./CanvasLine";
import { CanvasScene } from "./CanvasScene";

import "./CanvasElements.stories.css";

const BOUNDS = { x: -360, y: -180, width: 720, height: 360 };

const meta = {
  id: "human2ai-canvas-line",
  title: "human2ai/Canvas/Elements/Line",
  component: CanvasLine,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CanvasLine>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LineTypes: Story = {
  name: "无限线和指向线",
  args: {
    type: "infinite",
    anchor: { x: 0, y: 0 },
    angle: 18,
    bounds: BOUNDS,
  },
  render: () => (
    <main className="human2ai-canvas-story">
      <div className="human2ai-canvas-story__stage human2ai-canvas-story__stage--compact">
        <CanvasScene bounds={BOUNDS} aria-label="线条组件场景">
          <CanvasLine
            type="infinite"
            anchor={{ x: 0, y: -54 }}
            angle={18}
            bounds={BOUNDS}
            className="human2ai-canvas-story__line--infinite"
            aria-label="无限线"
          />
          <CanvasLine
            type="directed"
            start={{ x: -180, y: 92 }}
            end={{ x: 190, y: 28 }}
            aria-label="指向线"
          />
        </CanvasScene>
      </div>
    </main>
  ),
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-line-type="infinite"]');
    assertStorySelector(canvasElement, '[data-line-type="directed"]');
    assertStorySelector(
      canvasElement,
      '[data-line-type="infinite"] .human2ai-canvas-line__visible',
    );
    const directedLine = canvasElement.querySelector<SVGLineElement>(
      '[data-line-type="directed"] .human2ai-canvas-line__visible',
    );
    if (!directedLine) throw new Error("Directed CanvasLine story is missing its line");
    if (!directedLine.getAttribute("marker-end")) {
      throw new Error("Directed CanvasLine is missing its end arrow");
    }
  },
};
