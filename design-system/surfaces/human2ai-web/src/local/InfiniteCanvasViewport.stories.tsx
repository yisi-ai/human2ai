import { AimOutlined } from "@ant-design/icons";
import { CompositeButton } from "@human2ai/ui/yisiui/composite-button";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";

import { assertStoryRole, assertStorySelector } from "../vendor/yisiui/storybook/interactionChecks";
import {
  InfiniteCanvasViewport,
  type InfiniteCanvasBackgroundPattern,
  type InfiniteCanvasRenderState,
} from "./InfiniteCanvasViewport";

import "./InfiniteCanvasViewport.stories.css";

const FIT_REQUEST = {
  id: 1,
  bounds: { x: -320, y: -220, width: 960, height: 620 },
  padding: 40,
};

const WORLD_NODES = [
  { id: "navigation", label: "导航栏", x: -280, y: -180, width: 360, height: 72 },
  { id: "content", label: "内容区", x: -80, y: 20, width: 420, height: 260 },
  { id: "actions", label: "操作区", x: 420, y: -40, width: 180, height: 160 },
] as const;

function HtmlWorld({ state }: { state: InfiniteCanvasRenderState }) {
  return (
    <div className="infinite-canvas-story__clip" aria-hidden="true">
      <div
        className="infinite-canvas-story__world"
        data-viewport-x={state.viewportBounds.x}
        data-viewport-y={state.viewportBounds.y}
        data-screen-origin-x={state.worldToScreen({ x: 0, y: 0 }).x}
        style={{
          transform: `translate(${state.viewportSize.width / 2}px, ${state.viewportSize.height / 2}px) scale(${state.zoom}) translate(${-state.cameraCenter.x}px, ${-state.cameraCenter.y}px)`,
        }}
      >
        <div className="infinite-canvas-story__origin" />
        {WORLD_NODES.map((node) => (
          <div
            key={node.id}
            className="infinite-canvas-story__node"
            data-world-node={node.id}
            style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
          >
            {node.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function InteractiveExample({
  showViewportControls = true,
  sideActionPlacement = "right",
}: {
  showViewportControls?: boolean;
  sideActionPlacement?: "left" | "right";
}) {
  const [zoom, setZoom] = useState(1);
  return (
    <main className="infinite-canvas-story">
      <InfiniteCanvasViewport
        zoom={zoom}
        fitRequest={FIT_REQUEST}
        contentBounds={FIT_REQUEST.bounds}
        showViewportControls={showViewportControls}
        sideActionPlacement={sideActionPlacement}
        sideActionPanelDefaultCollapsed
        sideActions={(
          <CompositeButton
            icon={<AimOutlined aria-hidden="true" />}
            label="添加节点"
            onClick={() => undefined}
          />
        )}
        onZoomChange={setZoom}
        aria-label="UI 无限画布"
      >
        {(state) => <HtmlWorld state={state} />}
      </InfiniteCanvasViewport>
    </main>
  );
}

function BackgroundPatternsExample() {
  const patterns: readonly { pattern: InfiniteCanvasBackgroundPattern; label: string }[] = [
    { pattern: "none", label: "无" },
    { pattern: "solid-grid", label: "实线方格" },
    { pattern: "dashed-grid", label: "虚线方格" },
    { pattern: "dots", label: "圆点" },
  ];

  return (
    <main className="infinite-canvas-pattern-story">
      {patterns.map(({ pattern, label }) => (
        <section key={pattern} className="infinite-canvas-pattern-story__item">
          <h2>{label}</h2>
          <InfiniteCanvasViewport
            backgroundPattern={pattern}
            showViewportControls={false}
            aria-label={`${label}底纹画布`}
          >
            {(state) => <HtmlWorld state={state} />}
          </InfiniteCanvasViewport>
        </section>
      ))}
    </main>
  );
}

const meta = {
  id: "human2ai-infinite-canvas-viewport",
  title: "human2ai/Canvas/InfiniteCanvasViewport",
  component: InfiniteCanvasViewport,
  args: { children: () => null },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof InfiniteCanvasViewport>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "HTML 世界层导航",
  render: () => <InteractiveExample />,
  play: async ({ canvasElement }) => {
    await nextFrame();
    await nextFrame();
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="human2ai/infinite-canvas-viewport"]',
    );
    assertStoryRole(canvasElement, "region");
    assertStorySelector(canvasElement, '[role="region"][aria-label="UI 无限画布"]');
    assertStorySelector(canvasElement, '[data-canvas-background="dots"]');
    assertStorySelector(canvasElement, '[data-side-action-placement="right"]');
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/side-action-panel"]');
    const sidePanel = canvasElement.querySelector<HTMLElement>(
      '[data-yisiui-asset="yisiui/side-action-panel"]',
    );
    if (!sidePanel || sidePanel.dataset.collapsed !== "true") {
      throw new Error("Canvas side actions must be collapsed when first displayed");
    }
    findButton(canvasElement, "展开画布操作").click();
    await nextFrame();
    if (!sidePanel.matches('[data-collapsed="false"]')) {
      throw new Error("Canvas side actions did not expand on request");
    }
    assertStorySelector(canvasElement, ".human2ai-infinite-canvas-viewport__controls");
    assertStorySelector(canvasElement, '[data-world-node="navigation"]');
    assertStorySelector(canvasElement, '[data-world-node="content"]');
    assertStorySelector(canvasElement, '[data-world-node="actions"]');

    const viewport = canvasElement.querySelector<HTMLElement>(
      '[data-yisiui-asset="human2ai/infinite-canvas-viewport"]',
    );
    const world = canvasElement.querySelector<HTMLElement>(".infinite-canvas-story__world");
    if (!viewport || !world) throw new Error("Infinite canvas story is missing its viewport");
    if (Number(world.dataset.viewportX) >= 0 || Number(world.dataset.viewportY) >= 0) {
      throw new Error("Fit bounds did not expose negative world coordinates");
    }
    if (getComputedStyle(viewport).overflow !== "hidden") {
      throw new Error("Infinite canvas viewport must hide native overflow");
    }

    const bounds = viewport.getBoundingClientRect();
    const startX = bounds.left + bounds.width / 2;
    const startY = bounds.top + bounds.height / 2;
    const initialCenterX = Number(viewport.dataset.cameraCenterX);
    const initialCenterY = Number(viewport.dataset.cameraCenterY);
    viewport.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 2,
        buttons: 2,
        clientX: startX,
        clientY: startY,
        pointerId: 21,
      }),
    );
    viewport.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        buttons: 2,
        clientX: startX + 80,
        clientY: startY + 40,
        pointerId: 21,
      }),
    );
    viewport.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 2,
        clientX: startX + 80,
        clientY: startY + 40,
        pointerId: 21,
      }),
    );
    await nextFrame();
    const rightDragCenterX = Number(viewport.dataset.cameraCenterX);
    if (
      rightDragCenterX >= initialCenterX ||
      Number(viewport.dataset.cameraCenterY) >= initialCenterY
    ) {
      throw new Error("Secondary-button drag did not move the center toward negative coordinates");
    }

    viewport.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
    viewport.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: startX,
        clientY: startY,
        pointerId: 22,
      }),
    );
    viewport.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        buttons: 1,
        clientX: startX - 30,
        clientY: startY - 20,
        pointerId: 22,
      }),
    );
    viewport.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        clientX: startX - 30,
        clientY: startY - 20,
        pointerId: 22,
      }),
    );
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", bubbles: true }));
    await nextFrame();
    if (Number(viewport.dataset.cameraCenterX) <= rightDragCenterX) {
      throw new Error("Space plus primary-button drag did not move the camera back");
    }

    const zoomBeforeWheel = Number(viewport.dataset.cameraZoom);
    const wheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: startX,
      clientY: startY,
      deltaY: -120,
    });
    viewport.dispatchEvent(wheel);
    await nextFrame();
    if (!wheel.defaultPrevented || Number(viewport.dataset.cameraZoom) <= zoomBeforeWheel) {
      throw new Error("Wheel input did not zoom the camera without native scrolling");
    }

    findButton(canvasElement, "适应全部").click();
    await nextFrame();
    if (
      Math.abs(Number(viewport.dataset.cameraCenterX) - 160) > 0.01 ||
      Math.abs(Number(viewport.dataset.cameraCenterY) - 90) > 0.01
    ) {
      throw new Error("Fit-all control did not restore the content bounds center");
    }

    const zoomBeforeButton = Number(viewport.dataset.cameraZoom);
    findButton(canvasElement, "放大画布").click();
    await nextFrame();
    if (Number(viewport.dataset.cameraZoom) <= zoomBeforeButton) {
      throw new Error("Zoom-in control did not increase the controlled zoom");
    }
    findButton(canvasElement, "画布操作说明");
  },
};

export const BackgroundPatterns: Story = {
  name: "四种画布底纹",
  render: () => <BackgroundPatternsExample />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-background-pattern="none"]');
    assertStorySelector(canvasElement, '[data-canvas-background="solid-grid"]');
    assertStorySelector(canvasElement, '[data-canvas-background="dashed-grid"]');
    assertStorySelector(canvasElement, '[data-canvas-background="dots"]');
  },
};

export const LeftSideActions: Story = {
  name: "左侧操作栏",
  render: () => <InteractiveExample sideActionPlacement="left" />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-side-action-placement="left"]');
  },
};

export const HiddenViewportControls: Story = {
  name: "隐藏视图控制",
  render: () => <InteractiveExample showViewportControls={false} />,
  play: async ({ canvasElement }) => {
    if (canvasElement.querySelector(".human2ai-infinite-canvas-viewport__controls")) {
      throw new Error("Viewport controls must remain hidden when disabled");
    }
  },
};

export const NarrowViewport: Story = {
  name: "窄视口",
  parameters: { viewport: { defaultViewport: "mobile1" } },
  render: () => <InteractiveExample />,
  play: async ({ canvasElement }) => {
    await nextFrame();
    await nextFrame();
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="human2ai/infinite-canvas-viewport"]',
    );
    assertStorySelector(canvasElement, '[data-world-node="content"]');
  },
};

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function findButton(canvasElement: HTMLElement, label: string): HTMLButtonElement {
  const button = [...canvasElement.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.getAttribute("aria-label") === label,
  );
  if (!button) throw new Error(`Missing button: ${label}`);
  return button;
}
