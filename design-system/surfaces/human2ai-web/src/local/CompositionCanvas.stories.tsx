import { checkCanvasLayerMenu } from "./canvasLayerStoryChecks";
import { checkCanvasImagePaste, uploadPastedStoryImage } from "./canvasImagePasteStoryChecks";
import { AimOutlined, FontSizeOutlined, LineOutlined } from "@ant-design/icons";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { ConfigProvider, Switch } from "antd";
import { useState } from "react";
import { useCanvasHistory } from "../../../../../web/lib/use-canvas-history";

import {
  AspectRatioSelector,
  type AspectRatioValue,
} from "@human2ai/ui/yisiui/aspect-ratio-selector";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { CompositeButton } from "@human2ai/ui/yisiui/composite-button";
import zh from "../../../../../locales/zh-CN/common.json";
import en from "../../../../../locales/en/common.json";
import { addCameraReference } from "../../../../../src/domain/composition/camera-reference";

import {
  COMPOSITION_CANVAS,
  addArea,
  addCompositionImage,
  addDirectionLine,
  addFocus,
  addTextRegion,
  changeFrame,
  compositionFrameSizeForRatio,
  createDraft,
  isCompositionFrameRatioSupported,
  moveFrame,
  removeItem,
  rotateDirectionLine,
  updateAreaMetadata,
  updateCompositionImage,
  updateItemMetadata,
  visibleAreaMetrics,
  type CompositionDraft,
} from "../../../../../src/domain/composition";
import {
  assertStoryRole,
  assertStorySelector,
  assertStoryText,
} from "../vendor/yisiui/storybook/interactionChecks";
import { COMPOSITION_FRAME_ID, CompositionCanvas, type CompositionPlacementTool } from "./CompositionCanvas";

import { placeNodeInStory, placementLayer, placementPointer, placementRender } from "./canvasPlacementStoryChecks";

import "./CompositionCanvas.stories.css";

const FIXTURE_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%23dce9ff'/%3E%3Ccircle cx='180' cy='180' r='90' fill='%239dc5ff'/%3E%3Crect x='320' y='90' width='210' height='180' rx='24' fill='%23fff1c2'/%3E%3C/svg%3E";

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

function createTextRegionDraft(): CompositionDraft {
  const added = addTextRegion(createDraft(), {
    x: 0.5,
    y: 0.42,
    area: 0.12,
  });
  return updateAreaMetadata(
    updateItemMetadata(added.draft, added.id, { note: "主标题与导语" }),
    added.id,
    { displayText: "静观", visualWeight: "high" },
  );
}

function CompositionCanvasWorkbench() {
  const [placementTool, setPlacementTool] = useState<CompositionPlacementTool | null>(null);
  const [draft, setDraft] = useState(createExampleDraft);
  const [selectedIds, setSelectedIds] = useState<string[]>(["area-1"]);
  const [frameRatio, setFrameRatio] = useState<AspectRatioValue>({ width: 16, height: 9 });
  const [showGuideGrid, setShowGuideGrid] = useState(true);
  const metrics = visibleAreaMetrics(draft);
  const selectedItemIds = selectedIds.filter((id) => id !== COMPOSITION_FRAME_ID);

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
            setPlacementTool(null);
            setDraft(createExampleDraft());
            setSelectedIds(["area-1"]);
            setFrameRatio({ width: 16, height: 9 });
            setShowGuideGrid(true);
          }}
        >
          清空画布
        </BasicButton>
      </header>

      <div className="composition-canvas-story__workspace">
        <section className="composition-canvas-story__stage" aria-label="画布工作区">
          <CompositionCanvas
            draft={draft}
            placementTool={placementTool}
            onPlacementToolChange={setPlacementTool}
            showGuideGrid={showGuideGrid}
            selectedIds={selectedIds}
            sideActions={(
              <>
              <CompositeButton
                icon={<AimOutlined aria-hidden="true" />}
                label="焦点"
                description={`${draft.focusPoints.length}/3`}
                aria-label={`焦点，已放置 ${draft.focusPoints.length}/3`}
                collapsedLabel="添加焦点"
                disabled={draft.focusPoints.length >= 3}
                aria-current={placementTool === "focus" ? true : undefined}
                textColor={placementTool === "focus" ? "color.action.primary" : "color.text.primary"}
                onClick={() => setPlacementTool((current) => current === "focus" ? null : "focus")}
              />
              <CompositeButton
                icon={<span className="composition-canvas-story__tool-icon composition-canvas-story__tool-icon--circle" />}
                label="圆形"
                collapsedLabel="添加圆形"
                aria-current={placementTool === "circle" ? true : undefined}
                textColor={placementTool === "circle" ? "color.action.primary" : "color.text.primary"}
                onClick={() => setPlacementTool((current) => current === "circle" ? null : "circle")}
              />
              <CompositeButton
                icon={<span className="composition-canvas-story__tool-icon composition-canvas-story__tool-icon--triangle" />}
                label="三角形"
                collapsedLabel="添加三角形"
                aria-current={placementTool === "triangle" ? true : undefined}
                textColor={placementTool === "triangle" ? "color.action.primary" : "color.text.primary"}
                onClick={() => setPlacementTool((current) => current === "triangle" ? null : "triangle")}
              />
              <CompositeButton
                icon={<span className="composition-canvas-story__tool-icon composition-canvas-story__tool-icon--quadrilateral" />}
                label="矩形"
                collapsedLabel="添加矩形"
                aria-current={placementTool === "quadrilateral" ? true : undefined}
                textColor={placementTool === "quadrilateral" ? "color.action.primary" : "color.text.primary"}
                onClick={() => setPlacementTool((current) => current === "quadrilateral" ? null : "quadrilateral")}
              />
              <CompositeButton
                icon={<FontSizeOutlined aria-hidden="true" />}
                label="文字区域"
                collapsedLabel="添加文字区域"
                aria-current={placementTool === "text" ? true : undefined}
                textColor={placementTool === "text" ? "color.action.primary" : "color.text.primary"}
                onClick={() => setPlacementTool((current) => current === "text" ? null : "text")}
              />
              <CompositeButton
                icon={<LineOutlined rotate={-20} aria-hidden="true" />}
                label="动势线"
                description={`${draft.directionLine ? 1 : 0}/1`}
                aria-label={`动势线，已放置 ${draft.directionLine ? 1 : 0}/1`}
                collapsedLabel="添加动势线"
                disabled={Boolean(draft.directionLine)}
                aria-current={placementTool === "direction" ? true : undefined}
                textColor={placementTool === "direction" ? "color.action.primary" : "color.text.primary"}
                onClick={() => setPlacementTool((current) => current === "direction" ? null : "direction")}
              />
              </>
            )}
            onDraftChange={setDraft}
            onSelectionChange={setSelectedIds}
          />
        </section>

        <aside className="composition-canvas-story__panel" aria-label="操作工具">
          <section>
            <div className="composition-canvas-story__setting">
              <label htmlFor="composition-canvas-story-guide-grid">九宫线</label>
              <Switch
                id="composition-canvas-story-guide-grid"
                checked={showGuideGrid}
                onChange={(checked) => setShowGuideGrid(checked)}
              />
            </div>
          </section>

          <section>
            <h2>编辑所选</h2>
            <BasicButton
              danger
              disabled={selectedItemIds.length === 0}
              onClick={() => {
                if (selectedItemIds.length === 0) return;
                setDraft(
                  selectedItemIds.reduce(
                    (nextDraft, id) => removeItem(nextDraft, id),
                    draft,
                  ),
                );
                setSelectedIds([]);
              }}
            >
              删除所选
            </BasicButton>
          </section>

          <section>
            <h2>画框比例</h2>
            <AspectRatioSelector
              ratio={frameRatio}
              onRatioChange={(ratio) => {
                if (!isCompositionFrameRatioSupported(ratio.width, ratio.height)) return;
                setFrameRatio(ratio);
                setDraft((current) =>
                  changeFrame(
                    current,
                    compositionFrameSizeForRatio(ratio.width, ratio.height),
                  ),
                );
              }}
              title="比例"
              widthLabel="宽"
              heightLabel="高"
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
                <dd>{selectedItemIds.join(", ") || "无"}</dd>
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
  const [selectedIds, setSelectedIds] = useState<string[]>(["area-1"]);
  const [noteTargetId, setNoteTargetId] = useState<string | null>(null);
  return (
    <main
      className="composition-canvas-story composition-canvas-story--canvas-only"
      data-composition-metadata-harness
      data-note-target-id={noteTargetId ?? undefined}
      data-node-note={draft.areas[0]?.note}
      data-node-shot-scale={draft.areas[0]?.shotScale}
      data-focus-note={draft.focusPoints[0]?.note}
      data-direction-note={draft.directionLine?.note}
    >
      <CompositionCanvas
        draft={draft}
        selectedIds={selectedIds}
        onDraftChange={setDraft}
        onSelectionChange={setSelectedIds}
        onItemDoubleClick={setNoteTargetId}
      />
    </main>
  );
}

function TextRegionExample() {
  const [draft, setDraft] = useState(createTextRegionDraft);
  const [selectedIds, setSelectedIds] = useState<string[]>(["area-1"]);
  return (
    <main
      className="composition-canvas-story composition-canvas-story--canvas-only"
      data-text-region-note={draft.areas[0]?.note}
      data-text-region-display-text={draft.areas[0]?.displayText}
      data-text-region-visual-weight={draft.areas[0]?.visualWeight}
      data-processing-semantic={draft.processingSemantic ?? "unselected"}
    >
      <CompositionCanvas
        draft={draft}
        selectedIds={selectedIds}
        nodeEditorLabels={{ textKind: "文字区域" }}
        areaEditorLabels={{
          displayText: "显示文字",
          displayTextPlaceholder: "填写要显示的文字；留空由生图模型决定",
          visualWeight: "视觉权重",
          weightAuto: "自动",
          weightHigh: "高",
          weightMedium: "中",
          weightLow: "低",
          weightDecorative: "装饰",
        }}
        onDraftChange={setDraft}
        onSelectionChange={setSelectedIds}
      />
    </main>
  );
}

function ImageNodeExample({ empty = false }: { empty?: boolean }) {
  const [draft, setDraft] = useState(() => empty ? createDraft() : addCompositionImage(createDraft()).draft);
  const [selectedIds, setSelectedIds] = useState<string[]>(["image-1"]);
  return (
    <main className="composition-canvas-story composition-canvas-story--canvas-only">
      <CompositionCanvas
        draft={draft}
        selectedIds={selectedIds}
        nodeEditorLabels={{ imageKind: "图片" }}
        onDraftChange={setDraft}
        onSelectionChange={setSelectedIds}
        onImageUpload={uploadPastedStoryImage}
        resolveImageSource={(assetId) => assetId}
      />
    </main>
  );
}

function ReferenceImageExample() {
  const added = addCompositionImage(createDraft());
  const draft = updateCompositionImage(added.draft, added.id, { assetId: "asset-1" });
  return (
    <main className="composition-canvas-story composition-canvas-story--canvas-only">
      <CompositionCanvas
        appearance="reference"
        draft={draft}
        resolveImageSource={() => FIXTURE_IMAGE}
      />
    </main>
  );
}

const TRANSPARENT_CAMERA_IMAGE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><circle cx="150" cy="90" r="35" fill="#728aa1"/><path d="M150 130V275M150 155L85 230M150 155L215 230M150 275L105 360M150 275L195 360" stroke="#728aa1" stroke-width="24" fill="none"/></svg>')}`;
function CameraReferenceExample({ english = false }: { english?: boolean }) {
  const copy = english ? en : zh;
  const [draft, setDraft] = useState(() => addCameraReference(createExampleDraft(), {
    sessionId: "space", cameraId: "camera", revision: 1, assetId: "camera-png", width: 300, height: 400,
  }).draft);
  return <main className="composition-canvas-story composition-canvas-story--canvas-only">
    <CompositionCanvas draft={draft} onDraftChange={setDraft} resolveImageSource={() => TRANSPARENT_CAMERA_IMAGE}
      nodeEditorLabels={{ imageKind: copy.canvas.imageNode.label }}
      renderCameraReference={() => <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <strong>{copy.spatial.reference}</strong>
        <img src={TRANSPARENT_CAMERA_IMAGE} alt={copy.spatial.cameraView} style={{ width: "100%", maxHeight: 280, objectFit: "contain" }} />
        <BasicButton>{copy.spatial.openSource}</BasicButton>
        <BasicButton>{copy.spatial.snapshot}</BasicButton>
      </div>} />
  </main>;
}

function LockedFrameExample() {
  const [draft, setDraft] = useState(createExampleDraft);
  const [selectedIds, setSelectedIds] = useState<string[]>(["area-1"]);
  return (
    <main className="composition-canvas-story composition-canvas-story--canvas-only">
      <CompositionCanvas
        draft={draft}
        frameLocked
        selectedIds={selectedIds}
        onDraftChange={setDraft}
        onSelectionChange={setSelectedIds}
      />
    </main>
  );
}

function ExpandedWorldExample() {
  const [draft, setDraft] = useState(() => moveFrame(createExampleDraft(), { x: -1.1, y: -0.8 }));
  const [zoom, setZoom] = useState(1);
  return (
    <main className="composition-canvas-story composition-canvas-story--canvas-only">
      <CompositionCanvas
        draft={draft}
        zoom={zoom}
        viewportAction={{ id: 1, type: "fit-all" }}
        onDraftChange={setDraft}
        onZoomChange={setZoom}
      />
    </main>
  );
}

function ScreenStableDirectionControlExample() {
  const [draft, setDraft] = useState(createExampleDraft);
  const [zoom, setZoom] = useState(4);
  const history = useCanvasHistory(draft, ({ draft: restored }) => setDraft(restored));
  return (
    <main data-canvas-editor className="composition-canvas-story composition-canvas-story--canvas-only">
      <CompositionCanvas
        draft={draft}
        zoom={zoom}
        onZoomChange={setZoom}
        selectedIds={["direction-1"]}
        interactionResetKey={history.restoreToken}
        onDraftChange={(next) => { if (history.record(next)) setDraft(next); }}
      />
      <output hidden data-direction-draft>{JSON.stringify(draft.directionLine)}</output>
    </main>
  );
}

const meta = {
  id: "human2ai-composition-canvas",
  title: "human2ai/Canvas/Business/CompositionCanvas",
  component: CompositionCanvas,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CompositionCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

function PlacementCompositionExample() {
  const [draft, setDraft] = useState(createDraft);
  const [changes, setChanges] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<CompositionPlacementTool | null>(null);
  const tools: Array<[CompositionPlacementTool, string]> = [
    ["focus", "焦点"], ["direction", "动线"], ["circle", "圆形"], ["triangle", "三角形"],
    ["quadrilateral", "矩形"], ["text", "文字区域"], ["image", "图片"],
  ];
  return (
    <div style={{ height: "100vh" }} data-placement-draft={JSON.stringify(draft)} data-placement-changes={changes}>
      <CompositionCanvas
        draft={draft}
        zoom={0.75}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        placementTool={tool}
        onPlacementToolChange={setTool}
        onDraftChange={(next) => { setDraft(next); setChanges((value) => value + 1); }}
        sideActions={tools.map(([value, label]) => (
          <CompositeButton key={value} icon={<AimOutlined />} label={label}
            aria-current={tool === value ? true : undefined}
            onClick={() => setTool((current) => current === value ? null : value)} />
        ))}
      />
    </div>
  );
}

function LayerOrderExample({ readOnly = false }: { readOnly?: boolean }) {
  const [draft, setDraft] = useState(() => addCompositionImage(createExampleDraft()).draft);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  return (
    <div style={{ height: "100vh" }} data-layer-draft={JSON.stringify(draft)}>
      <CompositionCanvas draft={draft} selectedIds={selectedIds} onSelectionChange={setSelectedIds}
        onDraftChange={readOnly ? undefined : setDraft} />
    </div>
  );
}

export const LayerOrder: Story = {
  args: { draft: createExampleDraft() },
  name: "右键调整节点层级",
  render: () => <ConfigProvider theme={{ token: { motion: false } }}><LayerOrderExample /></ConfigProvider>,
  play: ({ canvasElement }) => checkCanvasLayerMenu(canvasElement, "[data-composition-item]", "data-composition-item"),
};

export const ReadOnlyLayerOrder: Story = {
  args: { draft: createExampleDraft() },
  name: "只读层级菜单",
  render: () => <ConfigProvider theme={{ token: { motion: false } }}><LayerOrderExample readOnly /></ConfigProvider>,
  play: ({ canvasElement }) => checkCanvasLayerMenu(canvasElement, "[data-composition-item]", "data-composition-item", true),
};

export const NodePlacement: Story = {
  name: "所有构图工具定位放置",
  args: { draft: createDraft() },
  render: () => <PlacementCompositionExample />,
  play: async ({ canvasElement }) => {
    const snapshot = () => {
      const node = canvasElement.querySelector<HTMLElement>("[data-placement-draft]")!;
      return { draft: JSON.parse(node.dataset.placementDraft!) as CompositionDraft,
        changes: Number(node.dataset.placementChanges) };
    };
    const arm = async (label: string) => {
      Array.from(canvasElement.querySelectorAll("button")).find((button) => button.textContent === label)!.click();
      await placementRender();
    };
    await arm("矩形");
    const layer = placementLayer(canvasElement);
    placementPointer(layer, "pointerdown", { x: 660, y: 420 });
    placementPointer(layer, "pointermove", { x: 500, y: 310 });
    await placementRender();
    if (snapshot().changes || !layer.querySelector("path")?.getAttribute("d")) {
      throw new Error("构图放置预览不得提交中间草稿");
    }
    placementPointer(layer, "pointerup", { x: 420, y: 260 });
    await placementRender();
    const area = snapshot().draft.areas[0]!;
    if (snapshot().changes !== 1 || Math.abs(area.x * COMPOSITION_CANVAS.width - 540) > 0.01
      || Math.abs(area.y * COMPOSITION_CANVAS.height - 340) > 0.01
      || Math.abs(area.width! * COMPOSITION_CANVAS.width - 240) > 0.01
      || Math.abs(area.height! * COMPOSITION_CANVAS.height - 160) > 0.01) {
      throw new Error("构图反向拖动必须将世界坐标转换为正确的中心及宽高");
    }
    await arm("三角形");
    await placeNodeInStory(canvasElement, { x: 450, y: 280 }, { x: 600, y: 400 });
    const triangle = snapshot().draft.areas.at(-1)!;
    if (Math.abs(triangle.y * COMPOSITION_CANVAS.height - 360) > 0.01) {
      throw new Error("三角形必须按重心转换，不能把包围框中心当成重心");
    }
    await arm("圆形");
    await placeNodeInStory(canvasElement, { x: 450, y: 280 }, { x: 600, y: 380 });
    const circle = snapshot().draft.areas.at(-1)!;
    if (circle.aspect !== "free" || Math.abs(circle.width! * 1200 - 150) > 0.01) {
      throw new Error("圆形工具拖动应沿用自由宽高规则");
    }
    await arm("焦点");
    await placeNodeInStory(canvasElement, { x: -120, y: -60 });
    if (Math.abs(snapshot().draft.focusPoints[0]!.x + 0.1) > 0.00001) throw new Error("焦点必须在单击的范围外位置创建");
    await arm("动线");
    await placeNodeInStory(canvasElement, { x: 120, y: 160 }, { x: 220, y: 260 });
    if (Math.abs(snapshot().draft.directionLine!.rotation - 45) > 0.01) {
      throw new Error("动线必须从拖动轨迹确定方向");
    }
    const directionPoints = [...canvasElement.querySelectorAll<SVGGElement>('[data-handle="move-direction-point"]')];
    for (const [index, expected] of [{ x: 120, y: 160 }, { x: 220, y: 260 }].entries()) {
      const matrix = directionPoints[index]?.transform.baseVal.consolidate()?.matrix;
      if (!matrix || Math.hypot(matrix.e - expected.x, matrix.f - expected.y) > 0.001) {
        throw new Error("Flow controls must match the two points used to place the line");
      }
    }
    await arm("图片");
    await placeNodeInStory(canvasElement, { x: 450, y: 280 });
    if (snapshot().draft.images[0]?.width !== 320 / 1200) throw new Error("图片单击放置应使用默认尺寸");
    await arm("图片");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await placementRender();
    if (snapshot().changes !== 6 || canvasElement.querySelector("[data-canvas-placement]")) {
      throw new Error("Esc 取消必须保持已有构图不变");
    }
    await arm("文字区域");
    await placeNodeInStory(canvasElement, { x: 450, y: 280 });
    if (snapshot().changes !== 7 || snapshot().draft.areas.at(-1)?.semanticType !== "text-region"
      || !document.body.querySelector('[role="dialog"]')) {
      throw new Error("文字区域放置后必须直接进入编辑");
    }
  },
};

export const CanvasOnly: Story = {
  name: "受控直接编辑",
  args: { draft: createExampleDraft() },
  render: () => <SelectableCanvasExample />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="human2ai/composition-canvas"]');
    assertStorySelector(canvasElement, '[data-canvas-background="dots"]');
    const canvasSvg = canvasElement.querySelector<SVGSVGElement>(
      ".human2ai-composition-canvas__svg",
    );
    const frameSurface = canvasElement.querySelector<SVGRectElement>(
      ".human2ai-canvas-frame__border",
    );
    if (!canvasSvg || getComputedStyle(canvasSvg).backgroundColor !== "rgba(0, 0, 0, 0)") {
      throw new Error("Composition SVG must stay transparent so the canvas pattern is visible");
    }
    if (
      !frameSurface ||
      !["none", "rgba(0, 0, 0, 0)", "transparent"].includes(
        getComputedStyle(frameSurface).fill,
      )
    ) {
      throw new Error("Composition frame must stay unfilled");
    }
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
      '[data-canvas-frame="composition-frame"] .human2ai-canvas-frame__border',
    );
    const frameNode = canvasElement.querySelector<SVGGElement>(
      `[data-canvas-node="${COMPOSITION_FRAME_ID}"]`,
    );
    const canvasSurface = canvasElement.querySelector<SVGRectElement>(
      ".human2ai-composition-canvas__surface",
    );
    if (!frame || !frameNode || !canvasSurface) {
      throw new Error("Story interaction contract missing canvas frame or background");
    }
    frame.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextFrame();
    if (frameNode.dataset.selected !== "true") {
      throw new Error("Canvas frame must have its own selected state");
    }
    if (canvasElement.querySelector('[data-composition-item][data-selected="true"]')) {
      throw new Error("Story interaction contract did not clear the canvas selection");
    }
    const blankMatrix = canvasSvg.getScreenCTM();
    if (!blankMatrix) throw new Error("Story interaction contract could not resolve blank space");
    const blankClick = new DOMPoint(80, 80).matrixTransform(blankMatrix);
    canvasSurface.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerId: 17,
      clientX: blankClick.x,
      clientY: blankClick.y,
    }));
    canvasSurface.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      button: 0,
      pointerId: 17,
      clientX: blankClick.x,
      clientY: blankClick.y,
    }));
    canvasSurface.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextFrame();
    const deselectedFrameNode = canvasElement.querySelector<SVGGElement>(
      `[data-canvas-node="${COMPOSITION_FRAME_ID}"]`,
    );
    if (deselectedFrameNode?.dataset.selected !== "false") {
      throw new Error("Clicking blank canvas space must clear the frame selection");
    }

    triangle.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await nextFrame();
    const emptyMarqueeEnd = new DOMPoint(120, 110).matrixTransform(blankMatrix);
    canvasSurface.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerId: 18,
      shiftKey: true,
      clientX: blankClick.x,
      clientY: blankClick.y,
    }));
    canvasSvg.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      button: 0,
      pointerId: 18,
      shiftKey: true,
      clientX: emptyMarqueeEnd.x,
      clientY: emptyMarqueeEnd.y,
    }));
    canvasSvg.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      button: 0,
      pointerId: 18,
      shiftKey: true,
      clientX: emptyMarqueeEnd.x,
      clientY: emptyMarqueeEnd.y,
    }));
    canvasSurface.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextFrame();
    if (canvasElement.querySelector('[data-canvas-node][data-selected="true"]')) {
      throw new Error("Marqueeing empty canvas space must clear the current selection");
    }

    let circle = canvasElement.querySelector<SVGGElement>('[data-composition-item="area-1"]');
    if (!circle) throw new Error("Story interaction contract missing circle area");
    const circleStartX = Number(circle.dataset.nodeX);
    const circleStartY = Number(circle.dataset.nodeY);
    const nodeDragMatrix = canvasSvg.getScreenCTM();
    if (!nodeDragMatrix) throw new Error("Story interaction contract could not resolve node dragging");
    const circleClient = new DOMPoint(circleStartX, circleStartY).matrixTransform(nodeDragMatrix);
    circle.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerId: 19,
      clientX: circleClient.x,
      clientY: circleClient.y,
    }));
    canvasSvg.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      button: 0,
      pointerId: 19,
      clientX: circleClient.x + 24,
      clientY: circleClient.y + 16,
    }));
    await nextFrame();
    if (
      canvasSvg.dataset.canvasDragging !== "node"
      || getComputedStyle(canvasSvg).cursor !== "grabbing"
    ) {
      throw new Error("拖动构图节点期间画布必须持续显示抓取光标");
    }
    canvasSvg.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      button: 0,
      pointerId: 19,
      clientX: circleClient.x + 24,
      clientY: circleClient.y + 16,
    }));
    circle.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await nextFrame();
    await nextFrame();
    if (canvasSvg.dataset.canvasDragging) {
      throw new Error("构图节点拖动结束后画布必须清除抓取状态");
    }
    if (
      Number(circle.dataset.nodeX) <= circleStartX
      || Number(circle.dataset.nodeY) <= circleStartY
      || circle.dataset.selected !== "false"
    ) {
      throw new Error("Dragging an unselected composition node must move without selecting it");
    }

    circle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextFrame();
    await nextFrame();
    assertStorySelector(
      canvasElement,
      '[data-composition-item="area-1"][data-selected="true"][aria-pressed="true"]',
    );
    const circleResizeHits = circle.querySelectorAll("[data-resize-handle]");
    if (circleResizeHits.length !== 8 || circle.querySelector("[data-rotation-handle]")) {
      throw new Error("Selected circles need eight resize zones and no ineffective rotation handle");
    }
    circle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await nextFrame();
    const canvasOnlyStory = canvasElement.querySelector<HTMLElement>("[data-note-target-id]");
    if (canvasOnlyStory?.dataset.noteTargetId !== "area-1") {
      throw new Error("Composition items must forward double-click for business notes");
    }
    const nodeEditor = document.body.querySelector<HTMLElement>(
      '[data-yisiui-asset="human2ai/canvas-node-editor"]',
    );
    if (!nodeEditor) {
      throw new Error("双击构图节点必须打开 Human2AI 公共节点信息编辑器");
    }
    if (
      nodeEditor.querySelector('[aria-label="批注"]')
      || nodeEditor.querySelector('[aria-label="类型"]')
    ) {
      throw new Error("构图节点编辑器不应显示批注或类型");
    }
    if (!nodeEditor.textContent?.includes("自动")) {
      throw new Error("构图节点必须默认使用自动景别");
    }
    setInputValue(requiredInput(nodeEditor, "备注"), "画面主体区域");
    await nextFrame();
    await selectOption(nodeEditor, "景别", "前景");
    await nextFrame();
    if (
      canvasOnlyStory.dataset.nodeNote !== "画面主体区域"
      || canvasOnlyStory.dataset.nodeShotScale !== "foreground"
    ) {
      throw new Error("构图节点备注或景别没有即时写回受控 draft");
    }
    // Adding a note mounts the tooltip; resolve the current SVG node again.
    circle = canvasElement.querySelector<SVGGElement>('[data-composition-item="area-1"]')!;
    const selectedShape = circle.querySelector<SVGGraphicsElement>(
      ".human2ai-composition-canvas__shape",
    );
    const selectedOutline = circle.querySelector<SVGRectElement>(
      ".human2ai-canvas-node__outline",
    );
    if (!selectedShape || !selectedOutline) {
      throw new Error("Selected composition shape visuals are missing");
    }
    await waitForOperationOutline(selectedShape, selectedOutline);

    const initialX = Number(circle.dataset.nodeX);
    circle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await nextFrame();
    const movedCircle = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-1"]',
    );
    if (Number(movedCircle?.dataset.nodeX) <= initialX) {
      throw new Error("Story interaction contract did not move the selected area with keyboard");
    }

    const triangleX = Number(triangle.dataset.nodeX);
    triangle.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      shiftKey: true,
    }));
    await nextFrame();
    const multiSelection = canvasElement.querySelector<SVGGElement>(
      '[data-canvas-node="composition-multi-selection"]',
    );
    if (
      !multiSelection ||
      multiSelection.querySelectorAll("[data-resize-handle]").length !== 8 ||
      multiSelection.querySelector("[data-rotation-handle]")
    ) {
      throw new Error("Shift selection must render one eight-way group operation frame");
    }
    movedCircle?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await nextFrame();
    const movedTriangle = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-2"]',
    );
    if (Number(movedTriangle?.dataset.nodeX) <= triangleX) {
      throw new Error("Keyboard movement must move all selected composition items");
    }

    const sceneMatrix = canvasSvg.getScreenCTM();
    if (!sceneMatrix) throw new Error("Story interaction contract could not resolve marquee points");
    const marqueeStart = new DOMPoint(80, 80).matrixTransform(sceneMatrix);
    const marqueeEnd = new DOMPoint(980, 500).matrixTransform(sceneMatrix);
    canvasSurface.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: marqueeStart.x,
        clientY: marqueeStart.y,
        pointerId: 21,
      }),
    );
    canvasSvg.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: marqueeEnd.x,
        clientY: marqueeEnd.y,
        pointerId: 21,
      }),
    );
    await nextFrame();
    if (!canvasElement.querySelector(".human2ai-composition-canvas__marquee")) {
      throw new Error("Blank-canvas dragging must render a marquee");
    }
    canvasSvg.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: marqueeEnd.x,
        clientY: marqueeEnd.y,
        pointerId: 21,
      }),
    );
    await nextFrame();
    if (
      !canvasElement.querySelector('[data-composition-item="area-1"][data-selected="true"]') ||
      !canvasElement.querySelector('[data-composition-item="area-2"][data-selected="true"]') ||
      !canvasElement.querySelector('[data-canvas-node="composition-multi-selection"]')
    ) {
      throw new Error("Marquee selection must select intersecting items as one group");
    }

    const svg = canvasElement.querySelector<SVGSVGElement>(
      ".human2ai-composition-canvas__svg",
    );
    const sourceFrame = canvasElement.querySelector<SVGRectElement>(
      '[data-canvas-frame="composition-frame"] .human2ai-canvas-frame__border',
    );
    const sourceFrameNode = canvasElement.querySelector<SVGGElement>(
      '[data-canvas-node="composition-frame"]',
    );
    if (!svg || !sourceFrame || !sourceFrameNode) {
      throw new Error("Story interaction contract missing movable frame");
    }
    const frameHit = sourceFrameNode.querySelector<SVGRectElement>(
      ".human2ai-canvas-frame__hit",
    );
    if (
      !frameHit ||
      getComputedStyle(frameHit).pointerEvents !== "stroke" ||
      Number.parseFloat(getComputedStyle(frameHit).strokeWidth) < 20
    ) {
      throw new Error("Composition frame must expose a wide invisible border hit area");
    }
    const initialFrameWidth = Number(sourceFrame.getAttribute("width"));
    const initialFrameHeight = Number(sourceFrame.getAttribute("height"));
    const initialFrameX = Number(sourceFrameNode.dataset.nodeX) - initialFrameWidth / 2;
    const initialFrameY = Number(sourceFrameNode.dataset.nodeY) - initialFrameHeight / 2;
    const svgBounds = svg.getBoundingClientRect();
    const frameClientX =
      svgBounds.left + (initialFrameX / 1200) * svgBounds.width;
    const frameClientY =
      svgBounds.top + ((initialFrameY + initialFrameHeight / 2) / 800) * svgBounds.height;
    frameHit.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: frameClientX,
        clientY: frameClientY,
        pointerId: 8,
      }),
    );
    frameHit.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: frameClientX + svgBounds.width * 0.03,
        clientY: frameClientY,
        pointerId: 8,
      }),
    );
    frameHit.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: frameClientX + svgBounds.width * 0.03,
        clientY: frameClientY,
        pointerId: 8,
      }),
    );
    frameHit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await nextFrame();
    const movedFrame = canvasElement.querySelector<SVGRectElement>(
      '[data-canvas-frame="composition-frame"] .human2ai-canvas-frame__border',
    );
    const movedFrameNode = canvasElement.querySelector<SVGGElement>(
      '[data-canvas-node="composition-frame"]',
    );
    const movedFrameWidth = Number(movedFrame?.getAttribute("width"));
    const movedFrameHeight = Number(movedFrame?.getAttribute("height"));
    const movedFrameX = Number(movedFrameNode?.dataset.nodeX) - movedFrameWidth / 2;
    const movedFrameY = Number(movedFrameNode?.dataset.nodeY) - movedFrameHeight / 2;
    if (movedFrameX <= initialFrameX) {
      throw new Error("Story interaction contract did not drag the composition frame");
    }
    if (movedFrameNode?.dataset.selected !== "false") {
      throw new Error("Dragging an unselected composition frame must not select it");
    }

    frameHit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextFrame();
    const selectedFrameNode = canvasElement.querySelector<SVGGElement>(
      '[data-canvas-node="composition-frame"]',
    );
    if (selectedFrameNode?.dataset.selected !== "true") {
      throw new Error("The composition frame must enter selection only after a click");
    }

    const resizeHandles = selectedFrameNode.querySelectorAll<SVGRectElement>(
      "[data-resize-handle]",
    );
    if (
      resizeHandles.length !== 8
      || !selectedFrameNode.querySelector('[data-resize-handle="right"]')
    ) {
      throw new Error("A selected composition frame requires four edge and four corner handles");
    }
    const resizeHandle = canvasElement.querySelector<SVGRectElement>(
      '[data-node-id="composition-frame"][data-resize-handle="right"]',
    );
    if (!resizeHandle) throw new Error("Story interaction contract missing frame edge handle");
    const resizeHandleStyle = getComputedStyle(resizeHandle);
    if (
      resizeHandleStyle.stroke !== "none" ||
      !["rgba(0, 0, 0, 0)", "transparent"].includes(resizeHandleStyle.fill)
    ) {
      throw new Error("Story interaction contract rendered a visible frame resize handle");
    }
    const handleClientX =
      svgBounds.left +
      ((movedFrameX + movedFrameWidth) / 1200) * svgBounds.width;
    const handleClientY =
      svgBounds.top +
      ((movedFrameY + movedFrameHeight / 2) / 800) * svgBounds.height;
    resizeHandle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: handleClientX,
        clientY: handleClientY,
        pointerId: 9,
      }),
    );
    resizeHandle.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: handleClientX - svgBounds.width * 0.03,
        clientY: handleClientY,
        pointerId: 9,
      }),
    );
    resizeHandle.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: handleClientX,
        clientY: handleClientY,
        pointerId: 9,
      }),
    );
    await nextFrame();
    const resizedFrame = canvasElement.querySelector<SVGRectElement>(
      '[data-canvas-frame="composition-frame"] .human2ai-canvas-frame__border',
    );
    const resizedFrameNode = canvasElement.querySelector<SVGGElement>(
      '[data-canvas-node="composition-frame"]',
    );
    const resizedWidth = Number(resizedFrame?.getAttribute("width"));
    const resizedHeight = Number(resizedFrame?.getAttribute("height"));
    if (resizedWidth >= movedFrameWidth) {
      throw new Error("Story interaction contract did not resize the selected frame edge");
    }
    if (Math.abs(resizedWidth / resizedHeight - movedFrameWidth / movedFrameHeight) > 1e-6) {
      throw new Error("Frame edge resizing must preserve the source ratio");
    }

    const resizedX = Number(resizedFrameNode?.dataset.nodeX) - resizedWidth / 2;
    const resizedY = Number(resizedFrameNode?.dataset.nodeY) - resizedHeight / 2;
    const fixedRight = resizedX + resizedWidth;
    const fixedBottom = resizedY + resizedHeight;
    const topLeftHandle = canvasElement.querySelector<SVGRectElement>(
      '[data-node-id="composition-frame"][data-resize-handle="top-left"]',
    );
    if (!topLeftHandle) throw new Error("Story interaction contract missing top-left resize corner");
    const topLeftClientX = svgBounds.left + (resizedX / 1200) * svgBounds.width;
    const topLeftClientY = svgBounds.top + (resizedY / 800) * svgBounds.height;
    topLeftHandle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: topLeftClientX,
        clientY: topLeftClientY,
        pointerId: 10,
      }),
    );
    topLeftHandle.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: topLeftClientX + svgBounds.width * 0.02,
        clientY: topLeftClientY + svgBounds.height * 0.02,
        pointerId: 10,
        shiftKey: true,
      }),
    );
    topLeftHandle.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: topLeftClientX,
        clientY: topLeftClientY,
        pointerId: 10,
      }),
    );
    await nextFrame();
    const topLeftResizedFrame = canvasElement.querySelector<SVGRectElement>(
      '[data-canvas-frame="composition-frame"] .human2ai-canvas-frame__border',
    );
    const topLeftResizedFrameNode = canvasElement.querySelector<SVGGElement>(
      '[data-canvas-node="composition-frame"]',
    );
    const topLeftWidth = Number(topLeftResizedFrame?.getAttribute("width"));
    const topLeftHeight = Number(topLeftResizedFrame?.getAttribute("height"));
    const topLeftX = Number(topLeftResizedFrameNode?.dataset.nodeX) - topLeftWidth / 2;
    const topLeftY = Number(topLeftResizedFrameNode?.dataset.nodeY) - topLeftHeight / 2;
    if (topLeftX <= resizedX || topLeftY <= resizedY) {
      throw new Error("Story interaction contract did not resize from the top-left corner");
    }
    if (
      Math.abs(topLeftX + topLeftWidth - fixedRight) > 1e-9 ||
      Math.abs(topLeftY + topLeftHeight - fixedBottom) > 1e-9
    ) {
      throw new Error("Story interaction contract did not keep the opposite corner fixed");
    }
    if (Math.abs(topLeftWidth / topLeftHeight - resizedWidth / resizedHeight) > 1e-6) {
      throw new Error("Frame corner resizing must remain proportional with Shift");
    }

    const areaCount = canvasElement.querySelectorAll("[data-composition-item]").length;
    const currentCircle = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-1"]',
    );
    if (!currentCircle) throw new Error("Story deletion contract missing its target area");
    currentCircle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextFrame();
    currentCircle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }),
    );
    await nextFrame();
    if (
      canvasElement.querySelector('[data-composition-item="area-1"]') ||
      canvasElement.querySelectorAll("[data-composition-item]").length !== areaCount - 1 ||
      canvasElement.querySelector('[data-composition-item][data-selected="true"]')
    ) {
      throw new Error("Delete must remove the selected composition item and clear selection");
    }

    const currentTriangle = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-2"]',
    );
    if (!currentTriangle) throw new Error("Story deletion contract missing its Backspace target");
    currentTriangle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextFrame();
    currentTriangle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }),
    );
    await nextFrame();
    if (
      canvasElement.querySelector('[data-composition-item="area-2"]') ||
      canvasElement.querySelectorAll("[data-composition-item]").length !== areaCount - 2 ||
      canvasElement.querySelector('[data-composition-item][data-selected="true"]')
    ) {
      throw new Error("Backspace must remove the selected composition item and clear selection");
    }
  },
};

export const NodeNoteTooltip: Story = {
  name: "节点备注 Tooltip",
  args: { draft: createTextRegionDraft() },
  render: (args) => (
    <main className="composition-canvas-story composition-canvas-story--canvas-only">
      <CompositionCanvas {...args} />
    </main>
  ),
  play: async ({ canvasElement }) => {
    const textRegion = canvasElement.querySelector<SVGGElement>(
      '[data-composition-kind="text-region"]',
    );
    if (!textRegion || textRegion.textContent?.includes("主标题与导语")) {
      throw new Error("构图节点备注不应显示在节点内部");
    }
    textRegion.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await nextFrame();
    const noteTooltip = document.body.querySelector<HTMLElement>('[role="tooltip"]');
    if (noteTooltip?.textContent?.trim() !== "主标题与导语") {
      throw new Error("悬停构图节点时必须在 Tooltip 中显示其备注");
    }
    textRegion.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    await nextFrame();
  },
};

export const ClipboardImage: Story = {
  name: "粘贴图片与编辑替换",
  args: { draft: createDraft() },
  render: () => <ImageNodeExample empty />,
  play: ({ canvasElement }) => checkCanvasImagePaste(canvasElement, "composition"),
};

export const ImageNode: Story = {
  name: "图片占位与双击编辑",
  args: { draft: addCompositionImage(createDraft()).draft },
  render: () => <ImageNodeExample />,
  play: async ({ canvasElement }) => {
    const image = canvasElement.querySelector<SVGGElement>(
      '[data-composition-kind="image"]',
    );
    if (!image || !image.querySelector('[data-image-status="empty"]')) {
      throw new Error("构图图片工具必须先创建可编辑的默认占位节点");
    }
    if (image.dataset.resizeMode !== "proportional") {
      throw new Error("构图图片节点必须始终按比例缩放");
    }
    if (document.body.querySelector('input[type="file"]')) {
      throw new Error("构图图片节点未双击时不应显示上传控件");
    }
    image.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await nextFrame();
    const editor = document.body.querySelector<HTMLElement>(
      '[data-yisiui-asset="human2ai/canvas-node-editor"]',
    );
    if (!editor?.querySelector('input[type="file"][accept*="image/png"]')) {
      throw new Error("双击构图图片节点后必须显示上传控件");
    }
    const imageFields = editor.querySelector<HTMLElement>(
      '[data-yisiui-asset="human2ai/canvas-image-editor-fields"]',
    );
    const note = editor.querySelector<HTMLElement>('[aria-label="备注"]');
    if (
      !imageFields
      || !note
      || imageFields.getBoundingClientRect().left <= note.getBoundingClientRect().right
    ) {
      throw new Error("图片内容必须完整位于节点属性右侧");
    }
    if (editor.querySelector(".ant-slider") || editor.querySelector("[data-crop-selection]")) {
      throw new Error("空图片节点不应显示滑动条或裁剪选择框");
    }
  },
};

export const ReferenceImage: Story = {
  name: "预览仅显示图片内容",
  args: { draft: addCompositionImage(createDraft()).draft },
  render: () => <ReferenceImageExample />,
  play: ({ canvasElement }) => {
    const node = canvasElement.querySelector<SVGGElement>(
      '[data-composition-kind="image"]',
    );
    const image = node?.querySelector<SVGImageElement>(".human2ai-canvas-image__content");
    const boundary = node?.querySelector<SVGRectElement>(".human2ai-canvas-image__boundary");
    if (!node || !image || !boundary) {
      throw new Error("预览图片 Story 必须渲染图片内容及其内部边界元素");
    }
    if (getComputedStyle(boundary).display !== "none") {
      throw new Error("预览中的图片节点边界必须隐藏");
    }
    if (
      node.getAttribute("role") === "button"
      || node.querySelector(
        ".human2ai-canvas-node__outline, [data-resize-handle], [data-rotation-handle]",
      )
    ) {
      throw new Error("预览中的图片节点不得暴露节点操作边框或交互控件");
    }
  },
};

export const CameraReference: Story = {
  name: "透明镜头节点与宽编辑面板",
  args: { draft: createDraft() },
  render: () => <CameraReferenceExample />,
  play: async ({ canvasElement }) => {
    const node = canvasElement.querySelector<SVGGElement>('[data-composition-kind="image"]')!;
    const boundary = node.querySelector('.human2ai-canvas-image__boundary')!;
    if (getComputedStyle(boundary).fill !== 'rgba(0, 0, 0, 0)') throw new Error("已显示的镜头图片不能覆盖透明区域");
    node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    // Wait for the shared modal's opening transform before measuring its layout.
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if ((document.body.querySelector('.ant-modal')?.getBoundingClientRect().width ?? 0) >= 879) break;
    }
    const editor = document.body.querySelector<HTMLElement>('.human2ai-canvas-node-editor')!;
    const left = editor.querySelector('.human2ai-canvas-node-editor__primary-fields')!.getBoundingClientRect();
    const right = editor.querySelector('.human2ai-canvas-node-editor__side-fields')!.getBoundingClientRect();
    const modal = editor.closest('.ant-modal')!.getBoundingClientRect();
    if (modal.width < 879 || left.width < 350 || right.left <= left.right) throw new Error("镜头编辑器应加宽并保证两栏独立可读");
    if (editor.scrollWidth > editor.clientWidth || modal.left < 0 || modal.right > innerWidth) throw new Error("镜头面板不能横向溢出");
    assertStoryText(editor, zh.spatial.openSource);
    assertStoryText(editor, zh.spatial.snapshot);
  },
};

export const CameraReferenceEnglish: Story = {
  ...CameraReference,
  name: "英文镜头编辑动作",
  render: () => <CameraReferenceExample english />,
  play: async ({ canvasElement }) => {
    canvasElement.querySelector('[data-composition-kind="image"]')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 350));
    const editor = document.body.querySelector<HTMLElement>('.human2ai-canvas-node-editor')!;
    assertStoryText(editor, en.spatial.openSource);
    assertStoryText(editor, en.spatial.snapshot);
  },
};

export const NodeMetadataEditors: Story = {
  name: "形状焦点与动势线信息",
  args: { draft: createExampleDraft() },
  render: () => <SelectableCanvasExample />,
  play: async ({ canvasElement }) => {
    const harness = canvasElement.querySelector<HTMLElement>("[data-composition-metadata-harness]");
    if (!harness) throw new Error("节点信息 Story 缺少受控草图容器");
    for (const target of [
      { id: "area-1", kind: "shape", value: "形状备注", datasetKey: "nodeNote" },
      { id: "focus-1", kind: "point", value: "焦点备注", datasetKey: "focusNote" },
      { id: "direction-1", kind: "line", value: "方向备注", datasetKey: "directionNote" },
    ] as const) {
      const node = canvasElement.querySelector<SVGGElement>(
        `[data-composition-item="${target.id}"]`,
      );
      if (!node) throw new Error(`节点信息 Story 缺少 ${target.id}`);
      const bounds = node.getBoundingClientRect();
      node.dispatchEvent(new MouseEvent("dblclick", {
        bubbles: true,
        clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + bounds.height / 2,
      }));
      await nextFrame();
      assertStorySelector(
        document.body,
        `[data-yisiui-asset="human2ai/canvas-node-editor"][data-node-kind="${target.kind}"]`,
      );
      const editor = document.body.querySelector<HTMLElement>(
        '[data-yisiui-asset="human2ai/canvas-node-editor"]',
      );
      if (!editor) throw new Error("节点信息 Story 没有打开编辑器");
      setInputValue(requiredInput(editor, "备注"), target.value);
      await nextFrame();
      if (harness.dataset[target.datasetKey] !== target.value) {
        throw new Error(`${target.id} 的备注没有写回构图草图`);
      }
    }
    const editor = document.body.querySelector<HTMLElement>(
      '[data-yisiui-asset="human2ai/canvas-node-editor"]',
    );
    if (!editor) throw new Error("节点信息 Story 缺少删除面板");
    findButton(editor, "删除节点").click();
    await nextFrame();
    const deleteButtons = [...document.body.querySelectorAll<HTMLButtonElement>("button")]
      .filter((button) => button.textContent?.trim() === "删除节点");
    const confirmDelete = deleteButtons.at(-1);
    if (!confirmDelete) throw new Error("构图节点删除缺少确认按钮");
    confirmDelete.click();
    await nextFrame();
    if (canvasElement.querySelector('[data-composition-item="direction-1"]')) {
      throw new Error("编辑面板确认删除后动势线仍然存在");
    }
  },
};

export const LightSource: Story = {
  name: "光源开关与形状预览",
  args: { draft: createExampleDraft() },
  render: () => <SelectableCanvasExample />,
  play: async ({ canvasElement }) => {
    for (const id of ["area-1", "area-2", "area-3"]) {
      const node = canvasElement.querySelector<SVGGElement>(`[data-composition-item="${id}"]`);
      if (!node) throw new Error(`光源示例缺少图形 ${id}`);
      const transform = node.getAttribute("transform");
      node.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      await nextFrame();
      const toggle = document.body.querySelector<HTMLButtonElement>('[role="switch"][aria-label="作为光源"]');
      if (!toggle || toggle.getAttribute("aria-checked") !== "false") throw new Error("光源开关应默认关闭");
      toggle.click();
      await nextFrame();
      assertStorySelector(canvasElement, `[data-composition-item="${id}"] [data-region-kind="light-source"]`);
      if (node.getAttribute("transform") !== transform) throw new Error("切换光源不得改变形状位置或角度");
      toggle.click();
      await nextFrame();
      if (node.querySelector('[data-region-kind="light-source"]')) throw new Error("关闭光源应恢复普通形状");
      toggle.click();
      await nextFrame();
    }
  },
};

export const LightSourceReference: Story = {
  name: "无描边的光源参考",
  args: {
    draft: ["area-1", "area-2", "area-3"].reduce(
      (draft, id) => updateAreaMetadata(draft, id, { isLightSource: true }),
      createExampleDraft(),
    ),
    appearance: "reference",
    style: { height: "100vh" },
  },
  play: async ({ canvasElement }) => {
    const lights = canvasElement.querySelectorAll('[data-region-kind="light-source"]');
    if (lights.length !== 3) throw new Error("三种光源都应出现在参考预览中");
    for (const light of lights) {
      const shape = light.querySelector("circle, ellipse, polygon");
      if (!shape || getComputedStyle(shape).stroke !== "none" || !light.querySelector("feGaussianBlur")) {
        throw new Error("光源参考应无描边并柔化边缘");
      }
    }
    assertStorySelector(canvasElement, '[data-light-source-id="area-3"] linearGradient');
    assertStorySelector(canvasElement, '[data-light-source-id="area-1"] radialGradient');
  },
};

export const TextRegion: Story = {
  name: "文字区域节点",
  args: { draft: createTextRegionDraft() },
  render: () => <TextRegionExample />,
  play: async ({ canvasElement }) => {
    const node = canvasElement.querySelector<SVGGElement>(
      '[data-composition-kind="text-region"]',
    );
    if (!node) throw new Error("构图画布缺少文字区域节点");
    if (canvasElement.querySelector<HTMLElement>("[data-processing-semantic]")?.dataset.processingSemantic !== "unselected") {
      throw new Error("添加文字区域不应自动切换草稿构图模式");
    }
    if (node.querySelectorAll(".human2ai-composition-canvas__text-region-marks line").length !== 3) {
      throw new Error("文字区域缺少稳定的文本占位视觉");
    }
    if (node.querySelectorAll("[data-resize-handle]").length !== 8) {
      throw new Error("选中的文字区域需要八向缩放能力");
    }

    node.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await nextFrame();
    const editor = document.body.querySelector<HTMLElement>(
      '[data-yisiui-asset="human2ai/canvas-node-editor"][data-node-kind="text"]',
    );
    if (!editor) throw new Error("双击文字区域没有打开文字节点编辑器");
    assertStoryText(document.body, "编辑节点 · 文字区域");
    if (!editor.querySelector('[aria-label="景别"]')) {
      throw new Error("文字区域编辑器缺少景别字段");
    }
    const displayText = requiredInput(editor, "显示文字");
    if (displayText.value !== "静观") {
      throw new Error("文字区域编辑器没有显示当前的显示文字");
    }
    const visualWeight = Array.from(
      editor.querySelectorAll<HTMLElement>(".human2ai-canvas-node-editor__property-select"),
    ).find((select) => select.textContent?.includes("高"));
    if (!visualWeight) {
      throw new Error("文字区域编辑器没有显示当前视觉权重");
    }
    setInputValue(displayText, "静观自得");
    setInputValue(requiredInput(editor, "备注"), "左上主标题，右下留白");
    await nextFrame();
    const harness = canvasElement.querySelector<HTMLElement>("[data-text-region-note]");
    if (
      harness?.dataset.textRegionNote !== "左上主标题，右下留白"
      || harness.dataset.textRegionDisplayText !== "静观自得"
    ) {
      throw new Error("文字区域字段没有即时写回构图草图");
    }
  },
};

export const LockedFrame: Story = {
  name: "锁定画框",
  args: { draft: createExampleDraft() },
  render: () => <LockedFrameExample />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, 'svg[data-frame-locked="true"]');
    const frame = canvasElement.querySelector<SVGRectElement>(
      '[data-canvas-frame="composition-frame"] .human2ai-canvas-frame__border',
    );
    const frameNode = canvasElement.querySelector<SVGGElement>(
      '[data-canvas-node="composition-frame"]',
    );
    if (!frame || !frameNode) throw new Error("Locked frame story is missing the composition frame");
    if (frameNode.hasAttribute("role") || frameNode.hasAttribute("tabindex")) {
      throw new Error("Locked frame must not be selectable with pointer or keyboard");
    }
    if (getComputedStyle(frameNode).pointerEvents !== "none") {
      throw new Error("Locked frame must not receive hover or pointer interaction");
    }
    if (frameNode.querySelector("[data-resize-handle], [data-rotation-handle]")) {
      throw new Error("Locked frame must not render resize hit zones");
    }

    const area = canvasElement.querySelector<SVGGElement>('[data-composition-item="area-1"]');
    if (!area) throw new Error("Locked frame story is missing the editable area");
    const initialX = Number(area.dataset.nodeX);
    area.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await nextFrame();
    const movedShape = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-1"]',
    );
    if (Number(movedShape?.dataset.nodeX) <= initialX) {
      throw new Error("Frame locking must not disable composition item editing");
    }
  },
};

export const ExpandedWorld: Story = {
  name: "标准无限画布导航",
  args: { draft: createExampleDraft() },
  render: () => <ExpandedWorldExample />,
  play: async ({ canvasElement }) => {
    await nextFrame();
    await nextFrame();
    const viewport = canvasElement.querySelector<HTMLElement>(
      '[data-yisiui-asset="human2ai/infinite-canvas-viewport"]',
    );
    const svg = canvasElement.querySelector<SVGSVGElement>(
      ".human2ai-composition-canvas__svg",
    );
    if (!viewport || !svg) throw new Error("Infinite canvas story is missing the canvas");
    const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = (svg.getAttribute("viewBox") ?? "")
      .split(" ")
      .map(Number);
    if (viewBoxX >= 0 || viewBoxY >= 0) {
      throw new Error("Infinite canvas did not expose negative world coordinates");
    }
    const bounds = svg.getBoundingClientRect();
    if (
      Math.abs(bounds.width / viewBoxWidth - Number(svg.dataset.cameraZoom)) > 0.01 ||
      Math.abs(bounds.height / viewBoxHeight - Number(svg.dataset.cameraZoom)) > 0.01
    ) {
      throw new Error("Infinite canvas viewBox did not preserve the controlled zoom");
    }
    if (getComputedStyle(viewport).overflow !== "hidden") {
      throw new Error("Canvas viewport must hide native scrollbars");
    }

    const startX = bounds.left + bounds.width / 2;
    const startY = bounds.top + bounds.height / 2;
    const initialCameraX = Number(svg.dataset.cameraCenterX);
    const initialCameraY = Number(svg.dataset.cameraCenterY);
    svg.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 2,
        buttons: 2,
        clientX: startX,
        clientY: startY,
        pointerId: 11,
      }),
    );
    svg.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        buttons: 2,
        clientX: startX + 80,
        clientY: startY + 40,
        pointerId: 11,
      }),
    );
    svg.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 2,
        clientX: startX + 80,
        clientY: startY + 40,
        pointerId: 11,
      }),
    );
    await nextFrame();
    const rightDragCameraX = Number(svg.dataset.cameraCenterX);
    if (
      rightDragCameraX >= initialCameraX ||
      Number(svg.dataset.cameraCenterY) >= initialCameraY
    ) {
      throw new Error("Secondary-button drag did not pan toward negative world coordinates");
    }

    viewport.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
    svg.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: startX,
        clientY: startY,
        pointerId: 12,
      }),
    );
    svg.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        buttons: 1,
        clientX: startX - 30,
        clientY: startY - 20,
        pointerId: 12,
      }),
    );
    svg.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        clientX: startX - 30,
        clientY: startY - 20,
        pointerId: 12,
      }),
    );
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", bubbles: true }));
    await nextFrame();
    if (Number(svg.dataset.cameraCenterX) <= rightDragCameraX) {
      throw new Error("Space plus primary-button drag did not pan back across the infinite world");
    }

    const zoomBeforeWheel = Number(svg.dataset.cameraZoom);
    svg.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: startX,
        clientY: startY,
        deltaY: -120,
      }),
    );
    await nextFrame();
    if (Number(svg.dataset.cameraZoom) <= zoomBeforeWheel) {
      throw new Error("Wheel input did not zoom the world camera around the pointer");
    }
  },
};

export const ScreenStableDirectionControl: Story = {
  name: "动势线双点控制",
  args: { draft: createExampleDraft() },
  render: () => <ScreenStableDirectionControlExample />,
  play: async ({ canvasElement }) => {
    await nextFrame();
    const svg = canvasElement.querySelector<SVGSVGElement>(
      ".human2ai-composition-canvas__svg",
    );
    if (!svg) throw new Error("Missing composition canvas");
    const controls = () => [...canvasElement.querySelectorAll<SVGGElement>(
      '[data-handle="move-direction-point"]',
    )];
    const point = (index: number) => {
      const matrix = controls()[index].transform.baseVal.consolidate()!.matrix;
      return { x: matrix.e, y: matrix.f };
    };
    const close = (actual: { x: number; y: number }, expected: { x: number; y: number }) => {
      if (Math.hypot(actual.x - expected.x, actual.y - expected.y) > 0.001) {
        throw new Error(`Control point moved unexpectedly: ${JSON.stringify({ actual, expected })}`);
      }
    };
    const draftLine = () => canvasElement.querySelector("[data-direction-draft]")!.textContent;
    const key = async (value: string, ctrlKey = false, shiftKey = false) => {
      controls()[1].dispatchEvent(new KeyboardEvent("keydown", { key: value, ctrlKey, shiftKey, bubbles: true, cancelable: true }));
      controls()[1].dispatchEvent(new KeyboardEvent("keyup", { key: value, ctrlKey, shiftKey, bubbles: true }));
      await nextFrame();
    };
    const stableSize = () => {
      const zoom = Number(svg.dataset.cameraZoom);
      if (controls().length !== 2 || canvasElement.querySelector('[data-handle="rotate-direction"]')) {
        throw new Error("A selected flow line must expose exactly two point controls");
      }
      for (const control of controls()) {
        const visible = control.querySelector(".human2ai-composition-canvas__transform-handle")!;
        const hit = control.querySelector(".human2ai-composition-canvas__transform-hit")!;
        if (Math.abs(Number(visible.getAttribute("r")) * zoom - 7) > 0.001
          || Math.abs(Number(hit.getAttribute("r")) * zoom - 12) > 0.001
          || !control.getAttribute("aria-label") || control.tabIndex !== 0) {
          throw new Error("Point controls must remain screen-sized and keyboard accessible");
        }
      }
    };
    const drag = async (index: number, target: { x: number; y: number }) => {
      const moving = point(index);
      const fixed = point(1 - index);
      const matrix = svg.getScreenCTM()!;
      // Begin off-center in the hit area to ensure grabbing never snaps the point.
      const screen = (position: { x: number; y: number }) => new DOMPoint(position.x, position.y).matrixTransform(matrix);
      const start = screen(moving);
      const pointer = (type: string, position: DOMPoint, element: Element = svg) => element.dispatchEvent(new PointerEvent(type, {
        pointerId: 73, button: 0, buttons: type === "pointerup" ? 0 : 1,
        clientX: position.x + 4, clientY: position.y + 3, bubbles: true, cancelable: true,
      }));
      pointer("pointerdown", start, controls()[index]);
      for (const fraction of [0.5, 1]) {
        const next = { x: moving.x + (target.x - moving.x) * fraction, y: moving.y + (target.y - moving.y) * fraction };
        pointer("pointermove", screen(next));
        await nextFrame();
        close(point(index), next);
        close(point(1 - index), fixed);
      }
      pointer("pointerup", screen(target));
      await nextFrame();
      const line = JSON.parse(draftLine()!);
      const radians = line.rotation * Math.PI / 180;
      for (const p of [point(0), point(1)]) {
        const distance = Math.abs((p.x - line.x * COMPOSITION_CANVAS.width) * Math.sin(radians)
          - (p.y - line.y * COMPOSITION_CANVAS.height) * Math.cos(radians));
        if (!Number.isFinite(distance) || distance > 0.001) throw new Error("The infinite line must pass through both controls");
      }
    };
    stableSize();
    const before = draftLine();
    await drag(0, { x: point(0).x - 24, y: point(0).y + 36 });
    const after = draftLine();
    if (before === after) throw new Error("Dragging must update the composition draft");
    await key("z", true);
    if (draftLine() !== before) throw new Error("One undo must restore the whole point drag");
    await key("z", true, true);
    if (draftLine() !== after) throw new Error("Redo must restore the line position and angle");
    await drag(1, { x: point(0).x, y: point(0).y - 40 });
    await drag(1, { x: point(0).x + 80, y: point(0).y });
    await drag(0, { x: point(1).x + 20, y: point(1).y + 40 });
    await drag(1, point(0));
    await drag(0, { x: point(1).x - 120, y: point(1).y + 60 });
    const fixed = point(0);
    const moving = point(1);
    controls()[1].focus();
    await key("ArrowRight", false, true);
    close(point(0), fixed);
    close(point(1), { x: moving.x + 10 / Number(svg.dataset.cameraZoom), y: moving.y });
    if (document.activeElement !== controls()[1]) throw new Error("Keyboard adjustment must retain point focus");
    const previousPoints = [point(0), point(1)];
    svg.dispatchEvent(new WheelEvent("wheel", { deltaY: 3000, bubbles: true, cancelable: true }));
    await nextFrame();
    if (Number(svg.dataset.cameraZoom) !== 0.25) throw new Error("Expected minimum zoom");
    stableSize();
    close(point(0), previousPoints[0]);
    close(point(1), previousPoints[1]);
    await drag(1, { x: -120, y: -100 });
    await key("z", true);
    svg.dispatchEvent(new WheelEvent("wheel", { deltaY: -3000, bubbles: true, cancelable: true }));
    await nextFrame();
    stableSize();
    canvasElement.dataset.directionChecks = "passed";
  },
};

export const Interactive: Story = {
  name: "交互工作台",
  args: { draft: createExampleDraft() },
  render: () => <CompositionCanvasWorkbench />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="human2ai/composition-canvas"]');
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/basic-button"]');
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/side-action-panel"]');
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/composite-button"]');
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/aspect-ratio-selector"]');
    assertStorySelector(canvasElement, '[data-composition-guide-grid="true"]');
    assertStoryRole(canvasElement, "group");
    assertStoryText(canvasElement, "构图画布");

    const guideGridSwitch = canvasElement.querySelector<HTMLButtonElement>('[role="switch"]');
    if (!guideGridSwitch || guideGridSwitch.getAttribute("aria-checked") !== "true") {
      throw new Error("Story interaction contract missing enabled guide grid switch");
    }
    guideGridSwitch.click();
    await nextFrame();
    if (canvasElement.querySelector('[data-composition-guide-grid="true"]')) {
      throw new Error("Story interaction contract did not hide the guide grid");
    }

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

    const circle = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-1"]',
    );
    const direction = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="direction-1"]',
    );
    if (!circle || !direction) {
      throw new Error("Story clipboard contract is missing its multi-selection targets");
    }
    circle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }),
    );
    await nextFrame();
    direction.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }),
    );
    await nextFrame();
    const clipboardData = new DataTransfer();
    triangle.dispatchEvent(new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData }));
    triangle.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }));
    await nextFrame();
    const pastedTriangle = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-4"][data-selected="true"]',
    );
    const pastedCircle = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-5"][data-selected="true"]',
    );
    if (
      Number(pastedTriangle?.dataset.nodeX) !== Number(triangle.dataset.nodeX) + 24
      || Number(pastedTriangle?.dataset.nodeY) !== Number(triangle.dataset.nodeY) + 24
      || Number(pastedTriangle?.dataset.nodeRotation) !== Number(triangle.dataset.nodeRotation)
      || Number(pastedCircle?.dataset.nodeX) !== Number(circle.dataset.nodeX) + 24
      || Number(pastedCircle?.dataset.nodeY) !== Number(circle.dataset.nodeY) + 24
    ) {
      throw new Error("Multi-item paste must preserve properties and offset copied nodes");
    }
    if (
      canvasElement.querySelectorAll('[data-composition-item="direction-1"]').length !== 1
      || direction.dataset.selected === "true"
    ) {
      throw new Error("Paste must skip a direction line that would exceed its limit");
    }

    findButton(canvasElement, "焦点").click();
    await nextFrame();
    await placeNodeInStory(canvasElement);
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
    const initialFocusX = Number(focus.dataset.nodeX);
    const initialFocusY = Number(focus.dataset.nodeY);
    const bounds = svg.getBoundingClientRect();
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error("Story interaction contract could not resolve the canvas matrix");
    const screenPoint = new DOMPoint(initialFocusX, initialFocusY).matrixTransform(matrix);
    const clientX = screenPoint.x;
    const clientY = screenPoint.y;
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
    const movedFocus = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="focus-2"]',
    );
    if (Number(movedFocus?.dataset.nodeX) <= initialFocusX) {
      throw new Error("Story interaction contract did not drag the selected focus point");
    }

    setInputValue(requiredInput(canvasElement, "宽"), "5");
    await nextFrame();
    setInputValue(requiredInput(canvasElement, "高"), "4");
    await nextFrame();
    assertStorySelector(canvasElement, '[data-ratio-value="5:4"]');
    const customFrame = canvasElement.querySelector<SVGRectElement>(
      '[data-canvas-frame="composition-frame"] .human2ai-canvas-frame__border',
    );
    if (
      Math.abs(
        Number(customFrame?.getAttribute("width")) /
          Number(customFrame?.getAttribute("height")) -
          5 / 4,
      ) > 0.002
    ) {
      throw new Error("Story interaction contract did not apply the custom frame ratio");
    }

    const squareRatio = canvasElement.querySelector<HTMLButtonElement>('[data-ratio-key="1:1"]');
    if (!squareRatio) throw new Error("Story interaction contract missing square ratio");
    squareRatio.click();
    await nextFrame();
    const squareFrame = canvasElement.querySelector<SVGRectElement>(
      '[data-canvas-frame="composition-frame"] .human2ai-canvas-frame__border',
    );
    if (
      Math.abs(
        Number(squareFrame?.getAttribute("width")) /
          Number(squareFrame?.getAttribute("height")) -
          1,
      ) > 1e-9
    ) {
      throw new Error("Story interaction contract did not apply the square frame ratio");
    }
  },
};

export const NarrowToolbar: Story = {
  name: "窄视口工具栏",
  args: { draft: createExampleDraft() },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  render: () => <CompositionCanvasWorkbench />,
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/side-action-panel"]');
    assertStorySelector(canvasElement, '[data-yisiui-asset="human2ai/composition-canvas"]');
    assertStorySelector(canvasElement, '[data-icon="line"]');
    assertStoryText(canvasElement, "动势线");
    assertStoryText(canvasElement, "1/3");
    assertStoryText(canvasElement, "1/1");
  },
};

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!button) throw new Error(`Story interaction contract missing button: ${label}`);
  return button;
}

function requiredInput(root: HTMLElement, label: string): HTMLInputElement | HTMLTextAreaElement {
  const input = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`);
  if (!input) throw new Error(`Story interaction contract missing field: ${label}`);
  return input;
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("Story interaction contract missing value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function selectOption(root: HTMLElement, label: string, optionLabel: string): Promise<void> {
  const input = root.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  const selector = input?.closest(".ant-select")?.querySelector<HTMLElement>(
    ".ant-select-content",
  );
  if (!selector) throw new Error(`Story interaction contract missing select: ${label}`);
  selector.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  await nextFrame();
  const option = [...document.body.querySelectorAll<HTMLElement>(".ant-select-item-option")]
    .find((candidate) => candidate.textContent?.trim() === optionLabel);
  if (!option) throw new Error(`Story interaction contract missing option: ${optionLabel}`);
  option.click();
}

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
  throw new Error("Selected composition shapes must only show the operation outline");
}
