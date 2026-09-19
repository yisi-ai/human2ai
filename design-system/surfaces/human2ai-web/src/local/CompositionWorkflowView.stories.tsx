import { AimOutlined } from "@ant-design/icons";
import { CompositeButton } from "@human2ai/ui/yisiui/composite-button";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";
import { createAppI18n } from "../../../../../web/i18n/createI18n";
import { UiSketchStateTabs } from "./UiSketchStateTabs";

import {
  addArea,
  addDirectionLine,
  addFocus,
  applyRefinementPlan,
  changeFrame,
  compositionFrameSizeForRatio,
  createCompositionWorkflowState,
  createDraft,
  setProcessingSemantic,
  framePointToCanvas,
  type DirectedRefinementPlan,
  draftFingerprint,
  moveItem,
  receiveCompositionRefinement,
  rotateDirectionLine,
  updateCompositionWorkflowDraft,
  type CompositionDraft,
  type CompositionRefinementResult,
  type CompositionWorkflowStatus,
  compositionStates, createCompositionState, selectCompositionState,
  renameCompositionState, reorderCompositionStates, deleteCompositionState, validateDraft,
} from "../../../../../src/domain/composition";
import {
  assertStorySelector,
  assertStoryText,
} from "../vendor/yisiui/storybook/interactionChecks";
import {
  CompositionWorkflowView,
  type CompositionWorkflowViewKey,
} from "./CompositionWorkflowView";

import "./CompositionWorkflowView.stories.css";

const fixture = createReadyFixture();

function WorkflowHarness({
  initialStatus,
  initialDraft = fixture.draft,
  initialRefinement = initialStatus === "ready" ? fixture.refinement : null,
}: {
  initialStatus: CompositionWorkflowStatus;
  initialDraft?: CompositionDraft;
  initialRefinement?: CompositionRefinementResult | null;
}) {
  const [workflow, setWorkflow] = useState(() => ({
    ...createCompositionWorkflowState(initialDraft),
    status: initialStatus,
    refinement: initialRefinement,
  }));
  const [activeView, setActiveView] = useState<CompositionWorkflowViewKey>("draft");
  const [selectedIds, setSelectedIds] = useState<string[]>(["area-1"]);
  const [canvasZoom, setCanvasZoom] = useState(1);

  return (
    <main className="composition-workflow-story">
      <CompositionWorkflowView
        draft={workflow.draft}
        status={workflow.status}
        refinement={workflow.refinement}
        activeView={activeView}
        onViewChange={setActiveView}
        showDraftGuideGrid
        canvasZoom={canvasZoom}
        canvasViewportAction={{ id: 1, type: "fit-frame" }}
        onCanvasZoomChange={setCanvasZoom}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        canvasSideActions={(
          <CompositeButton
            icon={<AimOutlined aria-hidden="true" />}
            label="焦点"
            onClick={() => undefined}
          />
        )}
        canvasSideActionPanelWidth={180}
        canvasSideActionPanelDefaultCollapsed
        onDraftChange={(draft) => {
          setWorkflow((current) => updateCompositionWorkflowDraft(current, draft));
          setActiveView("draft");
        }}
      />
    </main>
  );
}

const meta = {
  id: "human2ai-composition-workflow-view",
  title: "human2ai/CompositionWorkflowView",
  component: CompositionWorkflowView,
  parameters: { layout: "fullscreen" },
  args: {
    draft: fixture.draft,
    status: "waiting",
    refinement: null,
    activeView: "draft",
    onViewChange: () => undefined,
  },
} satisfies Meta<typeof CompositionWorkflowView>;

export default meta;
type Story = StoryObj<typeof meta>;

function LayoutStatesHarness() {
  const t = createAppI18n("zh-CN").t;
  const [draft, setDraft] = useState(() => {
    let next = renameCompositionState(fixture.draft, "state-1", "横版");
    next = createCompositionState(next, "state-1", "portrait");
    next = changeFrame(next, { width: 900, height: 1600 });
    next = moveItem(next, "area-1", { x: 0.7, y: 0.6 });
    return selectCompositionState(renameCompositionState(next, "portrait", "竖版"), "state-1");
  });
  const states = compositionStates(draft);
  return (
    <main className="composition-workflow-story" data-layout-state={draft.activeStateId}>
      <CompositionWorkflowView
        draft={draft} status="waiting" activeView="draft" onViewChange={() => undefined}
        onDraftChange={(next) => setDraft(validateDraft(next))}
        canvasViewportAction={{ id: 1, type: "fit-frame" }}
        stateControls={(
            <UiSketchStateTabs
              items={states.map((state) => ({ id: state.id, label: state.name ?? t("uiSketch.states.defaultName", { number: state.number }) }))}
              value={draft.activeStateId!}
              labels={{
                switch: t("canvasStates.switch"), rename: t("actions.rename"), name: t("uiSketch.states.name"),
                add: t("uiSketch.views.enableMotion"),
                new: t("uiSketch.states.new"), delete: t("uiSketch.states.delete"), cancel: t("actions.cancel"),
                reorderHint: t("uiSketch.states.reorderHint"),
                actions: (name) => t("uiSketch.states.actions", { name }),
                deleteTitle: (name) => t("uiSketch.states.deleteTitle", { name }),
              }}
              onChange={(id) => setDraft((current) => selectCompositionState(current, id))}
              onCreate={(id) => setDraft((current) => createCompositionState(current, id, crypto.randomUUID()))}
              onRename={(id, name) => setDraft((current) => renameCompositionState(current, id, name))}
              onReorder={(ids) => setDraft((current) => reorderCompositionStates(current, ids))}
              onDelete={(id) => setDraft((current) => deleteCompositionState(current, id))}
            />
        )}
      />
    </main>
  );
}

export const LayoutStates: Story = {
  name: "自定义构图状态与独立布局",
  render: () => <LayoutStatesHarness />,
  play: async ({ canvasElement }) => {
    const tab = (id: string) => canvasElement.querySelector<HTMLButtonElement>(`[data-state-id="${id}"] button[aria-pressed]`)!;
    const frame = () => canvasElement.querySelector('[data-canvas-frame="composition-frame"]')!.outerHTML;
    const area = () => canvasElement.querySelector('[data-composition-item="area-1"]')!.outerHTML;
    const originalFrame = frame();
    const originalArea = area();
    if (canvasElement.querySelector('[data-yisiui-asset="yisiui/tab-switch"]')) throw new Error("Fixed view tabs remain visible");
    tab("state-1").focus();
    tab("state-1").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await nextFrame();
    await nextFrame();
    if (document.activeElement !== tab("portrait")) throw new Error("State switch lost keyboard focus");
    if (frame() === originalFrame || area() === originalArea) throw new Error("State switch did not restore frame and node geometry");
    tab("state-1").click();
    await nextFrame();
    if (frame() !== originalFrame || area() !== originalArea) throw new Error("Original state layout changed");
    canvasElement.dataset.layoutStatesPassed = "true";
  },
};

export const Ready: Story = {
  name: "完成与失效交互",
  render: () => <WorkflowHarness initialStatus="ready" />,
  play: async ({ canvasElement }) => {
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="human2ai/composition-workflow-view"]',
    );
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/tab-switch"]');
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/side-action-panel"]');
    const sidePanel = canvasElement.querySelector<HTMLElement>(
      '[data-yisiui-asset="yisiui/side-action-panel"]',
    );
    if (
      !sidePanel
      || sidePanel.dataset.collapsed !== "true"
      || Math.round(sidePanel.getBoundingClientRect().width) !== 48
    ) {
      throw new Error("Composition side actions must initially render as a collapsed rail");
    }
    const expandSidePanel = canvasElement.querySelector<HTMLButtonElement>(
      'button[aria-label="展开画布操作"]',
    );
    if (!expandSidePanel) throw new Error("Composition side actions are missing expand control");
    expandSidePanel.click();
    await nextFrame();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 200));
    if (
      !sidePanel.matches('[data-collapsed="false"]')
      || Math.round(sidePanel.getBoundingClientRect().width) !== 180
    ) {
      throw new Error("Composition side action width was not forwarded to the canvas");
    }
    assertStorySelector(canvasElement, '[data-composition-guide-grid="true"]');

    findRadio(canvasElement, "精修").click();
    await nextFrame();
    assertStorySelector(canvasElement, '[data-active-view="refined"]');
    assertStorySelector(canvasElement, '[data-canvas-frame="composition-frame"]');
    assertStoryText(canvasElement, "Agent 判断");
    if (canvasElement.querySelector('[data-composition-guide-grid="true"]')) {
      throw new Error("Agent refinement view must not render the guide grid");
    }

    findRadio(canvasElement, "预览").click();
    await nextFrame();
    assertStorySelector(canvasElement, '[data-active-view="reference"]');
    assertStorySelector(canvasElement, ".human2ai-composition-canvas--reference");
    assertStorySelector(canvasElement, 'svg[data-frame-crop="true"]');
    if (canvasElement.querySelector('[data-canvas-frame="composition-frame"]')) {
      throw new Error("Generation reference view must not render the composition frame");
    }
    if (canvasElement.querySelector('[data-composition-guide-grid="true"]')) {
      throw new Error("Generation reference view must not render the guide grid");
    }
    assertReadOnlyPreview(canvasElement);

    findRadio(canvasElement, "构图").click();
    await nextFrame();
    assertStorySelector(canvasElement, '[data-composition-guide-grid="true"]');
    const area = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-1"]',
    );
    if (!area) throw new Error("Story interaction contract missing editable area");
    area.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await nextFrame();
    assertStorySelector(canvasElement, '[data-workflow-status="stale"]');
    if (!findRadio(canvasElement, "精修").disabled) {
      throw new Error("Stale refinement tab must be disabled");
    }
    const staleAreaX = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-1"]',
    )?.dataset.nodeX;
    const previewRadio = findRadio(canvasElement, "预览");
    if (previewRadio.disabled) {
      throw new Error("Preview tab must remain available for a stale draft");
    }
    previewRadio.click();
    await nextFrame();
    assertStorySelector(canvasElement, '[data-active-view="reference"]');
    const previewAreaX = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-1"]',
    )?.dataset.nodeX;
    if (!staleAreaX || previewAreaX !== staleAreaX) {
      throw new Error("Stale preview must render the current draft");
    }
    assertReadOnlyPreview(canvasElement);
  },
};

export const Waiting: Story = {
  name: "等待 Agent",
  render: () => <WorkflowHarness initialStatus="waiting" />,
  play: async ({ canvasElement }) => {
    if (canvasElement.textContent?.includes("草图已就绪")) {
      throw new Error("Waiting explanation region must not be rendered");
    }
    const draftAreaX = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-1"]',
    )?.dataset.nodeX;
    const previewRadio = findRadio(canvasElement, "预览");
    if (previewRadio.disabled) {
      throw new Error("Preview tab must be available before Agent refinement");
    }
    previewRadio.click();
    await nextFrame();
    assertStorySelector(canvasElement, '[data-active-view="reference"]');
    const previewAreaX = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-1"]',
    )?.dataset.nodeX;
    if (!draftAreaX || previewAreaX !== draftAreaX) {
      throw new Error("Preview without refinement must render the current draft");
    }
    assertReadOnlyPreview(canvasElement);
  },
};

export const Processing: Story = {
  name: "Agent 加工中",
  render: () => <WorkflowHarness initialStatus="processing" />,
};

export const Stale: Story = {
  name: "草图修改后过期",
  render: () => (
    <WorkflowHarness
      initialStatus="stale"
      initialDraft={moveItem(fixture.draft, "area-1", { x: 0.52, y: 0.48 })}
      initialRefinement={fixture.refinement}
    />
  ),
};

export const PortraitPreview: Story = {
  name: "竖向画框自适应预览",
  render: () => (
    <WorkflowHarness
      initialStatus="waiting"
      initialDraft={changeFrame(
        fixture.draft,
        compositionFrameSizeForRatio(9, 16),
      )}
    />
  ),
  play: async ({ canvasElement }) => {
    findRadio(canvasElement, "预览").click();
    await nextFrame();
    assertStorySelector(canvasElement, '[data-active-view="reference"]');
    assertReadOnlyPreview(canvasElement);
  },
};

export const ErrorState: Story = {
  name: "审计失败",
  render: () => <WorkflowHarness initialStatus="error" />,
};

export const LongContent: Story = {
  name: "长 Agent 理由",
  render: () => {
    const refinement = structuredClone(fixture.refinement);
    refinement.plan.rationale =
      "Agent 判断主体已经形成稳定的左下—右上视觉动势，因此只把主焦点轻微贴合黄金分割锚点，并校正一个接近水平的结构面；不改变元素身份、大小、层级、裁切侧或用户原本的叙事方向。";
    return (
      <WorkflowHarness initialStatus="ready" initialRefinement={refinement} />
    );
  },
};

export const Narrow: Story = {
  name: "窄视口",
  parameters: { viewport: { defaultViewport: "mobile1" } },
  render: () => <WorkflowHarness initialStatus="ready" />,
};

function createReadyFixture(): {
  draft: CompositionDraft;
  refinement: CompositionRefinementResult;
} {
  let draft = addFocus(setProcessingSemantic(createDraft(), "scene-composition"), { x: 0.61, y: 0.39 }).draft;
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
    rotation: 2,
  }).draft;
  draft = addArea(draft, {
    primitive: "quadrilateral",
    aspect: "free",
    x: 0.58,
    y: 0.72,
    area: 0.12,
    rotation: 358,
  }).draft;
  const direction = addDirectionLine(draft);
  draft = rotateDirectionLine(direction.draft, direction.id, 338);

  const refinement = applyRefinementPlan(draft, {
    version: 1,
    kind: "composition-refinement-plan",
    sourceFingerprint: draftFingerprint(draft),
    rationale: "Agent chooses a nearby golden focus and horizontal structural alignment.",
    operations: [
      {
        method: "focus-anchor",
        methodVersion: 1,
        targetFocusId: "focus-1",
        anchor: "golden-right-upper",
        strength: "subtle",
      },
      {
        method: "rotation-alignment",
        methodVersion: 1,
        targetAreaIds: ["area-2", "area-3"],
        axis: "horizontal",
        strength: "subtle",
      },
    ],
  });
  return { draft, refinement };
}

function findRadio(root: HTMLElement, label: string): HTMLInputElement {
  const radio = Array.from(root.querySelectorAll<HTMLLabelElement>("label")).find(
    (item) => item.textContent?.includes(label),
  )?.querySelector<HTMLInputElement>('input[type="radio"]');
  if (!radio) throw new Error(`Story interaction contract missing radio: ${label}`);
  return radio;
}

function assertReadOnlyPreview(root: HTMLElement): void {
  assertPreviewLayout(root);
  const nodes = Array.from(
    root.querySelectorAll<SVGGElement>("[data-composition-item]"),
  );
  if (nodes.length === 0) {
    throw new Error("Preview must render composition nodes");
  }
  for (const node of nodes) {
    if (
      node.getAttribute("role") === "button" ||
      node.hasAttribute("tabindex") ||
      node.hasAttribute("aria-pressed") ||
      node.dataset.selected !== "false" ||
      node.dataset.resizable === "true" ||
      node.dataset.rotatable === "true" ||
      node.dataset.deletable === "true" ||
      node.querySelector("[data-resize-handle], [data-rotation-handle]")
    ) {
      throw new Error("Preview nodes must not expose editing interactions");
    }
  }
}

function assertPreviewLayout(root: HTMLElement): void {
  const stage = root.querySelector<HTMLElement>(
    ".human2ai-composition-workflow__stage",
  );
  const canvas = root.querySelector<HTMLElement>(
    ".human2ai-composition-canvas--reference",
  );
  const svg = canvas?.querySelector<SVGSVGElement>("svg[data-frame-crop=\"true\"]");
  if (!stage || !canvas || !svg) {
    throw new Error("Preview layout contract is missing its fitted frame");
  }
  if (root.querySelector(".human2ai-composition-workflow__reference-hint")) {
    throw new Error("Preview must not render a persistent hint below the frame");
  }
  if (
    stage.scrollWidth > stage.clientWidth ||
    stage.scrollHeight > stage.clientHeight ||
    getComputedStyle(stage).overflowX !== "hidden" ||
    getComputedStyle(stage).overflowY !== "hidden"
  ) {
    throw new Error("Preview stage must not expose scrollbars");
  }
  const viewBox = svg.viewBox.baseVal;
  const canvasBounds = canvas.getBoundingClientRect();
  const renderedBounds = svg.getBoundingClientRect();
  const svgStyles = getComputedStyle(svg);
  const frameBoundary = svg.querySelector<SVGRectElement>(
    'rect[data-composition-reference-frame="true"]',
  );
  if (
    svgStyles.borderRadius !== "0px" ||
    svgStyles.boxShadow !== "none" ||
    !frameBoundary ||
    frameBoundary.getAttribute("stroke") !==
      "var(--yisiui-color-border-interactive)" ||
    frameBoundary.getAttribute("stroke-width") !== "4" ||
    frameBoundary.getAttribute("vector-effect") !== "non-scaling-stroke"
  ) {
    throw new Error("Preview must render its blue 2px inner boundary as SVG");
  }
  if (
    renderedBounds.left - canvasBounds.left < 16 ||
    renderedBounds.top - canvasBounds.top < 16 ||
    canvasBounds.right - renderedBounds.right < 16 ||
    canvasBounds.bottom - renderedBounds.bottom < 16
  ) {
    throw new Error("Preview frame must retain space on every side");
  }
  const frameRatio = viewBox.width / viewBox.height;
  const renderedRatio = renderedBounds.width / renderedBounds.height;
  if (Math.abs(frameRatio - renderedRatio) > 0.01) {
    throw new Error("Preview boundary must preserve the composition frame ratio");
  }
  const stageBounds = stage.getBoundingClientRect();
  if (
    renderedBounds.left < stageBounds.left - 1 ||
    renderedBounds.top < stageBounds.top - 1 ||
    renderedBounds.right > stageBounds.right + 1 ||
    renderedBounds.bottom > stageBounds.bottom + 1
  ) {
    throw new Error("Preview frame must fit inside the available stage");
  }
  if (canvas.querySelector('[data-yisiui-asset="human2ai/infinite-canvas-viewport"]')) {
    throw new Error("Preview must not render zoom or pan controls");
  }
}

async function nextFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function createDirectedFixture(retain = false) {
  let draft = setProcessingSemantic(createDraft({ width: 1200, height: 800 }), "scene-composition");
  draft = addArea(draft, { primitive: "quadrilateral", aspect: "free", area: 0.04,
    ...framePointToCanvas({ x: 0.28, y: 0.45 }, draft.frame) }).draft;
  draft = addArea(draft, { primitive: "quadrilateral", aspect: "free", area: 0.07,
    ...framePointToCanvas({ x: 0.78, y: 0.67 }, draft.frame) }).draft;
  draft = addFocus(draft, { x: draft.areas[0].x, y: draft.areas[0].y - 0.02 }).draft;
  draft = addDirectionLine(draft).draft;
  const plan: DirectedRefinementPlan = {
    version: 2, kind: "composition-refinement-plan", sourceFingerprint: draftFingerprint(draft),
    decision: retain ? "retain" : "refine", objective: retain ? "保留两块之间的错落与开阔空间。" : "通过等大对称建立稳定关系，并让动势线引向左侧焦点。",
    assessment: { intent: "两个独立主体跨越留白形成呼应。", observations: ["两块的尺寸与高度不同，使重心偏向右下。"],
      uncertainties: ["内容仍是抽象形状，尚不指定人物或物体。"] },
    preserve: ["保留两块主体及其内容，左侧焦点随主体调整。"],
    tradeoffs: retain ? [] : ["对称会减弱原有的错落感，换取稳定和秩序。"],
    rationale: retain ? "当前不需要套用数学规则，先保留用户的空间安排。" : "本例选择对称和引导关系，不叠加无关的比例规则。",
    fixedIds: [], focusLinks: [{ focusId: "focus-1", areaId: "area-1" }],
    operations: retain ? [] : [
      { method: "mirror-symmetry", methodVersion: 1, anchorAreaId: "area-1", targetAreaId: "area-2",
        axis: "vertical", division: "center", match: "geometry", reason: "右下体量过重，偏离本例希望呈现的稳定关系。",
        expectedEffect: "两块以画框中轴镜像，位置、尺寸及方向一致。" },
      { method: "focus-flow", methodVersion: 1, sourceId: "direction-1", targetFocusId: "focus-1", localAxis: "x",
        reason: "原动势线未连接左侧注意位置。", expectedEffect: "让现有动势线的方向经过左侧焦点。" },
    ],
  };
  return { draft, refinement: applyRefinementPlan(draft, plan) };
}

export const DirectedRelations: Story = {
  name: "有依据的规则精修",
  render: () => {
    const directed = createDirectedFixture();
    return <WorkflowHarness initialStatus="ready" initialDraft={directed.draft} initialRefinement={directed.refinement} />;
  },
  play: async ({ canvasElement }) => {
    findRadio(canvasElement, "精修").click();
    await nextFrame();
    assertStoryText(canvasElement, "关系验证");
    assertStoryText(canvasElement, "轴对称");
    assertStorySelector(canvasElement, '[data-relation-passed="true"]');
    const area = canvasElement.querySelector<SVGGElement>('[data-composition-item="area-1"]');
    if (!area?.ownerSVGElement || area.ownerSVGElement.getBoundingClientRect().height <= 0) {
      throw new Error("Refined content must be shown on a visible canvas.");
    }
    assertStorySelector(canvasElement, '[data-composition-item="direction-1"]');
    if (canvasElement.querySelector('[data-refinement-guides="true"]')) throw new Error("Refinement must not render mathematical guides.");
    findRadio(canvasElement, "预览").click();
    await nextFrame();
    if (canvasElement.querySelector('[data-refinement-guides="true"]')) throw new Error("Rule guides must not enter the generation reference.");
    findRadio(canvasElement, "精修").click();
  },
};

export const RetainedComposition: Story = {
  name: "有理由地保留原图",
  render: () => {
    const retained = createDirectedFixture(true);
    return <WorkflowHarness initialStatus="ready" initialDraft={retained.draft} initialRefinement={retained.refinement} />;
  },
  play: async ({ canvasElement }) => {
    findRadio(canvasElement, "精修").click();
    await nextFrame();
    assertStoryText(canvasElement, "保留原构图");
    if (canvasElement.querySelector('[data-refinement-guides="true"] line')) throw new Error("Retained source has no prescribed guides.");
  },
};
