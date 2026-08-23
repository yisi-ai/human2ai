import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";

import { AspectRatioSelector } from "@human2ai/ui/yisiui/aspect-ratio-selector";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";

import {
  addArea,
  addDirectionLine,
  addFocus,
  changeFrame,
  createDraft,
  removeItem,
  rotateDirectionLine,
  visibleAreaMetrics,
  type CompositionDraft,
  type CompositionFrame,
} from "../../../../../src/domain/composition";
import {
  assertStoryRole,
  assertStorySelector,
  assertStoryText,
} from "../vendor/yisiui/storybook/interactionChecks";
import { CompositionCanvas } from "./CompositionCanvas";

import "./CompositionCanvas.stories.css";

const FRAME_OPTIONS = [
  { key: "3:2", label: "3:2", width: 3, height: 2 },
  { key: "1:1", label: "1:1", width: 1, height: 1 },
  { key: "2:3", label: "2:3", width: 2, height: 3 },
] as const;

const FRAMES: Record<(typeof FRAME_OPTIONS)[number]["key"], CompositionFrame> = {
  "3:2": { width: 1200, height: 800 },
  "1:1": { width: 1024, height: 1024 },
  "2:3": { width: 800, height: 1200 },
};

function createExampleDraft(): CompositionDraft {
  let draft = addFocus(createDraft(), { x: 0.32, y: 0.28 }).draft;
  draft = addArea(draft, {
    primitive: "circle",
    x: 0.28,
    y: 0.38,
    area: 0.1,
  }).draft;
  draft = addArea(draft, {
    primitive: "triangle",
    x: 0.68,
    y: 0.32,
    area: 0.08,
    rotation: 12,
  }).draft;
  draft = addArea(draft, {
    primitive: "quadrilateral",
    aspect: "free",
    x: 0.58,
    y: 0.72,
    area: 0.12,
    rotation: 352,
  }).draft;
  const direction = addDirectionLine(draft);
  return rotateDirectionLine(direction.draft, direction.id, 338);
}

function CompositionCanvasWorkbench() {
  const [draft, setDraft] = useState(createExampleDraft);
  const [selectedId, setSelectedId] = useState<string | null>("area-1");
  const [frameKey, setFrameKey] = useState<keyof typeof FRAMES>("3:2");
  const metrics = visibleAreaMetrics(draft);

  function commit(result: { draft: CompositionDraft; id: string }): void {
    setDraft(result.draft);
    setSelectedId(result.id);
  }

  return (
    <main className="composition-canvas-story">
      <header className="composition-canvas-story__header">
        <div>
          <p className="composition-canvas-story__kicker">Composition planner · v1</p>
          <h1>构图画布</h1>
          <p>项目本地 Surface 负责画布组合，YisiUI 共享资产负责工具操作与比例选择。</p>
        </div>
        <BasicButton
          onClick={() => {
            setDraft(createExampleDraft());
            setSelectedId("area-1");
            setFrameKey("3:2");
          }}
        >
          重置草图
        </BasicButton>
      </header>

      <div className="composition-canvas-story__workspace">
        <section className="composition-canvas-story__stage" aria-label="画布工作区">
          <CompositionCanvas
            draft={draft}
            selectedId={selectedId}
            onDraftChange={setDraft}
            onSelectionChange={setSelectedId}
          />
        </section>

        <aside className="composition-canvas-story__panel" aria-label="构图工具">
          <section>
            <h2>添加元素</h2>
            <div className="composition-canvas-story__actions">
              <BasicButton
                disabled={draft.focusPoints.length >= 3}
                onClick={() =>
                  commit(
                    addFocus(draft, {
                      x: 0.22 + draft.focusPoints.length * 0.14,
                      y: 0.2 + draft.focusPoints.length * 0.12,
                    }),
                  )
                }
              >
                添加焦点
              </BasicButton>
              <BasicButton
                onClick={() => commit(addArea(draft, { primitive: "circle", area: 0.08 }))}
              >
                添加圆形
              </BasicButton>
              <BasicButton
                onClick={() => commit(addArea(draft, { primitive: "triangle", area: 0.08 }))}
              >
                添加三角形
              </BasicButton>
              <BasicButton
                onClick={() =>
                  commit(
                    addArea(draft, {
                      primitive: "quadrilateral",
                      aspect: "free",
                      area: 0.08,
                    }),
                  )
                }
              >
                添加四边形
              </BasicButton>
              <BasicButton
                disabled={Boolean(draft.directionLine)}
                onClick={() => commit(addDirectionLine(draft))}
              >
                添加方向线
              </BasicButton>
              <BasicButton
                danger
                disabled={!selectedId}
                onClick={() => {
                  if (!selectedId) return;
                  setDraft(removeItem(draft, selectedId));
                  setSelectedId(null);
                }}
              >
                删除所选
              </BasicButton>
            </div>
          </section>

          <section>
            <h2>画框比例</h2>
            <AspectRatioSelector
              options={FRAME_OPTIONS}
              value={frameKey}
              onChange={(key) => {
                const nextKey = key as keyof typeof FRAMES;
                setFrameKey(nextKey);
                setDraft((current) => changeFrame(current, FRAMES[nextKey]));
              }}
              aria-label="画框比例"
            />
          </section>

          <section>
            <h2>面积概览</h2>
            <dl className="composition-canvas-story__metrics">
              <div>
                <dt>画面占用</dt>
                <dd>{Math.round(metrics.occupiedArea * 100)}%</dd>
              </div>
              <div>
                <dt>负空间</dt>
                <dd>{Math.round(metrics.negativeSpace * 100)}%</dd>
              </div>
              <div>
                <dt>当前选择</dt>
                <dd>{selectedId ?? "无"}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}

function SelectableCanvasExample() {
  const [draft, setDraft] = useState(createExampleDraft);
  const [selectedId, setSelectedId] = useState<string | null>("area-1");
  return (
    <main className="composition-canvas-story composition-canvas-story--canvas-only">
      <CompositionCanvas
        draft={draft}
        selectedId={selectedId}
        onDraftChange={setDraft}
        onSelectionChange={setSelectedId}
      />
    </main>
  );
}

const meta = {
  id: "human2ai-composition-canvas",
  title: "human2ai/CompositionCanvas",
  component: CompositionCanvas,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CompositionCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CanvasOnly: Story = {
  name: "受控直接编辑",
  args: { draft: createExampleDraft() },
  render: () => <SelectableCanvasExample />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="human2ai/composition-canvas"]');
    const triangle = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-2"]',
    );
    if (!triangle) throw new Error("Story interaction contract missing triangle area");
    triangle.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await nextFrame();
    assertStorySelector(
      canvasElement,
      '[data-composition-item="area-2"][data-selected="true"][aria-pressed="true"]',
    );

    const frame = canvasElement.querySelector<SVGRectElement>(
      ".human2ai-composition-canvas__frame",
    );
    if (!frame) throw new Error("Story interaction contract missing canvas frame");
    frame.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextFrame();
    if (canvasElement.querySelector('[data-composition-item][data-selected="true"]')) {
      throw new Error("Story interaction contract did not clear the canvas selection");
    }

    const circle = canvasElement.querySelector<SVGGElement>('[data-composition-item="area-1"]');
    if (!circle) throw new Error("Story interaction contract missing circle area");
    circle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextFrame();
    assertStorySelector(
      canvasElement,
      '[data-composition-item="area-1"][data-selected="true"][aria-pressed="true"]',
    );
    assertStorySelector(canvasElement, '[data-item-id="area-1"][data-handle="scale"]');

    const circleShape = circle.querySelector<SVGCircleElement>(
      ".human2ai-composition-canvas__shape",
    );
    const initialX = Number(circleShape?.getAttribute("cx"));
    circle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await nextFrame();
    const movedCircle = canvasElement.querySelector<SVGCircleElement>(
      '[data-composition-item="area-1"] .human2ai-composition-canvas__shape',
    );
    if (Number(movedCircle?.getAttribute("cx")) <= initialX) {
      throw new Error("Story interaction contract did not move the selected area with keyboard");
    }
  },
};

export const Interactive: Story = {
  name: "交互工作台",
  args: { draft: createExampleDraft() },
  render: () => <CompositionCanvasWorkbench />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="human2ai/composition-canvas"]');
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/basic-button"]');
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/aspect-ratio-selector"]');
    assertStoryRole(canvasElement, "group");
    assertStoryText(canvasElement, "构图画布");

    const triangle = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-2"]',
    );
    if (!triangle) throw new Error("Story interaction contract missing triangle area");
    triangle.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await nextFrame();
    assertStorySelector(
      canvasElement,
      '[data-composition-item="area-2"][data-selected="true"][aria-pressed="true"]',
    );

    findButton(canvasElement, "添加焦点").click();
    await nextFrame();
    assertStorySelector(
      canvasElement,
      '[data-composition-item="focus-2"][data-selected="true"]',
    );

    const svg = canvasElement.querySelector<SVGSVGElement>(
      ".human2ai-composition-canvas__svg",
    );
    const focus = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="focus-2"]',
    );
    const focusRing = focus?.querySelector<SVGCircleElement>(
      ".human2ai-composition-canvas__focus-ring",
    );
    if (!svg || !focus || !focusRing) {
      throw new Error("Story interaction contract missing draggable focus point");
    }
    const initialFocusX = Number(focusRing.getAttribute("cx"));
    const initialFocusY = Number(focusRing.getAttribute("cy"));
    const bounds = svg.getBoundingClientRect();
    const clientX = bounds.left + (initialFocusX / 1200) * bounds.width;
    const clientY = bounds.top + (initialFocusY / 800) * bounds.height;
    focusRing.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX,
        clientY,
        pointerId: 7,
      }),
    );
    svg.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: clientX + bounds.width * 0.08,
        clientY,
        pointerId: 7,
      }),
    );
    svg.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, clientX, clientY, pointerId: 7 }),
    );
    await nextFrame();
    const movedFocusRing = canvasElement.querySelector<SVGCircleElement>(
      '[data-composition-item="focus-2"] .human2ai-composition-canvas__focus-ring',
    );
    if (Number(movedFocusRing?.getAttribute("cx")) <= initialFocusX) {
      throw new Error("Story interaction contract did not drag the selected focus point");
    }

    const squareRatio = canvasElement.querySelector<HTMLButtonElement>('[data-ratio-key="1:1"]');
    if (!squareRatio) throw new Error("Story interaction contract missing square ratio");
    squareRatio.click();
    await nextFrame();
    assertStorySelector(canvasElement, 'svg[viewBox="0 0 1024 1024"]');
  },
};

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!button) throw new Error(`Story interaction contract missing button: ${label}`);
  return button;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
