import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";

import { assertStorySelector } from "../vendor/yisiui/storybook/interactionChecks";
import { CanvasFrame } from "./CanvasFrame";
import type {
  CanvasNodeBounds,
  CanvasNodePoint,
  CanvasNodeResizeChange,
} from "./CanvasNode";
import { CanvasScene } from "./CanvasScene";

import "./CanvasElements.stories.css";

function InteractiveFrame({ locked = false }: { locked?: boolean }) {
  const [bounds, setBounds] = useState<CanvasNodeBounds>({
    x: -220,
    y: -130,
    width: 440,
    height: 260,
  });
  const [selected, setSelected] = useState(false);

  function nudgeFrame(delta: CanvasNodePoint): void {
    setBounds((current) => ({
      ...current,
      x: current.x + delta.x,
      y: current.y + delta.y,
    }));
  }

  function resizeFrame(change: CanvasNodeResizeChange): void {
    setBounds({
      x: change.sourcePosition.x + change.bounds.x,
      y: change.sourcePosition.y + change.bounds.y,
      width: change.bounds.width,
      height: change.bounds.height,
    });
  }

  return (
    <main className="human2ai-canvas-story">
      <div className="human2ai-canvas-story__stage human2ai-canvas-story__stage--compact">
        <CanvasScene
          bounds={{ x: -360, y: -220, width: 720, height: 440 }}
          aria-label="画框交互场景"
        >
          <rect
            x={-360}
            y={-220}
            width={720}
            height={440}
            fill="var(--yisiui-color-surface-soft)"
            pointerEvents="none"
            aria-hidden="true"
          />
          <circle
            cx={0}
            cy={0}
            r={72}
            fill="var(--yisiui-color-paper-sky)"
            pointerEvents="none"
            aria-hidden="true"
          />
          <CanvasFrame
            id="frame-1"
            label="调整示例画框"
            bounds={bounds}
            selected={selected}
            locked={locked}
            resizeMode="free"
            minimumWidth={120}
            minimumHeight={80}
            onSelect={() => setSelected(true)}
            onNudge={nudgeFrame}
            onMove={(change) => setBounds(change.bounds)}
            onResize={resizeFrame}
          />
        </CanvasScene>
      </div>
    </main>
  );
}

const meta = {
  id: "human2ai-canvas-frame",
  title: "human2ai/Canvas/Foundation/CanvasFrame",
  component: CanvasFrame,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CanvasFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "未选中边移动与选中边缩放",
  args: {
    id: "frame-1",
    label: "调整示例画框",
    bounds: { x: -220, y: -130, width: 440, height: 260 },
  },
  render: () => <InteractiveFrame />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-canvas-frame="frame-1"]');
    const frame = canvasElement.querySelector<SVGGElement>('[data-canvas-frame="frame-1"]');
    const node = frame?.querySelector<SVGGElement>('[data-canvas-node="frame-1"]');
    const border = frame?.querySelector<SVGGraphicsElement>(".human2ai-canvas-frame__border");
    const hit = frame?.querySelector<SVGGraphicsElement>(".human2ai-canvas-frame__hit");
    if (!frame || !node || !border || !hit) {
      throw new Error("CanvasFrame story is missing its frame structure");
    }

    const borderStyle = getComputedStyle(border);
    const hitStyle = getComputedStyle(hit);
    if (borderStyle.fill !== "none" || borderStyle.pointerEvents !== "none") {
      throw new Error("CanvasFrame border must not fill or capture its interior");
    }
    if (
      hitStyle.fill !== "none"
      || hitStyle.pointerEvents !== "stroke"
      || !isTransparentStroke(hitStyle.stroke)
      || Number.parseFloat(hitStyle.strokeWidth) < 20
    ) {
      throw new Error("CanvasFrame must use only a wide invisible border hit area");
    }
    if (node.querySelector("[data-rotation-handle]")) {
      throw new Error("CanvasFrame must never render a rotation handle");
    }

    const scene = frame.closest<SVGSVGElement>("svg");
    if (
      !scene
      || node.dataset.selected !== "false"
      || hit.dataset.frameEdgeMode !== "move"
      || hit.dataset.frameMovable !== "true"
      || node.querySelector("[data-resize-handle]")
    ) {
      throw new Error("An unselected CanvasFrame must expose only movable frame edges");
    }
    const initialMoveX = Number(node.dataset.nodeX);
    const initialMoveY = Number(node.dataset.nodeY);
    const dragStart = clientPointForWorld(scene, { x: 0, y: -130 });
    const dragEnd = clientPointForWorld(scene, { x: 32, y: -112 });
    hit.dispatchEvent(pointerEvent("pointerdown", {
      pointerId: 41,
      ...dragStart,
    }));
    hit.dispatchEvent(pointerEvent("pointermove", {
      pointerId: 41,
      ...dragEnd,
    }));
    hit.dispatchEvent(pointerEvent("pointerup", {
      pointerId: 41,
      ...dragEnd,
    }));
    hit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await nextFrame();
    await nextFrame();
    if (
      Number(node.dataset.nodeX) <= initialMoveX
      || Number(node.dataset.nodeY) <= initialMoveY
    ) {
      throw new Error("Dragging a CanvasFrame edge must move its controlled bounds");
    }
    if (node.dataset.selected !== "false") {
      throw new Error("Dragging an unselected CanvasFrame edge must not select the frame");
    }

    hit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextFrame();
    await nextFrame();
    const selectedNode = canvasElement.querySelector<SVGGElement>(
      '[data-canvas-node="frame-1"]',
    );
    const selectedHit = selectedNode?.querySelector<SVGRectElement>(
      ".human2ai-canvas-frame__hit",
    );
    if (
      !selectedNode
      || !selectedHit
      || selectedNode.dataset.selected !== "true"
      || selectedHit.dataset.frameEdgeMode !== "resize"
      || selectedHit.dataset.frameMovable !== "false"
      || selectedNode.querySelectorAll("[data-resize-handle]").length !== 8
      || !selectedNode.querySelector(
        '[data-resize-handle="top"], [data-resize-handle="right"], [data-resize-handle="bottom"], [data-resize-handle="left"]',
      )
    ) {
      throw new Error("A selected CanvasFrame must switch its four edges to resizing");
    }

    const borderWidth = Number(border.getAttribute("width"));
    const rightHandle = selectedNode.querySelector<SVGRectElement>(
      '[data-resize-handle="right"]',
    );
    if (!rightHandle) throw new Error("Selected CanvasFrame is missing its right resize edge");
    const rightRect = rightHandle.getBoundingClientRect();
    const resizeStart = {
      clientX: rightRect.left + rightRect.width / 2,
      clientY: rightRect.top + rightRect.height / 2,
    };
    rightHandle.dispatchEvent(pointerEvent("pointerdown", {
      pointerId: 42,
      ...resizeStart,
    }));
    rightHandle.dispatchEvent(pointerEvent("pointermove", {
      pointerId: 42,
      clientX: resizeStart.clientX + 36,
      clientY: resizeStart.clientY,
    }));
    rightHandle.dispatchEvent(pointerEvent("pointerup", {
      pointerId: 42,
      clientX: resizeStart.clientX + 36,
      clientY: resizeStart.clientY,
    }));
    await nextFrame();
    await nextFrame();
    if (Number(border.getAttribute("width")) <= borderWidth) {
      throw new Error("Dragging a selected CanvasFrame edge must resize its bounds");
    }

    const initialX = selectedNode.dataset.nodeX;
    selectedNode.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await nextFrame();
    if (selectedNode.dataset.nodeX === initialX) {
      throw new Error("CanvasFrame did not forward keyboard nudging");
    }
  },
};

export const Locked: Story = {
  name: "锁定只读边界",
  args: {
    id: "frame-1",
    label: "锁定示例画框",
    bounds: { x: -220, y: -130, width: 440, height: 260 },
  },
  render: () => <InteractiveFrame locked />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-canvas-frame="frame-1"]');
    const node = canvasElement.querySelector<SVGGElement>('[data-canvas-node="frame-1"]');
    if (
      !node
      || node.dataset.locked !== "true"
      || node.getAttribute("role") !== null
      || node.querySelector("[data-resize-handle], [data-rotation-handle]")
    ) {
      throw new Error("Locked CanvasFrame must remain visible but leave the interaction order");
    }
  },
};

function isTransparentStroke(stroke: string): boolean {
  return ["none", "transparent", "rgba(0, 0, 0, 0)"].includes(stroke);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function pointerEvent(type: string, options: PointerEventInit): PointerEvent {
  return new PointerEvent(type, { bubbles: true, button: 0, ...options });
}

function clientPointForWorld(
  scene: SVGSVGElement,
  point: CanvasNodePoint,
): { clientX: number; clientY: number } {
  const rect = scene.getBoundingClientRect();
  const viewBox = scene.viewBox.baseVal;
  return {
    clientX: rect.left + ((point.x - viewBox.x) / viewBox.width) * rect.width,
    clientY: rect.top + ((point.y - viewBox.y) / viewBox.height) * rect.height,
  };
}
