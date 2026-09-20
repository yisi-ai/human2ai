import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { addArea, createDraft, type CompositionDraft } from "../../../../../src/domain/composition";
import { applySpatialOperations, createHumanoid, createSpatialDraft, type SpatialDraft } from "../../../../../src/domain/spatial";
import { cloneUiSketchDraft, type UiSketchDraft } from "./uiSketchDraft";
import { useCanvasHistory } from "../../../../../web/lib/use-canvas-history";
import { createAppI18n } from "../../../../../web/i18n/createI18n";
import { promptTranslationKey } from "../../../../../locales/promptKeys";
import zh from "../../../../../locales/zh-CN/common.json";
import { CanvasHistoryControls } from "./CanvasHistoryControls";
import { CompositionCanvas } from "./CompositionCanvas";
import { UiSketchCanvas } from "./UiSketchCanvas";
import { SpatialWorkspaceView } from "./SpatialWorkspaceView";
import { UI_SKETCH_FIXTURE } from "./uiSketchFixtures";

type Draft = CompositionDraft | UiSketchDraft | SpatialDraft;
const i18n = createAppI18n("zh-CN");
const composition = addArea(createDraft(), { primitive: "quadrilateral" }).draft;
const spatial = { ...createSpatialDraft(), characters: [createHumanoid("person", zh.spatial.character)] };

function Harness({ kind }: { kind: "composition" | "ui" | "spatial" }) {
  const [panelHost, setPanelHost] = useState<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<Draft>(() => kind === "composition" ? composition : kind === "ui" ? cloneUiSketchDraft(UI_SKETCH_FIXTURE) : spatial);
  const [selected, setSelected] = useState<string[]>([]);
  const history = useCanvasHistory(draft, ({ draft: restored }) => { setDraft(restored); setSelected([]); });
  const update = (next: Draft) => { if (history.record(next)) setDraft(next); };
  const controls = <CanvasHistoryControls {...history} labels={zh.canvasHistory} />;
  return <div data-canvas-editor tabIndex={0} style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
    {draft.kind !== "spatial-draft" && <div style={{ display: "flex", gap: 12, padding: 12 }}>
      <label>{zh.notes.global.label} <input aria-label={zh.notes.global.label} value={draft.overallNote} onChange={event => update({ ...draft, overallNote: event.target.value })} /></label>
      {draft.kind === "composition-draft" && <BasicButton onClick={() => update(addArea(draft, { primitive: "circle" }).draft)}>{zh.composition.toolNames.circle}</BasicButton>}
    </div>}
    <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
      {draft.kind === "composition-draft" ? <CompositionCanvas draft={draft} selectedIds={selected} onSelectionChange={setSelected} onDraftChange={update} interactionResetKey={history.restoreToken} />
        : draft.kind === "ui-layout-draft" ? <UiSketchCanvas draft={draft} onDraftChange={update} interactionResetKey={history.restoreToken}
          translatePrompt={(key, values) => i18n.t(promptTranslationKey("uiSketch", key), values)} />
        : <div style={{ height: "100%", display: "flex" }}>
          <div style={{ flex: 1, minWidth: 0 }}><SpatialWorkspaceView draft={draft} onOperation={operation => update(applySpatialOperations(draft, [operation]).draft)} panelHost={panelHost} historyControls={controls} interactionResetKey={history.restoreToken} /></div>
          <div ref={setPanelHost} style={{ width: 320, height: "100%", flexShrink: 0 }} />
        </div>}
      {draft.kind !== "spatial-draft" && controls}
    </div>
    <output hidden data-history-draft>{JSON.stringify(draft)}</output>
  </div>;
}

const meta = {
  id: "human2ai-canvas-history-controls",
  title: "human2ai/Canvas/Editing/CanvasHistoryControls",
  component: CanvasHistoryControls,
  args: { canUndo: false, canRedo: false, undo: () => undefined, redo: () => undefined, labels: zh.canvasHistory },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CanvasHistoryControls>;
export default meta;
type Story = StoryObj<typeof meta>;

const pause = () => new Promise(resolve => setTimeout(resolve, 60));
function read(canvas: HTMLElement): Draft { return JSON.parse(canvas.querySelector("[data-history-draft]")!.textContent!); }
function key(canvas: HTMLElement, key: string, ctrlKey = false, shiftKey = false) {
  const root = canvas.querySelector<HTMLElement>("[data-canvas-editor]")!;
  root.focus();
  root.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey, shiftKey, bubbles: true, cancelable: true }));
  root.dispatchEvent(new KeyboardEvent("keyup", { key, ctrlKey, shiftKey, bubbles: true }));
}
async function frameHistory(canvas: HTMLElement) {
  await pause();
  const before = JSON.stringify(read(canvas));
  const border = canvas.querySelector<SVGRectElement>("[data-canvas-frame-hit]")!;
  const bounds = border.getBoundingClientRect();
  const pointer = (type: string, dx: number) => border.dispatchEvent(new PointerEvent(type, {
    pointerId: 81, button: 0, buttons: type === "pointerup" ? 0 : 1,
    clientX: bounds.x + dx, clientY: bounds.y + bounds.height / 2, bubbles: true,
  }));
  pointer("pointerdown", 0);
  for (const dx of [12, 24, 48]) { pointer("pointermove", dx); await pause(); }
  pointer("pointerup", 48); await pause();
  const after = JSON.stringify(read(canvas));
  if (before === after) throw new Error("Frame drag must change the draft");
  key(canvas, "z", true); await pause();
  if (JSON.stringify(read(canvas)) !== before) throw new Error("One undo must restore the whole frame drag");
  const undo = canvas.querySelector<HTMLButtonElement>(`button[aria-label="${zh.canvasHistory.undo}"]`)!;
  if (!undo.disabled) throw new Error("One drag must create exactly one history entry");
  key(canvas, "z", true, true); await pause();
  if (JSON.stringify(read(canvas)) !== after) throw new Error("Redo must restore the final drag position");
  const input = canvas.querySelector<HTMLInputElement>("input[aria-label]")!;
  input.focus();
  const nativeUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
  input.dispatchEvent(nativeUndo);
  if (nativeUndo.defaultPrevented) throw new Error("Text inputs must retain native undo");
  if (JSON.stringify(read(canvas)) !== after) throw new Error("Input undo must not change canvas history");
  const portal = document.createElement("div");
  portal.setAttribute("data-human2ai-auto-save-node-editor", "");
  portal.tabIndex = 0;
  document.body.append(portal);
  try {
    portal.focus();
    portal.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true }));
    await pause();
    if (JSON.stringify(read(canvas)) !== before) throw new Error("Portaled node editor must share canvas undo");
    portal.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
    await pause();
    if (JSON.stringify(read(canvas)) !== after) throw new Error("Portaled node editor must share canvas redo");
  } finally { portal.remove(); }
  canvas.dataset.historyChecks = "passed";
}

export const Composition: Story = { name: "构图撤销与重做", render: () => <Harness kind="composition" />, play: ({ canvasElement }) => frameHistory(canvasElement) };
export const UiSketch: Story = { name: "界面撤销与重做", render: () => <Harness kind="ui" />, play: ({ canvasElement }) => frameHistory(canvasElement) };
export const Spatial: Story = {
  name: "空间撤销与重做", render: () => <Harness kind="spatial" />,
  play: async ({ canvasElement }) => {
    await pause();
    const checkbox = [...canvasElement.querySelectorAll("label")].find(label => label.textContent === zh.spatial.lightingEffects)!.querySelector<HTMLInputElement>("input")!;
    const before = JSON.stringify(read(canvasElement));
    checkbox.click(); await pause();
    const after = JSON.stringify(read(canvasElement));
    if (before === after) throw new Error("Lighting edit must be recorded");
    key(canvasElement, "z", true); await pause();
    if (JSON.stringify(read(canvasElement)) !== before) throw new Error("Undo must restore the complete spatial draft");
    key(canvasElement, "y", true); await pause();
    if (JSON.stringify(read(canvasElement)) !== after) throw new Error("Ctrl+Y must redo the spatial operation");
    canvasElement.dataset.historyChecks = "passed";
  },
};
