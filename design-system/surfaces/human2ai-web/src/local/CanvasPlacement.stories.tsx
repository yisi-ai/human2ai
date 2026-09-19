import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";

import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { CanvasPlacement, type CanvasPlacementResult } from "./CanvasPlacement";
import { CanvasScene } from "./CanvasScene";
import { InfiniteCanvasViewport } from "./InfiniteCanvasViewport";
import { placeNodeInStory, placementRender } from "./canvasPlacementStoryChecks";

const meta = {
  id: "human2ai-canvas-placement",
  title: "human2ai/Canvas/Interaction/CanvasPlacement",
  component: CanvasPlacement,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CanvasPlacement>;

export default meta;
type Story = StoryObj<typeof meta>;

function PlacementExample() {
  const [armed, setArmed] = useState(false);
  const [placed, setPlaced] = useState<CanvasPlacementResult[]>([]);
  return (
    <div style={{ height: "100vh" }} data-placement-count={placed.length}>
      <InfiniteCanvasViewport
        defaultCameraCenter={{ x: 0, y: 0 }}
        sideActions={<BasicButton onClick={() => setArmed(true)}>放置矩形</BasicButton>}
      >
        {({ viewportBounds }) => (
          <CanvasScene bounds={viewportBounds} tabIndex={-1}>
            {placed.map(({ bounds }, index) => <rect key={index} {...bounds} fill="var(--yisiui-color-paper-slate)" />)}
            {armed ? (
              <CanvasPlacement
                tool={{ shape: "rectangle", width: 160, height: 100 }}
                viewportBounds={viewportBounds}
                onPlace={(result) => { setPlaced((current) => [...current, result]); setArmed(false); }}
                onCancel={() => setArmed(false)}
              />
            ) : null}
          </CanvasScene>
        )}
      </InfiniteCanvasViewport>
    </div>
  );
}

export const Default: Story = {
  name: "一次性放置与取消",
  args: {
    tool: { shape: "rectangle", width: 160, height: 100 },
    viewportBounds: { x: -400, y: -300, width: 800, height: 600 },
    onPlace: () => undefined,
    onCancel: () => undefined,
  },
  render: () => <PlacementExample />,
  play: async ({ canvasElement }) => {
    const button = Array.from(canvasElement.querySelectorAll("button"))
      .find((node) => node.textContent === "放置矩形")!;
    button.click();
    await placementRender();
    await placeNodeInStory(canvasElement, { x: -180, y: -100 }, { x: 180, y: 100 });
    if (canvasElement.querySelector("[data-placement-count]")?.getAttribute("data-placement-count") !== "1") {
      throw new Error("放置必须只上报一次");
    }
    button.click();
    await placementRender();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await placementRender();
    if (canvasElement.querySelector("[data-canvas-placement]")) throw new Error("Esc 必须取消待放置工具");
  },
};
