import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { AimOutlined, PictureOutlined } from "@ant-design/icons";
import { CompositeButton } from "@human2ai/ui/yisiui/composite-button";
import { ExpandingSwitch } from "@human2ai/ui/yisiui/expanding-switch";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import zh from "../../../../../locales/zh-CN/common.json";
import { addArea, createDraft, setCompositionPreviewMode, type CompositionDraft } from "../../../../../src/domain/composition";
import { assertReferenceShapes } from "./compositionPreviewStoryChecks";
import { CompositionPreviewHover } from "./CompositionPreviewHover";
import { CompositionWorkflowView, type CompositionWorkflowViewKey } from "./CompositionWorkflowView";
import { SessionDetails } from "./SessionDetails";
import { canvasNodeExecutionCounts } from "./canvasNodeRenderTrace";
import { captureCanvasNodeExecutions } from "./canvasNodeAppearanceStoryChecks";
import "./CompositionPreviewHover.stories.css";

function fixture(count: number): CompositionDraft {
  const draft = addArea(createDraft(), { primitive: "triangle" }).draft;
  draft.previewMode = "precise";
  const base = draft.areas[0];
  draft.areas = Array.from({ length: count }, (_, index) => ({
    ...base, id: `area-${index + 1}`,
    primitive: (["triangle", "quadrilateral", "circle"] as const)[index % 3],
    aspect: "free", width: index < 3 ? 0.2 : 0.035, height: index < 3 ? 0.24 : 0.04,
    x: index < 3 ? 0.25 + index * 0.25 : 0.08 + (index % 20) * 0.044,
    y: index < 3 ? 0.38 : 0.64 + Math.floor(index / 20) * 0.015,
    rotation: index === 1 ? 15 : 0,
  }));
  if (count > 3) draft.areas[3] = {
    ...draft.areas[3], primitive: "quadrilateral", semanticType: "text-region", displayText: "自由变形",
    x: 0.5, y: 0.2, width: 0.3, height: 0.1,
    corners: [{ x: 0.2, y: 0 }, { x: 1, y: 0.1 }, { x: 0.85, y: 1 }, { x: 0, y: 0.8 }],
  };
  return draft;
}

const fitFrame = { id: 1, type: "fit-frame" as const };

function Harness({ count = 20, disabled = false }: { count?: number; disabled?: boolean }) {
  const [draft, setDraft] = useState(() => fixture(count));
  const [view, setView] = useState<CompositionWorkflowViewKey>("draft");
  return <main className="composition-preview-hover-story" data-fixture-count={count}>
    <CompositionWorkflowView draft={draft} status="waiting" refinement={null}
      activeView={view} onViewChange={setView} onDraftChange={setDraft}
      canvasViewportAction={fitFrame} />
    <aside>
      <SessionDetails primaryItem={{ label: zh.composition.mode.label, value: zh.composition.mode.scene }}
        secondaryItem={{ label: zh.composition.previewMode.label, value:
          <ExpandingSwitch aria-label={zh.composition.previewMode.label} value={draft.previewMode ?? "precise"}
            disabled={disabled} colors={{ mode: "multicolor" }} items={[
              { key: "precise", label: zh.composition.previewMode.precise, icon: <AimOutlined aria-hidden="true" /> },
              { key: "soft", label: zh.composition.previewMode.soft, icon: <PictureOutlined aria-hidden="true" /> },
            ]} onChange={value => {
              if (value === "precise" || value === "soft") setDraft(current => setCompositionPreviewMode(current, value));
            }} /> }}
        createdAt={null} updatedAt={null} nodeCount={count} agentCommand={null} locale="zh-CN"
        labels={{ ...zh.sessionDetails, copied: zh.clipboard.copied }} />
      <CompositionPreviewHover draft={draft} label={zh.composition.views.referenceCanvas} disabled={disabled}>
        <CompositeButton label={zh.clipboard.copyPreview} icon={<PictureOutlined aria-hidden="true" />} disabled={disabled} />
      </CompositionPreviewHover>
    </aside>
  </main>;
}

async function checkHover(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await document.fonts.ready;
  await new Promise(resolve => setTimeout(resolve, 600));
  const trigger = canvas.getByRole("button", { name: zh.clipboard.copyPreview });
  const preview = () => document.querySelector(".human2ai-canvas-preview-hover__image");
  await userEvent.unhover(trigger);
  trigger.blur();
  await waitFor(() => expect(preview()).toBeNull(), { timeout: 5000 });
  let unchanged = captureCanvasNodeExecutions(canvasElement);
  canvasElement.dataset.previewScopeStep = "precise-hover";
  await userEvent.hover(trigger);
  await waitFor(() => expect(preview()?.querySelector("svg")).toBeTruthy(), { timeout: 5000 });
  expect(preview()?.querySelector("[data-preview-mode=soft]")).toBeNull();
  const patches = [...preview()!.querySelectorAll<SVGUseElement>("[data-text-warp-patch]")];
  expect(patches.length).toBeGreaterThan(1);
  for (const patch of patches) {
    const reference = patch.getAttribute("href")!.slice(1);
    expect(preview()!.querySelector(`#${CSS.escape(reference)}`)).toBeTruthy();
    expect(patch.getBBox().width).toBeGreaterThan(0);
  }
  canvasElement.dataset.hoverTextWarp = "passed";
  unchanged();
  await userEvent.unhover(trigger);
  await waitFor(() => expect(preview()).toBeNull(), { timeout: 5000 });
  // Planning handlers capture the current complete draft. Mode changes refresh
  // those handlers; content geometry and node components remain unchanged.
  const planIds = [...canvasElement.querySelectorAll('[data-composition-plan]')]
    .map(node => node.getAttribute("data-composition-plan")!);
  unchanged = captureCanvasNodeExecutions(canvasElement, planIds);
  const counts = canvasNodeExecutionCounts();
  const plansBefore = planIds.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
  canvasElement.dataset.previewScopeStep = "mode-change";
  await userEvent.click(canvas.getByRole("radio", { name: zh.composition.previewMode.soft }));
  unchanged();
  canvasElement.dataset.modePlanExecutions = String(planIds.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0) - plansBefore);
  unchanged = captureCanvasNodeExecutions(canvasElement);
  canvasElement.dataset.previewScopeStep = "soft-hover";
  await userEvent.hover(trigger);
  await waitFor(() => expect(preview()?.querySelector("[data-preview-mode=soft]")).toBeTruthy(), { timeout: 5000 });
  expect(preview()?.querySelector("polygon")).toBeTruthy();
  unchanged();
  await userEvent.unhover(trigger);
  await waitFor(() => expect(preview()).toBeNull(), { timeout: 5000 });
  canvasElement.dataset.previewScopeStep = "keyboard-focus";
  trigger.focus();
  await waitFor(() => expect(preview()).toBeTruthy(), { timeout: 5000 });
  unchanged();
  trigger.blur();
  await waitFor(() => expect(preview()).toBeNull(), { timeout: 5000 });
  canvasElement.dataset.previewScopeChecked = "passed";
  await userEvent.click(canvas.getByRole("radio", { name: zh.composition.views.reference }));
  const count = Number(canvasElement.querySelector<HTMLElement>("[data-fixture-count]")!.dataset.fixtureCount);
  assertReferenceShapes(canvasElement, { ...fixture(count), previewMode: "soft" });
  canvasElement.dataset.softReferenceShapes = canvasElement.dataset.referenceShapes;
  await userEvent.click(canvas.getByRole("radio", { name: zh.composition.previewMode.precise }));
  assertReferenceShapes(canvasElement, fixture(count));
  await userEvent.click(canvas.getByRole("radio", { name: zh.composition.views.draft }));
}

const meta = {
  id: "human2ai-composition-preview-hover",
  title: "human2ai/CompositionPreviewHover",
  component: CompositionPreviewHover,
  parameters: { layout: "fullscreen" },
  args: { draft: fixture(20), label: zh.composition.views.referenceCanvas, children: null },
  render: () => <Harness />,
} satisfies Meta<typeof CompositionPreviewHover>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "精准与模糊预览",
  play: ({ canvasElement }) => checkHover(canvasElement),
};

export const Dense: Story = {
  name: "大量节点的悬停预览",
  render: () => <Harness count={200} />,
  play: ({ canvasElement }) => checkHover(canvasElement),
};

export const Disabled: Story = {
  name: "加载期间禁用预览",
  render: () => <Harness count={0} disabled />,
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: zh.clipboard.copyPreview });
    expect(button).toBeDisabled();
    await userEvent.hover(button);
    expect(document.querySelector(".human2ai-canvas-preview-hover__image")).toBeNull();
  },
};
