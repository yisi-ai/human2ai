import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";

import {
  addArea,
  addDirectionLine,
  addFocus,
  applyRefinementPlan,
  createCompositionWorkflowState,
  createDraft,
  draftFingerprint,
  moveItem,
  receiveCompositionRefinement,
  rotateDirectionLine,
  updateCompositionWorkflowDraft,
  type CompositionDraft,
  type CompositionRefinementResult,
  type CompositionWorkflowStatus,
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
  errorMessage,
}: {
  initialStatus: CompositionWorkflowStatus;
  initialDraft?: CompositionDraft;
  initialRefinement?: CompositionRefinementResult | null;
  errorMessage?: string;
}) {
  const [workflow, setWorkflow] = useState(() => ({
    ...createCompositionWorkflowState(initialDraft),
    status: initialStatus,
    refinement: initialRefinement,
    errorMessage: errorMessage ?? null,
  }));
  const [activeView, setActiveView] = useState<CompositionWorkflowViewKey>("draft");
  const [selectedId, setSelectedId] = useState<string | null>("area-1");

  return (
    <main className="composition-workflow-story">
      <CompositionWorkflowView
        draft={workflow.draft}
        status={workflow.status}
        refinement={workflow.refinement}
        activeView={activeView}
        onViewChange={setActiveView}
        selectedId={selectedId}
        onSelectionChange={setSelectedId}
        onDraftChange={(draft) => {
          setWorkflow((current) => updateCompositionWorkflowDraft(current, draft));
          setActiveView("draft");
        }}
        errorMessage={workflow.errorMessage}
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

export const Ready: Story = {
  name: "完成与失效交互",
  render: () => <WorkflowHarness initialStatus="ready" />,
  play: async ({ canvasElement }) => {
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="human2ai/composition-workflow-view"]',
    );
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/tab-switch"]');
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/status-badge"]');
    assertStoryText(canvasElement, "加工已通过");

    findRadio(canvasElement, "Agent 加工图").click();
    await nextFrame();
    assertStorySelector(canvasElement, '[data-active-view="refined"]');
    assertStoryText(canvasElement, "Agent 判断");

    findRadio(canvasElement, "生图参考").click();
    await nextFrame();
    assertStorySelector(canvasElement, '[data-active-view="reference"]');
    assertStorySelector(canvasElement, ".human2ai-composition-canvas--reference");

    findRadio(canvasElement, "用户草图").click();
    await nextFrame();
    const area = canvasElement.querySelector<SVGGElement>(
      '[data-composition-item="area-1"]',
    );
    if (!area) throw new Error("Story interaction contract missing editable area");
    area.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await nextFrame();
    assertStorySelector(canvasElement, '[data-workflow-status="stale"]');
    assertStoryText(canvasElement, "旧加工结果不再适用于当前草图");
    if (!findRadio(canvasElement, "Agent 加工图").disabled) {
      throw new Error("Stale refinement tab must be disabled");
    }
  },
};

export const Waiting: Story = {
  name: "等待 Agent",
  render: () => <WorkflowHarness initialStatus="waiting" />,
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

export const ErrorState: Story = {
  name: "审计失败",
  render: () => (
    <WorkflowHarness
      initialStatus="error"
      errorMessage="加工结果的最大形状位移超过 4%，已阻止展示。"
    />
  ),
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
  let draft = addFocus(createDraft(), { x: 0.61, y: 0.39 }).draft;
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

async function nextFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
