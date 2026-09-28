import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { waitFor } from "storybook/test";
import { useMemo, useState } from "react";
import zh from "../../../../../locales/zh-CN/common.json";
import { createAppI18n } from "../../../../../web/i18n/createI18n";
import { promptTranslationKey } from "../../../../../locales/promptKeys";
import type { MaterializedSessionPreview } from "../../../../../src/domain/ui-sketch/session-preview";
import { Human2AiAppShell } from "./Human2AiAppShell";
import { Human2AiWorkspaceSidebar } from "./Human2AiWorkspaceSidebar";
import { UiSketchCanvas } from "./UiSketchCanvas";
import { UiSketchStateTabs } from "./UiSketchStateTabs";
import { cloneUiSketchDraft, EMPTY_UI_SKETCH_DRAFT, insertUiSketchStage, uiSketchStateTabs, type UiSketchDraft } from "./uiSketchDraft";
import { UI_SKETCH_FIXTURE } from "./uiSketchFixtures";
import { captureCanvasNodeExecutions } from "./canvasNodeAppearanceStoryChecks";
import { WORKSPACE_SESSION_DRAG_TYPE } from "./workspaceSessionDrag";

const i18n = createAppI18n("zh-CN");
const noop = async () => {};
const preview: MaterializedSessionPreview = { reference: { sessionId: "source-0", sessionType: "ui-layout", stateId: "start", renderedRevision: 1 }, assetId: "preview", width: 400, height: 200 };
let result = async (_id: string) => preview;
const loadPreview = (id: string) => result(id);
const previewImageSource = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="lightblue"/></svg>')}`;
const loadDragPreview = async () => previewImageSource;
const changes: UiSketchDraft[] = [];

function Fixture({ count }: { count: number }) {
  const [draft, setDraft] = useState(() => insertUiSketchStage({ ...cloneUiSketchDraft(EMPTY_UI_SKETCH_DRAFT), rectangles: Array.from({ length: count }, (_, index) => ({
    ...UI_SKETCH_FIXTURE.rectangles[0], id: `node-${index}`, x: (index % 10) * 70, y: Math.floor(index / 10) * 45, width: 50, height: 30,
  })), layerOrder: Array.from({ length: count }, (_, index) => `node-${index}`) }, "start", "second"));
  const [stage, setStage] = useState("start");
  const sidebar = useMemo(() => <Human2AiWorkspaceSidebar
    projects={[{ id: "project", name: "预览项目" }]}
    sessions={Array.from({ length: count }, (_, index) => ({ id: `source-${index}`, projectId: "project", sessionType: "ui-layout", title: `来源会话 ${index + 1}`, revision: 1 }))}
    onCreateComposition={noop} onCreateUiSketch={noop} onCreateProject={noop} onOpenStyleLibrary={noop}
    onRenameProject={noop} onDeleteProject={noop} onOpenSession={noop} onRenameSession={noop} onMoveSession={noop} onDeleteSession={noop}
  />, [count]);
  return <Human2AiAppShell title={zh.sessionPreview.label} sidebar={sidebar}>
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <UiSketchStateTabs items={uiSketchStateTabs(draft).map(item => ({ id: item.id, label: item.name ?? i18n.t("uiSketch.states.defaultName", { number: item.number }) }))} value={stage}
        labels={{ ...zh.uiSketch.states, switch: zh.uiSketch.views.switch, add: zh.uiSketch.views.enableMotion, rename: zh.actions.rename, cancel: zh.actions.cancel, actions: name => i18n.t("uiSketch.states.actions", { name }), deleteTitle: name => i18n.t("uiSketch.states.deleteTitle", { name }) }}
        onChange={setStage} onCreate={noop} onRename={noop} onDelete={noop} onReorder={noop} />
      <UiSketchCanvas draft={draft} activeStageId={stage} onDraftChange={next => { changes.push(next); setDraft(next); }}
        style={{ flex: 1, minHeight: 0 }} showCanvasTools={false} onSessionPreviewDrop={loadPreview}
        loadSessionPreviewDragImage={loadDragPreview}
        translatePrompt={(key, values) => i18n.t(promptTranslationKey("uiSketch", key), values)}
        resolveImageSource={() => previewImageSource} />
    </div>
  </Human2AiAppShell>;
}

const meta = { title: "human2ai/Pages/SessionPreviewDrop", parameters: { layout: "fullscreen" }, args: { count: 20 }, render: ({ count }) => <Fixture key={count} count={count} /> } satisfies Meta<{ count: number }>;
export default meta;
type Story = StoryObj<typeof meta>;

const checkDrop: Story["play"] = async ({ canvasElement }) => {
  changes.length = 0; result = async () => preview;
  const source = canvasElement.querySelector<HTMLElement>('[data-session-tree-key="session:source-0"]')!;
  const scene = canvasElement.querySelector<SVGSVGElement>("[data-ui-sketch-scene]")!;
  await waitFor(() => { if (scene.getBoundingClientRect().width < 100) throw new Error("Canvas must be laid out"); });
  const box = scene.getBoundingClientRect();
  const point = { clientX: Math.round(box.x + box.width * 0.6), clientY: Math.round(box.y + box.height * 0.6) };
  const svgPoint = scene.createSVGPoint(); svgPoint.x = point.clientX; svgPoint.y = point.clientY;
  const world = svgPoint.matrixTransform(scene.getScreenCTM()!.inverse());
  const dataTransfer = new DataTransfer();
  const options = { bubbles: true, cancelable: true, dataTransfer, ...point };
  const unchanged = captureCanvasNodeExecutions(canvasElement);
  const unchangedCount = canvasElement.querySelectorAll("[data-ui-sketch-kind]").length;
  source.dispatchEvent(new DragEvent("dragstart", options));
  if (dataTransfer.getData(WORKSPACE_SESSION_DRAG_TYPE) !== "source-0") throw new Error("Tree must publish the session ID");
  scene.dispatchEvent(new DragEvent("dragover", options));
  const ghost = scene.querySelector<SVGImageElement>("[data-session-preview-drag] > image")!;
  await waitFor(() => { if (ghost.getAttribute("visibility") !== "visible") throw new Error("Wait for the SVG drag preview"); });
  for (let index = 0; index < 50; index++) scene.dispatchEvent(new DragEvent("dragover", options));
  await new Promise(requestAnimationFrame);
  source.dispatchEvent(new DragEvent("dragend", options));
  if (changes.length) throw new Error("A cancelled drag must not edit the draft");
  unchanged();
  source.dispatchEvent(new DragEvent("dragstart", options));
  scene.dispatchEvent(new DragEvent("dragover", options));
  await waitFor(() => { if (ghost.getAttribute("visibility") !== "visible") throw new Error("Wait for the second SVG drag preview"); });
  const ghostSize = [Number(ghost.getAttribute("width")), Number(ghost.getAttribute("height"))];
  scene.dispatchEvent(new DragEvent("drop", options));
  await waitFor(() => { if (changes.length !== 1) throw new Error("Drop must insert exactly once"); });
  const image = changes[0].images[0];
  if (image.width !== ghostSize[0] || image.height !== ghostSize[1]) throw new Error("Dropped SVG must keep its ghost dimensions");
  if (Math.abs(image.x + image.width / 2 - world.x) > 0.01 || Math.abs(image.y + image.height / 2 - world.y) > 0.01) throw new Error("Preview must be centered on the world drop point");
  await waitFor(() => { if (!canvasElement.querySelector(`[data-canvas-node="${image.id}"]`)) throw new Error("Inserted preview must render"); });
  unchanged();
  const external = new DataTransfer(); external.setData("text/plain", "source-0");
  scene.dispatchEvent(new DragEvent("drop", { ...options, dataTransfer: external }));
  if (changes.length !== 1) throw new Error("Plain text must not create a preview");
  const pending: Array<(value: MaterializedSessionPreview) => void> = [];
  result = () => new Promise(resolve => pending.push(resolve));
  scene.dispatchEvent(new DragEvent("drop", options));
  scene.dispatchEvent(new DragEvent("drop", options));
  canvasElement.querySelector(`[data-canvas-node="${image.id}"]`)!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  pending[1](preview); pending[0](preview);
  await waitFor(() => { if (changes.at(-1)?.images.length !== 3) throw new Error("Concurrent drops must both survive"); });
  if (changes.at(-1)!.images[0].x !== image.x + 1 || new Set(changes.at(-1)!.images.map(item => item.id)).size !== 3) throw new Error("Late drops must retain the most recent edit and unique identities");
  const beforeFailure = changes.length;
  result = async () => { throw new Error("unavailable"); };
  scene.dispatchEvent(new DragEvent("drop", options));
  await waitFor(() => { if (!canvasElement.textContent?.includes(zh.sessionPreview.failed)) throw new Error("Failed drop must show its error"); });
  if (changes.length !== beforeFailure) throw new Error("Failed drop must not create a node");
  let finish!: (value: MaterializedSessionPreview) => void;
  result = () => new Promise(resolve => { finish = resolve; });
  scene.dispatchEvent(new DragEvent("drop", options));
  const tab = canvasElement.querySelector<HTMLButtonElement>('[data-state-id="second"] button')!;
  tab.click();
  await waitFor(() => { if (tab.getAttribute("aria-pressed") !== "true") throw new Error("Switch state before resolving preview"); });
  finish(preview);
  await new Promise(resolve => setTimeout(resolve, 50));
  if (changes.length !== beforeFailure) throw new Error("A late preview must not insert after switching states");
  result = async () => preview;
  canvasElement.dataset.dropScope = JSON.stringify({ originalNodes: unchangedCount, unrelatedNodeExecutions: 0, dragEvents: 50, ghostSize });
};

export const Default: Story = { name: "项目树拖入会话预览", play: checkDrop };
export const Large: Story = { name: "大量会话与节点拖放", args: { count: 200 }, play: checkDrop };
