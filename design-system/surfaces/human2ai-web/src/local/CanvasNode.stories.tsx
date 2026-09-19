import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";

import { assertStorySelector } from "../vendor/yisiui/storybook/interactionChecks";
import { CanvasImage } from "./CanvasImage";
import {
  CanvasNode,
  type CanvasNodePoint,
  type CanvasNodeResizeChange,
} from "./CanvasNode";
import { CanvasPoint } from "./CanvasPoint";
import { CanvasScene } from "./CanvasScene";
import { CanvasShape } from "./CanvasShape";
import { CanvasText } from "./CanvasText";

import "./CanvasElements.stories.css";

const FIXTURE_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'%3E%3Crect width='320' height='180' fill='%23dce9ff'/%3E%3Ccircle cx='90' cy='90' r='48' fill='%239dc5ff'/%3E%3C/svg%3E";

function InteractiveNode({ locked = false }: { locked?: boolean }) {
  const [position, setPosition] = useState<CanvasNodePoint>({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 180, height: 110 });
  const [rotation, setRotation] = useState(12);
  const [selected, setSelected] = useState(false);
  const [doubleClickCount, setDoubleClickCount] = useState(0);
  const [deleteCount, setDeleteCount] = useState(0);

  function resizeNode(change: CanvasNodeResizeChange): void {
    const center = {
      x: change.bounds.x + change.bounds.width / 2,
      y: change.bounds.y + change.bounds.height / 2,
    };
    const offset = rotateVector(center, change.sourceRotation);
    setPosition({
      x: change.sourcePosition.x + offset.x,
      y: change.sourcePosition.y + offset.y,
    });
    setSize({ width: change.bounds.width, height: change.bounds.height });
  }

  return (
    <main
      className="human2ai-canvas-story"
      data-story-double-click-count={doubleClickCount}
      data-story-delete-count={deleteCount}
    >
      <div className="human2ai-canvas-story__stage human2ai-canvas-story__stage--compact">
        <CanvasScene
          bounds={{ x: -320, y: -180, width: 640, height: 360 }}
          aria-label="节点交互场景"
        >
          <CanvasNode
            id="node-1"
            label="选择示例节点"
            x={position.x}
            y={position.y}
            rotation={rotation}
            selected={selected}
            locked={locked}
            bounds={{ x: -size.width / 2, y: -size.height / 2, ...size }}
            onSelect={() => setSelected(true)}
            onNudge={(delta) => setPosition((current) => ({
              x: current.x + delta.x,
              y: current.y + delta.y,
            }))}
            onResize={resizeNode}
            onRotate={({ rotation: nextRotation }) => setRotation(nextRotation)}
            onDoubleClick={() => setDoubleClickCount((count) => count + 1)}
            onDelete={() => setDeleteCount((count) => count + 1)}
          >
            <CanvasShape
              type="rectangle"
              width={size.width}
              height={size.height}
              className="human2ai-canvas-story__node-content"
            />
          </CanvasNode>
        </CanvasScene>
      </div>
    </main>
  );
}

function ElementCapabilityMatrix() {
  const noopResize = () => undefined;
  const noopRotate = () => undefined;
  const noopDoubleClick = () => undefined;
  const noopDelete = () => undefined;
  return (
    <main className="human2ai-canvas-story">
      <div className="human2ai-canvas-story__stage">
        <CanvasScene
          bounds={{ x: -480, y: -280, width: 960, height: 560 }}
          aria-label="画布元素变换能力场景"
        >
          <CanvasNode
            id="shape-capability"
            label="形状"
            x={-260}
            y={-110}
            selected
            bounds={{ x: -80, y: -50, width: 160, height: 100 }}
            onResize={noopResize}
            onRotate={noopRotate}
            onDoubleClick={noopDoubleClick}
            onDelete={noopDelete}
          >
            <CanvasShape type="rectangle" width={160} height={100} />
          </CanvasNode>
          <CanvasNode
            id="image-capability"
            label="图片"
            x={210}
            y={-110}
            selected
            bounds={{ x: -90, y: -50, width: 180, height: 100 }}
            onResize={noopResize}
            onRotate={noopRotate}
            onDoubleClick={noopDoubleClick}
            onDelete={noopDelete}
          >
            <CanvasImage src={FIXTURE_IMAGE} alt="示例图片" width={180} height={100} />
          </CanvasNode>
          <CanvasNode
            id="text-capability"
            label="文字"
            x={-230}
            y={150}
            selected
            bounds={{ x: -100, y: -32, width: 200, height: 64 }}
            resizeMode="font-size"
            onResize={noopResize}
            onRotate={noopRotate}
            onDoubleClick={noopDoubleClick}
            onDelete={noopDelete}
          >
            <g transform="translate(-100 -24)">
              <CanvasText text="双击添加备注" fontSize={32} />
            </g>
          </CanvasNode>
          <CanvasNode
            id="point-capability"
            label="点"
            x={220}
            y={150}
            selected
            onDoubleClick={noopDoubleClick}
            onDelete={noopDelete}
          >
            <CanvasPoint radius={12} aria-label="点" />
          </CanvasNode>
        </CanvasScene>
      </div>
    </main>
  );
}

function ScreenStableControlMatrix() {
  return (
    <main className="human2ai-canvas-story">
      <div className="human2ai-canvas-story__stage human2ai-canvas-story__stage--compact">
        <CanvasScene
          bounds={{ x: 0, y: 0, width: 640, height: 360 }}
          aria-label="屏幕尺寸稳定的节点控制场景"
        >
          <g transform="translate(320 180) scale(4)">
            <CanvasNode
              id="small-zoomed-node"
              label="四倍缩放的小节点"
              selected
              bounds={{ x: -4, y: -4, width: 8, height: 8 }}
              screenScale={4}
              onResize={() => undefined}
              onRotate={() => undefined}
            >
              <CanvasShape type="rectangle" width={8} height={8} />
            </CanvasNode>
          </g>
        </CanvasScene>
      </div>
    </main>
  );
}

const meta = {
  id: "human2ai-canvas-node",
  title: "human2ai/Canvas/Foundation/CanvasNode",
  component: CanvasNode,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CanvasNode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "受控选择与键盘移动",
  args: {
    id: "node-1",
    label: "选择示例节点",
    children: null,
  },
  render: () => <InteractiveNode />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-canvas-node="node-1"]');
    const node = canvasElement.querySelector<SVGGElement>('[data-canvas-node="node-1"]');
    if (!node) throw new Error("CanvasNode story is missing its node");
    node.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await nextFrame();
    await nextFrame();
    if (node.dataset.selected !== "true") throw new Error("CanvasNode was not selected");
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextFrame();
    if (document.activeElement !== node) {
      throw new Error("Pointer selection must leave keyboard focus on the CanvasNode");
    }
    if (
      node.dataset.deletable !== "true" ||
      node.getAttribute("aria-keyshortcuts") !== "Delete Backspace"
    ) {
      throw new Error("CanvasNode must expose its controlled keyboard deletion contract");
    }
    const shape = node.querySelector<SVGGraphicsElement>(".human2ai-canvas-shape");
    const outline = node.querySelector<SVGRectElement>(".human2ai-canvas-node__outline");
    if (!shape || !outline) throw new Error("CanvasNode selection visuals are missing");
    await waitForOperationOutline(shape, outline);
    const resizeHits = node.querySelectorAll<SVGRectElement>("[data-resize-handle]");
    if (resizeHits.length !== 8) throw new Error("CanvasNode must render eight resize hit zones");
    if (!node.querySelector("[data-rotation-handle]")) {
      throw new Error("CanvasNode must render its enabled rotation handle");
    }
    resizeHits.forEach((hit) => {
      const style = getComputedStyle(hit);
      if (
        style.stroke !== "none" ||
        !["rgba(0, 0, 0, 0)", "transparent"].includes(style.fill)
      ) {
        throw new Error("CanvasNode resize hit zones must remain invisible");
      }
    });
    const initialTransform = node.getAttribute("transform");
    node.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await nextFrame();
    if (node.getAttribute("transform") === initialTransform) {
      throw new Error("CanvasNode keyboard nudge did not update its controlled position");
    }
    node.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await nextFrame();
    const story = canvasElement.querySelector<HTMLElement>("[data-story-double-click-count]");
    if (story?.dataset.storyDoubleClickCount !== "1") {
      throw new Error("CanvasNode did not forward its double-click event");
    }
    for (const key of ["Delete", "Backspace"]) {
      const accepted = node.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
      if (accepted) throw new Error(`${key} must prevent its browser default when deleting`);
      await nextFrame();
    }
    if (story?.dataset.storyDeleteCount !== "2") {
      throw new Error("CanvasNode must forward Delete and Backspace for the selected node");
    }
  },
};

export const ElementCapabilities: Story = {
  name: "形状图片文字与点的变换能力",
  args: {
    id: "shape-capability",
    label: "形状",
    children: null,
  },
  render: () => <ElementCapabilityMatrix />,
  play: async ({ canvasElement }) => {
    for (const id of ["shape-capability", "image-capability", "text-capability"]) {
      const node = canvasElement.querySelector<SVGGElement>(`[data-canvas-node="${id}"]`);
      if (!node || node.querySelectorAll("[data-resize-handle]").length !== 8) {
        throw new Error(`${id} must expose eight invisible resize hit zones`);
      }
      if (!node.querySelector("[data-rotation-handle]")) {
        throw new Error(`${id} must expose its enabled rotation handle`);
      }
      if (node.dataset.deletable !== "true") {
        throw new Error(`${id} must expose controlled keyboard deletion`);
      }
    }
    const text = canvasElement.querySelector<SVGGElement>('[data-canvas-node="text-capability"]');
    if (text?.dataset.resizeMode !== "font-size") {
      throw new Error("Text nodes must resize by changing font size");
    }
    const point = canvasElement.querySelector<SVGGElement>('[data-canvas-node="point-capability"]');
    if (
      !point ||
      point.dataset.resizable !== "false" ||
      point.dataset.rotatable !== "false" ||
      point.dataset.deletable !== "true" ||
      point.querySelector("[data-resize-handle], [data-rotation-handle]")
    ) {
      throw new Error("Point nodes must not expose resize or rotation controls");
    }
  },
};

export const ScreenStableControls: Story = {
  name: "放大后的小节点控制",
  args: {
    id: "small-zoomed-node",
    label: "四倍缩放的小节点",
    children: null,
  },
  render: () => <ScreenStableControlMatrix />,
  play: async ({ canvasElement }) => {
    const node = canvasElement.querySelector<SVGGElement>(
      '[data-canvas-node="small-zoomed-node"]',
    );
    if (!node) throw new Error("Screen-stable control story is missing its node");
    const resizeHits = Object.fromEntries(
      Array.from(node.querySelectorAll<SVGRectElement>("[data-resize-handle]")).map((hit) => [
        hit.dataset.resizeHandle,
        hit,
      ]),
    );
    const top = resizeHits.top;
    const topLeft = resizeHits["top-left"];
    const topRight = resizeHits["top-right"];
    if (!top || !topLeft || !topRight) {
      throw new Error("Small zoomed node must keep separate top and corner hit zones");
    }
    if (
      Math.abs(Number(topLeft.getAttribute("x")) + Number(topLeft.getAttribute("width"))
        - Number(top.getAttribute("x"))) > 0.001
      || Math.abs(Number(top.getAttribute("x")) + Number(top.getAttribute("width"))
        - Number(topRight.getAttribute("x"))) > 0.001
    ) {
      throw new Error("Corner hit zones must not overlap the top edge hit zone");
    }
    if (Number(top.getAttribute("width")) <= 0) {
      throw new Error("A small zoomed node must retain an editable top edge");
    }

    const rotationHandle = node.querySelector<SVGCircleElement>(
      ".human2ai-canvas-node__rotation-handle",
    );
    const rotationHit = node.querySelector<SVGCircleElement>("[data-rotation-handle]");
    if (!rotationHandle || !rotationHit) {
      throw new Error("Small zoomed node must render visual and pointer rotation controls");
    }
    if (
      Number(rotationHandle.getAttribute("r")) * 4 !== 7
      || Number(rotationHit.getAttribute("r")) * 4 !== 12
      || (-4 - Number(rotationHandle.getAttribute("cy"))) * 4 !== 32
    ) {
      throw new Error("Rotation controls must retain their screen-space geometry at 4x zoom");
    }
  },
};

export const Locked: Story = {
  name: "锁定只读",
  args: {
    id: "node-1",
    label: "锁定示例节点",
    children: null,
  },
  render: () => <InteractiveNode locked />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-canvas-node="node-1"]');
    const node = canvasElement.querySelector<SVGGElement>('[data-canvas-node="node-1"]');
    if (!node) throw new Error("Locked CanvasNode story is missing its node");
    if (node.dataset.locked !== "true" || node.getAttribute("role") !== null) {
      throw new Error("Locked CanvasNode must leave the interaction order");
    }
    if (node.dataset.deletable !== "false" || node.hasAttribute("aria-keyshortcuts")) {
      throw new Error("Locked CanvasNode must disable keyboard deletion");
    }
  },
};

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function isTransparentStroke(stroke: string): boolean {
  return ["none", "transparent", "rgba(0, 0, 0, 0)"].includes(stroke);
}

async function waitForOperationOutline(
  shape: SVGGraphicsElement,
  outline: SVGGraphicsElement,
): Promise<void> {
  for (let frame = 0; frame < 30; frame += 1) {
    if (
      isTransparentStroke(getComputedStyle(shape).stroke) &&
      !isTransparentStroke(getComputedStyle(outline).stroke)
    ) {
      return;
    }
    await nextFrame();
  }
  throw new Error("The operation outline must replace the selected shape stroke");
}

function rotateVector(point: CanvasNodePoint, degrees: number): CanvasNodePoint {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
  };
}
