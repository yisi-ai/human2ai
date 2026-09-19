import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";
import { applySpatialOperations, BODY_SHAPE_LIMITS, createSpatialCameraBox, SPATIAL_BOX_FACES, createHumanoid, createSpatialDraft, DEFAULT_TORSO_RATIO, type SpatialBodyShape, type SpatialDraft } from "../../../../../src/domain/spatial";
import zh from "../../../../../locales/zh-CN/common.json";
import en from "../../../../../locales/en/common.json";
import { Human2AiAppShell } from "./Human2AiAppShell";
import { SessionDetails } from "./SessionDetails";
import { SpatialWorkspaceView } from "./SpatialWorkspaceView";
import type { SpatialBoxView, SpatialRenderPass } from "../../../../../src/domain/spatial/types";

const fixture = createSpatialDraft();
fixture.cameras[0].name = zh.spatial.camera.replace("{{number}}", "1");
fixture.characters.push(createHumanoid("person", zh.spatial.character));
const creature = applySpatialOperations(fixture, [
  { type: "add-limb", characterId: "person", sourceJointId: "left-shoulder", parentId: "chest", idPrefix: "lower-left", offset: [0.22, -0.2, 0] },
  { type: "add-limb", characterId: "person", sourceJointId: "right-shoulder", parentId: "chest", idPrefix: "lower-right", offset: [-0.22, -0.2, 0] },
]).draft;
function Harness({ initial = fixture, loading = false, disabled = false, error, onRetry, english = false, onApplied, initialCameraId, cameraSource, cameraBoxSource }: { initial?: SpatialDraft; loading?: boolean; disabled?: boolean; error?: string; onRetry?(): void; english?: boolean; onApplied?(draft: SpatialDraft): void; initialCameraId?: string; cameraSource?(id: string, pass?: SpatialRenderPass): string; cameraBoxSource?(id: string, view: SpatialBoxView, pass: SpatialRenderPass): string }) {
  const [panelHost, setPanelHost] = useState<HTMLDivElement | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [draft, setDraft] = useState(initial);
  const [constraintError, setConstraintError] = useState<string | null>(null);
  const copy = english ? en : zh;
  return <Human2AiAppShell title={copy.spatial.title} sidebar={null} rightPanelOpen={panelOpen} onRightPanelOpenChange={setPanelOpen}
    labels={copy.shell} rightPanel={<div ref={setPanelHost} className="spatial-panel-host" />}>
    <SpatialWorkspaceView panelHost={panelHost} onRequestProperties={() => setPanelOpen(true)} toolsLabel={copy.canvas.tools.label} noteLabel={copy.notes.element.label}
    details={<SessionDetails createdAt="2026-09-09T12:00:00Z" updatedAt="2026-09-09T12:00:00Z" nodeCount={draft.characters.length + draft.objects.length} locale={english ? "en" : "zh-CN"} agentCommand={null} labels={{ ...copy.sessionDetails, copied: copy.clipboard.copied }} />}
    draft={draft} loading={loading} disabled={disabled} error={error ?? constraintError} onRetry={onRetry} labels={copy.spatial} actions={copy.actions} initialCameraId={initialCameraId} cameraSource={cameraSource} cameraBoxSource={cameraBoxSource} onOperation={op => {
    try { const result = applySpatialOperations(draft, [op]); setDraft(result.draft); onApplied?.(result.draft); setConstraintError(result.constrained ? copy.spatial.constrained : null); }
    catch { setConstraintError(copy.spatial.constrained); }
  }} /></Human2AiAppShell>;
}
const meta = { id: "human2ai-spatial-workspace-view", title: "human2ai/SpatialWorkspaceView", component: SpatialWorkspaceView, args: { panelHost: null, draft: fixture, onOperation: () => undefined }, parameters: { layout: "fullscreen" }, render: () => <Harness /> } satisfies Meta<typeof SpatialWorkspaceView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: "标准人形" };
export const Empty: Story = { name: "空空间", render: () => <Harness initial={createSpatialDraft()} /> };
export const Loading: Story = { name: "载入中", render: () => <Harness loading /> };
let errorRetries = 0;
export const LoadError: Story = {
  name: "读取失败",
  render: () => <Harness error={zh.spatial.loadFailed} disabled onRetry={() => errorRetries++} />,
  play: async ({ canvasElement }) => {
    const indicator = canvasElement.querySelector<HTMLButtonElement>('.spatial-workspace-error button')!;
    const tabs = canvasElement.querySelector<HTMLElement>('.spatial-workspace-tabs')!;
    if (indicator.getBoundingClientRect().right >= tabs.getBoundingClientRect().left) throw new Error('Error icon must appear before the Space tab');
    if (canvasElement.querySelector('.spatial-center')!.textContent?.includes(zh.spatial.loadFailed)) throw new Error('Do not show error text over the canvas');
    indicator.focus(); await new Promise(resolve => setTimeout(resolve, 350));
    const tooltip = canvasElement.ownerDocument.querySelector('[role="tooltip"]');
    if (!tooltip?.textContent?.includes(zh.spatial.loadFailed) || !tooltip.textContent.includes(zh.actions.retry)) throw new Error('Keyboard focus must reveal the error reason and retry action');
    errorRetries = 0; indicator.click();
    if (errorRetries !== 1) throw new Error('The error icon must retain retry');
    tabs.querySelectorAll<HTMLInputElement>('input')[1].click(); await new Promise(resolve => setTimeout(resolve, 180));
    if (!canvasElement.querySelector('.spatial-workspace-error')) throw new Error('The error icon must remain available in the Cameras view');
    indicator.blur();
  },
};
export const Disabled: Story = { name: "等待恢复", render: () => <Harness disabled /> };
export const TwoHeads: Story = { name: "双头角色", render: () => <Harness initial={applySpatialOperations(fixture, [{ type: "add-limb", characterId: "person", sourceJointId: "neck", parentId: "chest", idPrefix: "second", offset: [.22,.23,0] }]).draft} /> };
export const FourArms: Story = { name: "四臂角色", render: () => <Harness initial={creature} /> };
export const Female: Story = { name: "女性人物", render: () => <Harness initial={applySpatialOperations(fixture, [{ type: "set-proportions", characterId: "person", height: 1.8, headRatio: 7, bodyType: "female" }]).draft} /> };
export const FemaleFourArms: Story = { name: "四臂女性人物", render: () => <Harness initial={applySpatialOperations(creature, [{ type: "set-proportions", characterId: "person", height: 1.8, headRatio: 4, bodyType: "female" }]).draft} /> };
const geometricFixture: SpatialDraft = {...fixture,characters:[{...fixture.characters[0],appearance:"geometric"}]};
export const GeometricMannequin: Story = { render: () => <Harness initial={geometricFixture} /> };
export const GeometricEnglish: Story = { render: () => <Harness english initial={geometricFixture} /> };
export const GeometricDisabled: Story = { render: () => <Harness disabled initial={geometricFixture} /> };
const geometricChanges: SpatialDraft[] = [];
export const GeometricInteractions: Story = {
  render: () => <Harness initial={creature} onApplied={draft=>geometricChanges.push(draft)} />,
  play: async ({canvasElement}) => {
    const pause = () => new Promise(resolve=>setTimeout(resolve,180));
    const panel = canvasElement.querySelector('.spatial-panel')!;
    panel.querySelectorAll<HTMLInputElement>('.spatial-panel-tabs input')[1].click(); await pause();
    [...panel.querySelectorAll<HTMLElement>('.ant-tree-node-content-wrapper')].find(el=>el.textContent?.trim()===zh.spatial.character)!.click(); await pause();
    panel.querySelectorAll<HTMLInputElement>('.spatial-panel-tabs input')[2].click(); await pause();
    geometricChanges.length=0;
    for (const [appearance,label] of [["geometric",zh.spatial.appearanceGeometric],["quaternius",zh.spatial.appearanceQuaternius],["geometric",zh.spatial.appearanceGeometric]]) {
      const count=geometricChanges.length;
      panel.querySelector<HTMLElement>(`[aria-label="${zh.spatial.appearance}"]`)!.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); await pause();
      [...canvasElement.ownerDocument.querySelectorAll<HTMLElement>('.ant-select-item-option')].find(el=>el.textContent?.trim()===label)!.click(); await pause();
      const changed=geometricChanges.at(-1);
      if (geometricChanges.length!==count+1 || changed?.characters[0].appearance!==appearance) throw new Error('Model selection must save one appearance change');
      if (JSON.stringify({...changed.characters[0],appearance:"quaternius"})!==JSON.stringify(creature.characters[0])) throw new Error('Model selection must retain pose, anatomy, limits and custom limbs');
    }
    if (panel.querySelector<HTMLElement>('.spatial-panel-body')!.scrollWidth>panel.querySelector<HTMLElement>('.spatial-panel-body')!.clientWidth) throw new Error('Model selector must fit the sidebar');
  },
};
export const CompactFigures: Story = { name: "低头身男女人物", render: () => <Harness initial={{ ...fixture, characters: (["male", "female"] as const).map((bodyType, i) => { const actor = createHumanoid(bodyType, bodyType === "female" ? zh.spatial.bodyFemale : zh.spatial.bodyMale, 1.8, 3, undefined, bodyType); actor.position[0] = i - .5; return actor; }) }} /> };
export const FractionalFigures: Story = { name: "2.5 与 3.5 头身", render: () => <Harness initial={{ ...fixture, characters: (["male", "female"] as const).map((bodyType, i) => { const actor = createHumanoid(bodyType, bodyType === "female" ? zh.spatial.bodyFemale : zh.spatial.bodyMale, 1.8, 2.5 + i, undefined, bodyType); actor.position[0] = i - .5; return actor; }) }} /> };
export const LongContent: Story = { name: "长名称与多个角色", render: () => <Harness initial={{ ...fixture, characters: Array.from({ length: 12 }, (_, i) => createHumanoid(`actor-${i}`, "拥有较长名称的空间人物".repeat(4))) }} /> };
export const English: Story = { name: "英文界面", render: () => <Harness english /> };
const notesFixture: SpatialDraft = { ...fixture,
  objects: [{ id: "desk", name: "接待台", kind: "box", position: [1.3, .4, 0], rotation: [0, 0, 0], size: [1, .8, .7], color: "#b6a58c", note: "弧形接待台\n保留占地范围，背后留出通道。" }],
  cameraBoxes: [{ ...createSpatialCameraBox("box", "观察盒"), position: [-2, .8, 0], size: .8 }],
};
const noteChanges: SpatialDraft[] = [];
export const ObjectNotes: Story = {
  name: "物件名称与备注编辑",
  render: () => <Harness initial={notesFixture} onApplied={draft => noteChanges.push(draft)} />,
  play: async ({ canvasElement }) => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 200));
    const document = canvasElement.ownerDocument;
    canvasElement.querySelectorAll<HTMLInputElement>('.spatial-panel-tabs input')[1].click(); await pause();
    [...canvasElement.querySelectorAll<HTMLElement>('.ant-tree-node-content-wrapper')].find(item => item.textContent === notesFixture.objects[0].name)!.click(); await pause();
    const viewport = canvasElement.querySelector<HTMLElement>('.spatial-viewport')!;
    noteChanges.length = 0;
    viewport.focus(); viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await pause();
    const editor = document.querySelector<HTMLElement>('[data-spatial-object-editor="desk"]')!;
    if (!editor || noteChanges.length) throw new Error('Opening the object editor must not change the scene');
    const name = editor.querySelector<HTMLInputElement>(`input[aria-label="${zh.spatial.name}"]`)!;
    const note = editor.querySelector<HTMLTextAreaElement>('textarea')!;
    if (name.value !== notesFixture.objects[0].name || note.value !== notesFixture.objects[0].note) throw new Error('The editor must read the selected object metadata');
    const text = "接待台的材质与空间要求\n".repeat(20);
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(note, text);
    note.dispatchEvent(new Event('input', { bubbles: true })); await pause();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, '入口接待台');
    name.dispatchEvent(new Event('input', { bubbles: true })); await pause();
    const changed = noteChanges.at(-1)!;
    if (changed.objects[0].note !== text || changed.objects[0].name !== '入口接待台') throw new Error('Metadata must save before the editor closes');
    if (JSON.stringify({ ...changed.objects[0], name: notesFixture.objects[0].name, note: notesFixture.objects[0].note }) !== JSON.stringify(notesFixture.objects[0])) throw new Error('Notes must preserve object geometry');
    if (note.clientHeight >= note.scrollHeight) throw new Error('Long notes must scroll within the bounded textarea');
    document.querySelector<HTMLButtonElement>('.spatial-object-editor-modal .ant-modal-close')!.click(); await pause();
    if (document.querySelector('[data-spatial-object-editor]')) throw new Error('Closing must dismiss the editor');
    viewport.focus(); viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await pause();
    if (document.querySelector<HTMLTextAreaElement>('[data-spatial-object-editor] textarea')!.value !== text) throw new Error('Closing must retain saved notes');
  },
};
export const ObjectNotesEnglish: Story = { render: () => <Harness english initial={notesFixture} initialCameraId={notesFixture.cameras[0].id} /> };
export const LightingEnabled: Story = { render: () => <Harness initial={{...fixture,lightingEnabled:true}} /> };
const lightingChanges: SpatialDraft[] = [];
export const LightingInteractions: Story = {
  render: () => <Harness onApplied={draft=>lightingChanges.push(draft)} />,
  play: async ({canvasElement}) => {
    const checkbox = [...canvasElement.querySelectorAll('label')].find(label=>label.textContent===zh.spatial.lightingEffects)!.querySelector<HTMLInputElement>('input')!;
    if (checkbox.checked) throw new Error('Scene lighting must default off');
    lightingChanges.length = 0;
    for (const enabled of [true,false]) {
      const count = lightingChanges.length;
      checkbox.click(); await new Promise(resolve=>setTimeout(resolve,150));
      if (checkbox.checked!==enabled || lightingChanges.length!==count+1 || lightingChanges.at(-1)?.lightingEnabled!==enabled) throw new Error('The checkbox must apply exactly one saved scene lighting operation');
      if (JSON.stringify({...lightingChanges.at(-1),lightingEnabled:false})!==JSON.stringify(fixture)) throw new Error('Changing lighting must preserve the authored pose and cameras');
    }
  }
};
export const DesktopMinimum: Story = { name: "桌面最小视口", parameters: { viewport: { defaultViewport: "desktopMinimum" } } };
export const LongLegs: Story = { name: "长腿比例下限", render: () => <Harness initial={{ ...fixture, characters: [createHumanoid("person", zh.spatial.character, 1.8, 7, .3)] }} /> };
export const ShortLegs: Story = { name: "短腿比例上限", render: () => <Harness initial={{ ...fixture, characters: [createHumanoid("person", zh.spatial.character, 1.8, 7, .7)] }} /> };
export const BodyShapeInteractions: Story = {
  render: () => <Harness onApplied={draft => proportionChanges.push(draft)} />,
  play: async ({ canvasElement }) => {
    const wait = () => new Promise(resolve => setTimeout(resolve,150));
    const panel = canvasElement.querySelector('.spatial-panel')!;
    panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click(); await wait();
    [...panel.querySelectorAll<HTMLElement>('.ant-tree-node-content-wrapper')].find(el => el.textContent?.trim() === zh.spatial.character)!.click(); await wait();
    panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')[2].click(); await wait();
    proportionChanges.length = 0;
    for (const key of Object.keys(BODY_SHAPE_LIMITS) as (keyof SpatialBodyShape)[]) {
      const controls = panel.querySelectorAll<HTMLElement>(`[role="slider"][aria-label="${zh.spatial[key]}"]`);
      if (controls.length !== 1) throw new Error("Each body dimension must have one actor-wide slider, not per-side controls");
      const slider = controls[0], limits = BODY_SHAPE_LIMITS[key];
      if (Number(slider.getAttribute('aria-valuemin')) !== limits.min * 100 || Number(slider.getAttribute('aria-valuemax')) !== limits.max * 100 || slider.getAttribute('aria-valuenow') !== '100') throw new Error("Shape defaults and bounds must match the domain");
      const count = proportionChanges.length;
      slider.focus(); slider.dispatchEvent(new KeyboardEvent('keydown',{ key:'End', keyCode:35, which:35, bubbles:true })); await wait();
      if (proportionChanges.length !== count || Number(slider.getAttribute('aria-valuenow')) !== limits.max * 100) throw new Error("Dragging must preview without saving intermediate revisions");
      slider.dispatchEvent(new KeyboardEvent('keyup',{ key:'End', keyCode:35, which:35, bubbles:true })); await wait();
      if (proportionChanges.length !== count+1 || proportionChanges.at(-1)?.characters[0][key] !== limits.max) throw new Error("Release must commit exactly one shape edit");
      slider.dispatchEvent(new KeyboardEvent('keydown',{ key:'Home', keyCode:36, which:36, bubbles:true })); await wait();
      slider.dispatchEvent(new KeyboardEvent('keyup',{ key:'Home', keyCode:36, which:36, bubbles:true })); await wait();
      slider.dispatchEvent(new KeyboardEvent('keydown',{ key:'ArrowRight', keyCode:39, which:39, bubbles:true })); await wait();
      slider.dispatchEvent(new KeyboardEvent('keyup',{ key:'ArrowRight', keyCode:39, which:39, bubbles:true })); await wait();
      if (Math.abs(proportionChanges.at(-1)!.characters[0][key]! - limits.min - .02) > 1e-8) throw new Error("Shape slider step must be two percentage points");
      const input = panel.querySelector<HTMLInputElement>(`input[aria-label="${zh.spatial[key]}"]`)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'100');
      input.dispatchEvent(new Event('input',{ bubbles:true })); await wait(); input.blur(); await wait();
      if (proportionChanges.at(-1)?.characters[0][key] !== 1) throw new Error("Numeric input must restore the profile default");
    }
    const actor = proportionChanges.at(-1)!.characters[0];
    if (actor.height !== 1.8 || actor.headRatio !== 7 || actor.torsoRatio !== DEFAULT_TORSO_RATIO) throw new Error("Shape edits must retain authored proportions");
    const body = panel.querySelector<HTMLElement>('.spatial-panel-body')!;
    body.scrollTop = body.scrollHeight;
    if (body.scrollWidth > body.clientWidth || canvasElement.ownerDocument.documentElement.scrollWidth > innerWidth) throw new Error("Body dimensions must use internal vertical scrolling without horizontal overflow");
  },
};
const cameraFixture: SpatialDraft = { ...fixture, cameras: [
  { ...fixture.cameras[0], width: 1600, height: 900, position: [2, 1.8, 4] },
  { ...fixture.cameras[0], id: "portrait", name: zh.spatial.camera.replace("{{number}}", "2"), width: 900, height: 1600, projection: "orthographic", position: [-2, 2, 4] },
] };
const galleryFixture: SpatialDraft = { ...fixture, cameras: Array.from({ length: 7 }, (_, index) => ({
  ...cameraFixture.cameras[index % 2], id: `gallery-${index}`, name: index === 6 ? "Camera_".repeat(18) : zh.spatial.camera.replace("{{number}}", String(index + 1)),
})), cameraBoxes: [createSpatialCameraBox("box", zh.spatial.cameraBox)] };
const galleryPreview = (id: string) => {
  const camera = galleryFixture.cameras.find(item => item.id === id) ?? galleryFixture.cameras[0];
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${camera.width}" height="${camera.height}" viewBox="0 0 400 300"><rect width="400" height="300" fill="#edf0f3"/><path d="M0 220L200 150L400 220M200 150V300" stroke="#9cbbd3" fill="none"/><rect x="130" y="100" width="140" height="100" fill="#b6a58c"/><text x="200" y="160" text-anchor="middle" font-size="30">${id.replace('gallery-', '')}</text></svg>`)}`;
};
const galleryChanges: SpatialDraft[] = [];
export const CameraGallery: Story = {
  name: "摄像机总览与固定视图切换",
  render: () => <Harness initial={galleryFixture} cameraSource={galleryPreview} onApplied={draft => galleryChanges.push(draft)} />,
  play: async ({ canvasElement }) => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 180));
    const tabs = canvasElement.querySelector<HTMLElement>('.spatial-workspace-tabs')!;
    const inputs = tabs.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    if (inputs.length !== 2 || !inputs[0].checked) throw new Error('The workspace must start with exactly two fixed views');
    const viewport = canvasElement.querySelector('.spatial-viewport');
    galleryChanges.length = 0;
    inputs[1].click(); await pause();
    const gallery = canvasElement.querySelector<HTMLElement>('.spatial-camera-gallery')!;
    const cards = [...gallery.querySelectorAll('figure')];
    if (cards.length !== galleryFixture.cameras.length) throw new Error('Show every scene camera, excluding camera boxes');
    cards.forEach((card, index) => {
      if (card.querySelector('figcaption')!.textContent !== galleryFixture.cameras[index].name) throw new Error('Keep complete camera names');
      if (!card.querySelector<HTMLImageElement>('img')!.alt.startsWith(galleryFixture.cameras[index].name)) throw new Error('Associate each view with its camera');
    });
    const bounds = cards.map(card => card.getBoundingClientRect());
    if (Math.abs(bounds[0].top - bounds[2].top) > 1 || bounds[3].top <= bounds[0].top) throw new Error('Render exactly three cameras per row');
    inputs[1].focus();
    inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', keyCode: 37, which: 37, bubbles: true })); await pause();
    if (!inputs[0].checked || canvasElement.querySelector('.spatial-viewport') !== viewport || viewport!.getBoundingClientRect().height < 160) throw new Error('Keyboard switching must preserve the mounted spatial editor');
    if (galleryChanges.length) throw new Error('View switching must not mutate the scene');
    inputs[1].click(); await pause();
    const galleryBody = canvasElement.querySelector<HTMLElement>('.spatial-camera-gallery')!;
    galleryBody.scrollTop = galleryBody.scrollHeight;
    if (galleryBody.scrollWidth > galleryBody.clientWidth || canvasElement.ownerDocument.documentElement.scrollWidth > innerWidth) throw new Error('Camera gallery must scroll internally without horizontal overflow');
    galleryBody.scrollTop = 0;
    const select = galleryBody.querySelectorAll<HTMLButtonElement>('.spatial-camera-select');
    const panelToggle = canvasElement.querySelector<HTMLButtonElement>(`button[aria-label="${zh.shell.collapseRightPanel}"]`)!;
    panelToggle.click(); await pause();
    select[1].click(); await pause();
    const panel = canvasElement.querySelector('.spatial-panel')!;
    const selectedName = () => panel.querySelector<HTMLInputElement>(`input[aria-label="${zh.spatial.name}"]`)?.value;
    if (panelToggle.getAttribute('aria-expanded') !== 'true' || selectedName() !== galleryFixture.cameras[1].name || !panel.querySelector(`[aria-label="${zh.spatial.span}"]`)) throw new Error('Selecting a camera must reopen its properties, including its projection settings');
    select[0].focus(); select[0].click(); await pause();
    if (selectedName() !== galleryFixture.cameras[0].name || select[0].getAttribute('aria-pressed') !== 'true' || select[1].getAttribute('aria-pressed') !== 'false') throw new Error('Gallery selection must track the matching camera properties');
    if (!inputs[1].checked || galleryChanges.length) throw new Error('Opening camera properties must keep the gallery active without editing the scene');
    for (const element of [galleryBody, panel.querySelector<HTMLElement>('.spatial-panel-body')!]) {
      if (getComputedStyle(element).scrollbarWidth !== 'none' && getComputedStyle(element, '::-webkit-scrollbar').display !== 'none') throw new Error('Camera selection must not expose gallery or properties scrollbars');
      element.scrollTop = element.scrollHeight;
      if (element.scrollHeight > element.clientHeight && element.scrollTop === 0) throw new Error('Hidden scrollbars must retain access to overflowing content');
      element.scrollTop = 0;
    }
  },
};
export const CameraGalleryPending: Story = {
  name: "英文摄像机等待保存",
  render: () => <Harness english disabled initial={cameraFixture} />,
  play: async ({ canvasElement }) => {
    canvasElement.querySelectorAll<HTMLInputElement>('.spatial-workspace-tabs input')[1].click();
    await new Promise(resolve => setTimeout(resolve, 180));
    const gallery = canvasElement.querySelector('.spatial-camera-gallery')!;
    if (gallery.querySelectorAll('figure').length !== 2 || !gallery.textContent?.includes(en.spatial.cameraPreviewPending) || gallery.querySelector('img')) throw new Error('Pending saved previews must retain names and explain the wait');
    gallery.querySelector<HTMLButtonElement>('.spatial-camera-select')!.click();
    await new Promise(resolve => setTimeout(resolve, 180));
    const name = canvasElement.querySelector<HTMLInputElement>(`.spatial-parameters input[aria-label="${en.spatial.name}"]`)!;
    if (name.value !== cameraFixture.cameras[0].name || !name.disabled) throw new Error('Read-only previews must allow inspecting disabled camera properties');
  },
};
export const CameraGalleryFailure: Story = {
  name: "摄像机预览失败与单独重试",
  render: () => <Harness initial={cameraFixture} cameraSource={id => id === 'portrait' ? 'data:image/png;base64,AAAA' : galleryPreview(id)} />,
  play: async ({ canvasElement }) => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 180));
    canvasElement.querySelectorAll<HTMLInputElement>('.spatial-workspace-tabs input')[1].click(); await pause();
    const cards = canvasElement.querySelectorAll('.spatial-camera-gallery figure');
    if (cards[0].textContent?.includes(zh.spatial.referenceLoadFailed) || !cards[1].textContent?.includes(zh.spatial.referenceLoadFailed)) throw new Error('A failed camera must not replace other camera previews');
    const original = cards[1].querySelector('img');
    const retry = cards[1].querySelector<HTMLButtonElement>('.ant-alert button')!;
    const retryBounds = retry.getBoundingClientRect();
    if (canvasElement.ownerDocument.elementFromPoint(retryBounds.x + retryBounds.width / 2, retryBounds.y + retryBounds.height / 2)?.closest('button') !== retry) throw new Error('The camera selection target must not cover image retry');
    retry.click(); await pause();
    if (cards[1].querySelector('img') === original) throw new Error('Retry must request the failed camera again');
    if (cards[1].querySelector('.spatial-camera-select')!.getAttribute('aria-pressed') !== 'false') throw new Error('Retry must remain separate from camera selection');
  },
};
// Keep the source landscape-shaped to cover stale images while the output size updates.
const cameraPreview = () => `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect x="20" y="20" width="1560" height="860" fill="none" stroke="#728aa1" stroke-width="8"/><circle cx="800" cy="450" r="180" fill="#9cbbd3"/></svg>')}`;
const cameraVisibilityChanges: SpatialDraft[] = [];
export const CameraLandscape: Story = {
  name: "横向摄像机范围与预览",
  render: () => <Harness initial={cameraFixture} initialCameraId={cameraFixture.cameras[0].id} cameraSource={cameraPreview} onApplied={draft => cameraVisibilityChanges.push(draft)} />,
  play: async ({ canvasElement }) => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 180));
    const panel = canvasElement.querySelector('.spatial-panel')!;
    panel.querySelectorAll<HTMLInputElement>('.spatial-panel-tabs input')[0].click(); await pause();
    const checkbox = () => [...panel.querySelectorAll('label')].find(label => label.textContent === zh.spatial.showCameras)!.querySelector<HTMLInputElement>('input')!;
    if (!checkbox().checked) throw new Error('Camera guides must default on');
    cameraVisibilityChanges.length = 0;
    checkbox().click(); await pause();
    if (checkbox().checked) throw new Error('Camera guides must be switchable off');
    const tabs = canvasElement.querySelectorAll<HTMLInputElement>('.spatial-workspace-tabs input');
    tabs[1].click(); await pause(); tabs[0].click(); await pause();
    if (checkbox().checked) throw new Error('Camera guide visibility must survive workspace tab changes');
    checkbox().click(); await pause();
    const rig = [...panel.querySelectorAll('label')].find(label => label.textContent === zh.spatial.showRig)!.querySelector<HTMLInputElement>('input')!;
    if (!checkbox().checked || !rig.checked || cameraVisibilityChanges.length) throw new Error('Camera visibility must remain independent of rig visibility and saved scene operations');
  },
};
export const CameraPortrait: Story = { name: "纵向正交摄像机范围与预览", render: () => <Harness initial={cameraFixture} initialCameraId="portrait" cameraSource={cameraPreview} /> };
const referencePreview = (_id: string, pass: SpatialRenderPass = "color") => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600"><rect width="900" height="1600" fill="${pass === "depth" ? "black" : "white"}"/>${pass === "skeleton" ? '<ellipse cx="450" cy="320" rx="75" ry="100" fill="#e6eef3" stroke="#688296" stroke-width="8"/><path d="M450 420V850L260 1350M450 850L640 1350M450 540L250 760M450 540L650 760" fill="none" stroke="#427ea9" stroke-width="13"/><circle cx="450" cy="850" r="14" fill="white" stroke="#b97337" stroke-width="6"/>' : `<circle cx="450" cy="800" r="200" fill="${pass === "structure" ? "white" : pass === "depth" ? "#bbbbbb" : "#9cbbd3"}" stroke="#444444" stroke-width="4"/>`}</svg>`)}`;
export const CameraReferences: Story = { render: () => <Harness initial={cameraFixture} initialCameraId="portrait" cameraSource={referencePreview} /> };
export const CameraReferencesEnglish: Story = { render: () => <Harness english initial={cameraFixture} initialCameraId="portrait" cameraSource={referencePreview} /> };
export const CameraReferencesDisabled: Story = { render: () => <Harness disabled initial={cameraFixture} initialCameraId="portrait" cameraSource={referencePreview} /> };
export const CameraReferenceFailure: Story = {
  render: () => <Harness initial={cameraFixture} initialCameraId="portrait" cameraSource={() => "data:image/png;base64,AAAA"} />,
  play: async ({ canvasElement }) => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 150));
    await pause();
    const preview = canvasElement.querySelector<HTMLElement>('.spatial-preview')!;
    if (!preview.textContent?.includes(zh.spatial.referenceLoadFailed)) throw new Error("Reference failures must be visible");
    if (preview.querySelector('a[download]')) throw new Error("A failed image cannot be downloaded");
    const original = preview.querySelector('img');
    [...preview.querySelectorAll('button')].find(button => button.textContent?.replace(/\s/g, '') === zh.actions.retry)!.click(); await pause();
    if (preview.querySelector('img') === original) throw new Error("Retry must remount the failed image request");
  },
};
export const CameraReferenceInteractions: Story = {
  render: () => <Harness initial={cameraFixture} initialCameraId="portrait" cameraSource={referencePreview} onApplied={() => { throw new Error("Reference selection must not mutate the scene"); }} />,
  play: async ({ canvasElement }) => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 150));
    const panel = canvasElement.querySelector<HTMLElement>('.spatial-panel')!;
    const tabs = panel.querySelector<HTMLElement>('.spatial-reference-tabs')!;
    await pause();
    for (const [pass, label] of [["color", zh.spatial.referenceColor], ["structure", zh.spatial.referenceStructure], ["depth", zh.spatial.referenceDepth], ["skeleton", zh.spatial.referenceSkeleton]]) {
      [...tabs.querySelectorAll<HTMLElement>('.ant-segmented-item')].find(item => item.textContent === label)!.click(); await pause();
      const image = panel.querySelector<HTMLImageElement>('.spatial-preview img')!;
      const download = panel.querySelector<HTMLAnchorElement>('a[download]')!;
      if (!image.complete || !image.naturalWidth || !image.alt.endsWith(label)) throw new Error("Preview must show the selected reference");
      if (download.getAttribute('href') !== image.getAttribute('src') || download.download !== `portrait-${pass}.png`) throw new Error("Download must use the displayed camera and pass");
      const bounds = image.getBoundingClientRect();
      if (Math.abs(bounds.width / bounds.height - 900 / 1600) > .002 || bounds.height > 231) throw new Error("Reference passes must preserve the portrait ratio");
    }
    tabs.querySelector<HTMLInputElement>('input:checked')!.focus();
    tabs.querySelector<HTMLInputElement>('input:checked')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', keyCode: 37, which: 37, bubbles: true })); await pause();
    if (!panel.querySelector('img')!.alt.endsWith(zh.spatial.referenceDepth)) throw new Error("Reference types must support keyboard selection");
    const body = panel.querySelector<HTMLElement>('.spatial-panel-body')!; body.scrollTop = body.scrollHeight;
    if (body.scrollWidth > body.clientWidth || canvasElement.ownerDocument.documentElement.scrollWidth > innerWidth) throw new Error("Reference controls must fit the desktop sidebar");
  },
};
export const CameraPreviewInteractions: Story = {
  name: "摄像机切换与画幅比例验证",
  render: () => <Harness initial={cameraFixture} initialCameraId={cameraFixture.cameras[0].id} cameraSource={cameraPreview} />,
  play: async ({ canvasElement }) => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 150));
    const panel = canvasElement.querySelector('.spatial-panel')!;
    const check = (width: number, height: number) => {
      const bounds = panel.querySelector('.spatial-preview img')!.getBoundingClientRect();
      if (Math.abs(bounds.width / bounds.height - width / height) > .002 || bounds.height > 231 || bounds.width > panel.clientWidth) throw new Error("预览应保持设置画幅并适应右栏，纵向图不能被最大高度压扁");
    };
    await pause(); check(1600, 900);
    panel.querySelector<HTMLElement>(`[aria-label="${zh.spatial.selectCamera}"]`)!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await pause();
    [...canvasElement.ownerDocument.querySelectorAll<HTMLElement>('.ant-select-item-option')].find(el => el.textContent?.trim() === cameraFixture.cameras[1].name)!.click(); await pause();
    check(900, 1600);
    if (!panel.querySelector(`[aria-label="${zh.spatial.span}"]`)) throw new Error("切换预览摄像机应同步选中对应正交摄像机");
    const width = panel.querySelector<HTMLInputElement>(`[aria-label="${zh.spatial.outputWidth}"]`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(width, '1600');
    width.dispatchEvent(new Event('input', { bubbles: true })); await pause(); check(1600, 1600);
    const viewport = canvasElement.querySelector<HTMLElement>('.spatial-viewport')!;
    viewport.focus(); viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await pause();
    if (panel.querySelector(`[aria-label="${zh.spatial.outputWidth}"]`)) throw new Error("Escape 应清除摄像机选择");
    check(1600, 1600);
  },
};
const proportionChanges: SpatialDraft[] = [];
export const FractionalProportionsInteractions: Story = {
  name: "小数头身与半步调整验证",
  render: () => <Harness onApplied={draft => proportionChanges.push(draft)} />,
  play: async ({ canvasElement }) => {
    const wait = () => new Promise(resolve => setTimeout(resolve, 150));
    const panel = canvasElement.querySelector('.spatial-panel')!;
    panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click(); await wait();
    [...panel.querySelectorAll<HTMLElement>('.ant-tree-node-content-wrapper')].find(el => el.textContent?.trim() === zh.spatial.character)!.click(); await wait();
    panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')[2].click(); await wait();
    const head = panel.querySelector<HTMLInputElement>(`[aria-label="${zh.spatial.proportions}"]`)!;
    const height = panel.querySelector<HTMLInputElement>(`[aria-label="${zh.spatial.height}"]`)!;
    const enter = async (value: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(head, value);
      head.dispatchEvent(new Event('input', { bubbles: true })); await wait();
    };
    const check = (value: number) => {
      const actor = proportionChanges.at(-1)!.characters[0];
      if (actor.headRatio !== value || Number(head.value) !== value || actor.height !== 1.8 || actor.torsoRatio !== DEFAULT_TORSO_RATIO) throw new Error("小数头身必须准确保存，保持身高与躯干腿部比例");
    };
    proportionChanges.length = 0;
    await enter('2.5'); check(2.5);
    head.focus(); head.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', keyCode: 38, which: 38, bubbles: true })); await wait(); check(3);
    await enter('3.5'); check(3.5);
    await enter('2.7'); head.blur(); await wait(); check(2.7);
    if (Math.abs(head.getBoundingClientRect().y - height.getBoundingClientRect().y) > 1) throw new Error("头身与身高仍应并排显示");
  },
};
export const BodyTypeInteractions: Story = {
  name: "人物外形切换与固定验证",
  render: () => <Harness initial={applySpatialOperations(creature, [{ type: "rotate-bone", characterId: "person", boneId: "left-knee", rotation: [-78,0,5] }]).draft} onApplied={draft => proportionChanges.push(draft)} />,
  play: async ({ canvasElement }) => {
    const wait = () => new Promise(resolve => setTimeout(resolve, 150));
    const panel = canvasElement.querySelector('.spatial-panel')!;
    const select = async (title: string) => {
      panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click(); await wait();
      if (title === zh.spatial.jointLeftWrist && ![...panel.querySelectorAll<HTMLElement>('.ant-tree-node-content-wrapper')].some(el => el.textContent?.trim() === title)) {
        [...panel.querySelectorAll<HTMLElement>('.ant-tree-node-content-wrapper')].find(el => el.textContent?.trim() === zh.spatial.handLeft)!.closest('.ant-tree-treenode')!.querySelector<HTMLElement>('.ant-tree-switcher')!.click(); await new Promise(resolve => setTimeout(resolve,350));
      }
      [...panel.querySelectorAll<HTMLElement>('.ant-tree-node-content-wrapper')].find(el => el.textContent?.trim() === title)!.click(); await wait();
      panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')[2].click(); await wait();
    };
    const choose = async (label: string) => {
      panel.querySelector<HTMLElement>(`[aria-label="${zh.spatial.bodyType}"]`)!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); await wait();
      [...canvasElement.ownerDocument.querySelectorAll<HTMLElement>('.ant-select-item-option')].find(el => el.textContent?.trim() === label)!.click(); await wait();
    };
    await select(zh.spatial.character); proportionChanges.length = 0;
    await choose(zh.spatial.bodyFemale);
    const female = proportionChanges.at(-1)?.characters[0];
    if (female?.bodyType !== 'female' || female.joints.length !== 109 || female.bones.find(b => b.id === 'left-knee')?.rotation[0] !== -78) throw new Error("切换女性必须保留四臂与踢腿姿势");
    await select(zh.spatial.jointLeftWrist);
    panel.querySelector<HTMLInputElement>('.spatial-locks input')!.click(); await wait();
    await select(zh.spatial.character);
    const count = proportionChanges.length;
    await choose(zh.spatial.bodyMale);
    if (proportionChanges.length !== count || !panel.textContent?.includes(zh.spatial.proportionsLocked) || proportionChanges.at(-1)?.characters[0].bodyType !== 'female') throw new Error("位置固定冲突必须阻止切换，保留女性模型");
  },
};
export const ProportionsInteractions: Story = {
  name: "躯干腿部比例与固定验证",
  render: () => <Harness onApplied={draft => proportionChanges.push(draft)} />,
  play: async ({ canvasElement }) => {
    const wait = () => new Promise(resolve => setTimeout(resolve, 150));
    const panel = canvasElement.querySelector('.spatial-panel')!;
    const tab = async (index: number) => { panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')[index].click(); await wait(); };
    const select = async (title: string) => {
      await tab(1);
      [...panel.querySelectorAll<HTMLElement>('.ant-tree-node-content-wrapper')].find(el => el.textContent?.trim() === title)!.click();
      await wait(); await tab(2);
    };
    await select(zh.spatial.character);
    const head = panel.querySelector<HTMLInputElement>(`[aria-label="${zh.spatial.proportions}"]`)!;
    const height = panel.querySelector<HTMLInputElement>(`[aria-label="${zh.spatial.height}"]`)!;
    if (Math.abs(head.getBoundingClientRect().y - height.getBoundingClientRect().y) > 1 || head.getBoundingClientRect().right >= height.getBoundingClientRect().left) throw new Error("头身比例与身高必须并排");
    const slider = () => panel.querySelector<HTMLElement>('[role="slider"]')!;
    if (Number(slider().getAttribute('aria-valuenow')) !== Number((DEFAULT_TORSO_RATIO * 100).toFixed(1))) throw new Error("已存的非整步比例也要准确显示");
    const key = (type: string, code: number) => slider().dispatchEvent(new KeyboardEvent(type, { keyCode: code, which: code, bubbles: true }));
    const checkBoundary = (percent: number) => {
      const track = panel.querySelector('.spatial-ratio-track')!.getBoundingClientRect();
      const handle = slider().getBoundingClientRect();
      if (Math.abs((handle.x + handle.width / 2 - track.x) / track.width * 100 - percent) > 1) throw new Error("滑块必须位于真实比例分界处");
    };
    proportionChanges.length = 0;
    slider().focus(); key("keydown", 36); await wait();
    if (slider().getAttribute('aria-valuenow') !== '30' || proportionChanges.length) throw new Error("拖动或按键时仅预览，不保存");
    checkBoundary(30);
    key("keyup", 36); await wait();
    if (proportionChanges.length !== 1 || proportionChanges[0].characters[0].torsoRatio !== .3) throw new Error("结束操作后只提交一次");
    key("keydown", 39); await wait();
    if (slider().getAttribute('aria-valuenow') !== '32' || proportionChanges.length !== 1) throw new Error("方向键应以 2% 步进预览");
    key("keyup", 39); await wait();
    if (proportionChanges.at(-1)!.characters[0].torsoRatio !== .32) throw new Error("方向键结束后保存 32%");
    checkBoundary(32);
    key("keydown", 37); await wait(); key("keyup", 37); await wait();
    if (slider().getAttribute('aria-valuenow') !== '30' || proportionChanges.at(-1)!.characters[0].torsoRatio !== .3) throw new Error("反向也应以 2% 步进");
    key("keydown", 35); await wait(); key("keyup", 35); await wait();
    if (slider().getAttribute('aria-valuenow') !== '70' || proportionChanges.at(-1)!.characters[0].torsoRatio !== .7) throw new Error("向右应增大躯干占比，腿部最少 30%");
    checkBoundary(70);
    panel.querySelector<HTMLButtonElement>(`[aria-label="${zh.spatial.resetBodyLegRatio}"]`)!.click(); await wait();
    if (proportionChanges.at(-1)!.characters[0].torsoRatio !== DEFAULT_TORSO_RATIO || Number(head.value) !== 7 || Number(height.value) !== 1.8) throw new Error("复原比例不能改变身高与头身比例");
    await select(zh.spatial.jointPelvis);
    panel.querySelector<HTMLInputElement>('.spatial-locks input')!.click(); await wait();
    await select(zh.spatial.character);
    const count = proportionChanges.length;
    slider().focus(); key("keydown", 36); await wait(); key("keyup", 36); await wait();
    if (!panel.textContent?.includes(zh.spatial.proportionsLocked) || proportionChanges.length !== count) throw new Error("固定冲突必须提示并阻止保存");
    if (!proportionChanges.at(-1)!.characters[0].joints.find(j => j.id === 'pelvis')!.lockPosition) throw new Error("比例编辑不能自动解锁");
  },
};
export const LockInteractions: Story = {
  name: "独立固定与键盘编辑验证",
  play: async ({ canvasElement }) => {
    const wait = () => new Promise(resolve => setTimeout(resolve, 100));
    const panel = canvasElement.querySelector('.yisi-app-shell-right-panel');
    if (!panel?.querySelector('.spatial-panel')) throw new Error("空间面板必须位于 AppShellFrame 右栏");
    if (canvasElement.querySelector('.spatial-workspace button')) throw new Error("编辑工具必须全部放入右栏");
    if (!panel.textContent?.includes(zh.sessionDetails.title)) throw new Error("默认标签必须包含基本信息");
    if (panel.querySelectorAll('input[type="radio"]').length !== 3) throw new Error("右栏必须分为信息与工具、空间对象、参数三个标签");
    const switchTab = async (key: string) => { panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')[["info", "objects", "parameters"].indexOf(key)].click(); await wait(); };
    await switchTab("parameters");
    if (!panel.textContent?.includes(zh.spatial.selectObjectForParameters)) throw new Error("未选择对象时应提示选择");
    await switchTab("objects");
    const tree = () => panel.querySelector('[data-yisiui-asset="yisiui/asset-skeleton-tree"]')!;
    if (!tree().textContent?.includes(fixture.cameras[0].name) || !tree().textContent?.includes(zh.spatial.character)) throw new Error("角色和摄像机必须在同一个对象树");
    const selectNode = async (title: string, inspect = true) => {
      await switchTab("objects");
      if ([zh.spatial.jointLeftWrist,zh.spatial.boneLeftHand].includes(title) && ![...tree().querySelectorAll<HTMLElement>('.ant-tree-node-content-wrapper')].some(el => el.textContent?.trim() === title)) {
        const row = [...tree().querySelectorAll<HTMLElement>('.ant-tree-node-content-wrapper')].find(el => el.textContent?.trim() === zh.spatial.handLeft)!.closest('.ant-tree-treenode')!;
        row.querySelector<HTMLElement>('.ant-tree-switcher')!.click();
        await new Promise(resolve => setTimeout(resolve,350));
      }
      const node = [...tree().querySelectorAll<HTMLElement>('.ant-tree-node-content-wrapper')].find(el => el.textContent?.trim() === title);
      if (!node) throw new Error(`Missing tree node: ${title}`);
      node.click(); await wait();
      if (!tree() || panel.querySelector('.spatial-parameters, .spatial-preview')) throw new Error("对象标签只显示列表，选择时保留列表");
      if (inspect) {
        await switchTab("parameters");
        if (tree()) throw new Error("参数标签不能包含对象列表");
      }
    };
    await selectNode(fixture.cameras[0].name);
    if (!panel.querySelector(`[aria-label="${zh.spatial.projection}"]`)) throw new Error("选择摄像机必须显示镜头参数");
    await selectNode(zh.spatial.character, false);
    await new Promise(resolve => setTimeout(resolve, 350));
    const rows = [...tree().querySelectorAll<HTMLElement>('[role="treeitem"]')];
    if (!rows.some(row => row.textContent?.trim() === zh.spatial.handLeft) || !rows.some(row => row.textContent?.trim() === zh.spatial.handRight) || rows.some(row => row.querySelectorAll('.ant-tree-indent-unit').length > 1)) throw new Error("人物下身体部位与收起的左右手应在同一层级");
    if (new Set(rows.map(row => Math.round(row.getBoundingClientRect().height))).size !== 1) throw new Error("人物、部位和摄像机应保持同一行高");
    await selectNode(zh.spatial.jointLeftWrist);
    const checks = () => [...canvasElement.querySelectorAll<HTMLInputElement>('.spatial-locks input')];
    const vectors = () => [...canvasElement.querySelectorAll<HTMLInputElement>('.spatial-vector input')];
    const viewport = canvasElement.querySelector<HTMLElement>('.spatial-viewport')!;
    if (vectors().length !== 3) throw new Error("关节只显示位置控制");
    checks()[0].click(); await wait();
    if (!vectors().every(input => input.disabled)) throw new Error("固定位置必须禁用坐标编辑");
    const pinnedPosition = vectors().map(input=>input.value).join();
    await selectNode(zh.spatial.boneLeftHand);
    if (vectors().length !== 9 || !panel.querySelector(`[aria-label="${zh.spatial.localRotation} ${zh.spatial.x}"]`)) throw new Error("骨段应显示局部旋转和六个角度边界");
    const initialRotation = vectors().slice(0,3).map(input=>input.value).join();
    viewport.focus(); viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); await wait();
    if (vectors().slice(0,3).map(input=>input.value).join() === initialRotation) throw new Error("选择骨段应自动进入旋转模式");
    checks()[0].click(); await wait();
    if (!vectors().slice(0,3).every(input=>input.disabled)) throw new Error("固定骨段旋转应禁用旋转编辑");
    const fixedRotation = vectors().slice(0,3).map(input=>input.value).join();
    viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); await wait();
    if (vectors().slice(0,3).map(input=>input.value).join() !== fixedRotation) throw new Error("旋转模式必须遵守固定");
    await selectNode(zh.spatial.jointLeftWrist);
    if (vectors().map(input=>input.value).join() !== pinnedPosition) throw new Error("旋转手部不能移动固定手腕");
    await switchTab("info"); await switchTab("objects"); await switchTab("parameters");
    if (!checks()[0].checked) throw new Error("切换标签应保留选择和固定");
    checks()[0].click(); await wait();
    const before = vectors().map(input=>input.value).join();
    viewport.focus(); viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })); await wait();
    if (vectors().map(input=>input.value).join() === before) throw new Error("固定手部旋转后仍能移动手腕");
    await selectNode(zh.spatial.character);
    const reset = [...panel.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===zh.spatial.resetPose)!;
    reset.click(); await wait();
    await selectNode(zh.spatial.boneLeftHand);
    if (checks()[0].checked || vectors().slice(0,3).some(input=>Number(input.value)!==0)) throw new Error("复原必须恢复默认角度并解除固定");
    viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait();
    if (checks().length) throw new Error("Escape 应取消选择");
    if (!panel.textContent?.includes(zh.spatial.selectObjectForParameters)) throw new Error("取消选择后显示参数空状态");
    await switchTab("info");
    [...panel.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===zh.spatial.addCamera)!.click(); await wait();
    if (!panel.querySelector(`[aria-label="${zh.spatial.projection}"]`) || tree()) throw new Error("新建对象应直接打开参数标签");
    const unnamed = [...canvasElement.querySelectorAll<HTMLButtonElement>('button')].filter(b => !b.textContent?.trim() && !b.getAttribute('aria-label'));
    if (unnamed.length) throw new Error("按钮必须具备可访问名称");
  },
};

const fingerFixture = applySpatialOperations(fixture,[
  { type:"set-proportions",characterId:"person",height:1.8,headRatio:3 },
  { type:"pose-hand",characterId:"person",handBoneId:"left-hand",curl:{thumb:.6,middle:.8,ring:.8,little:.8},thumbOpposition:.6 },
]).draft;
export const FingerPosing: Story = { name: "三头身手指造型", render: () => <Harness initial={fingerFixture} /> };
const handChanges: SpatialDraft[] = [];
export const HandInteractions: Story = {
  name: "手部树层级、弯曲与复原验证",
  render: () => <Harness initial={fingerFixture} onApplied={draft => handChanges.push(draft)} />,
  play: async ({ canvasElement }) => {
    const pause = () => new Promise(resolve => setTimeout(resolve,150));
    const panel = canvasElement.querySelector('.spatial-panel')!;
    const tab = async (index: number) => { panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')[index].click(); await pause(); };
    const node = (title: string) => [...panel.querySelectorAll<HTMLElement>('.ant-tree-node-content-wrapper')].find(el => el.textContent?.trim() === title)!;
    const choose = async (title: string) => { node(title).click(); await pause(); };
    await tab(1); await choose(zh.spatial.character); await new Promise(resolve => setTimeout(resolve,350));
    const handNode = node(zh.spatial.handLeft);
    if (!handNode || node(zh.spatial.fingerTip.replace('{{finger}}',zh.spatial.fingerIndex))) throw new Error('手部应单独分组并默认收起');
    handNode.closest('.ant-tree-treenode')!.querySelector<HTMLElement>('.ant-tree-switcher')!.click(); await new Promise(resolve => setTimeout(resolve,350));
    const tipName = zh.spatial.fingerTip.replace('{{finger}}',zh.spatial.fingerIndex);
    const rootName = zh.spatial.fingerRoot.replace('{{finger}}',zh.spatial.fingerIndex);
    const level = (title: string) => node(title)?.closest('.ant-tree-treenode')?.querySelectorAll('.ant-tree-indent-unit').length;
    if (!node(tipName) || level(tipName) !== level(rootName) || level(tipName) === level(zh.spatial.handLeft)) throw new Error('指节必须在手下平铺，不允许按骨骼链多层嵌套');
    await choose(zh.spatial.handLeft); await tab(2);
    if (panel.querySelectorAll('[role="slider"]').length !== 7) throw new Error('整手应提供五指弯曲、张开和拇指内收');
    const label = zh.spatial.fingerCurl.replace('{{finger}}',zh.spatial.fingerIndex);
    const slider = () => panel.querySelector<HTMLElement>(`[role="slider"][aria-label="${label}"]`)!;
    handChanges.length = 0;
    slider().focus(); slider().dispatchEvent(new KeyboardEvent('keydown',{keyCode:35,which:35,bubbles:true})); await pause();
    if (slider().getAttribute('aria-valuenow') !== '100' || handChanges.length) throw new Error('手指滑杆操作中应仅预览');
    slider().dispatchEvent(new KeyboardEvent('keyup',{keyCode:35,which:35,bubbles:true})); await pause();
    if (handChanges.length !== 1 || handChanges[0].characters[0].bones.find(b => b.id === 'left-index-2')!.rotation[0] !== 95) throw new Error('结束后应仅提交一次并联动中末节');
    const button = [...panel.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === zh.spatial.resetHand)!;
    button.click(); await pause();
    if (handChanges.at(-1)!.characters[0].bones.some(b => /^left-(thumb|index|middle|ring|little)-/.test(b.id) && b.rotation.some(v => v !== 0))) throw new Error('手部复原应清除本手造型');
    await tab(1); await choose(tipName); await tab(2);
    if (!panel.querySelector(`[aria-label="${zh.spatial.position} ${zh.spatial.x}"]`) || panel.querySelector('.spatial-hand-controls')) throw new Error('指尖应显示坐标控制');
    await tab(1); await choose(zh.spatial.fingerProximalBone.replace('{{finger}}',zh.spatial.fingerIndex)); await tab(2);
    if (!panel.querySelector(`[aria-label="${zh.spatial.localRotation} ${zh.spatial.x}"]`)) throw new Error('骨段应显示旋转控制');
  },
};

const cameraBoxFixture = { ...fixture, cameraBoxes: [createSpatialCameraBox("six-views", zh.spatial.cameraBox)] };
const cameraBoxPreview = (_id: string, view: SpatialBoxView, pass: SpatialRenderPass) => {
  const faces = view === "sheet" ? SPATIAL_BOX_FACES : [view];
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${view === "sheet" ? 1560 : 512}" height="${view === "sheet" ? 1092 : 512}">${faces.map((face,i) => `<g transform="translate(${i%3*524},${Math.floor(i/3)*552})"><rect width="512" height="540" fill="${pass === "depth" ? "black" : "white"}"/><text x="256" y="20" text-anchor="middle" fill="#777">${face}</text><ellipse cx="256" cy="275" rx="80" ry="170" fill="${pass === "structure" ? "white" : "#b6a58c"}" stroke="#777"/></g>`).join("")}</svg>`)}`;
};
export const CameraBox: Story = { name: "六方位观察盒", render: () => <Harness initial={cameraBoxFixture} cameraBoxSource={cameraBoxPreview} /> };
export const CameraBoxEnglish: Story = { name: "英文观察盒", render: () => <Harness english initial={cameraBoxFixture} cameraBoxSource={cameraBoxPreview} /> };
export const CameraBoxDisabled: Story = { name: "禁用观察盒", render: () => <Harness disabled initial={cameraBoxFixture} cameraBoxSource={cameraBoxPreview} /> };
const boxChanges: SpatialDraft[] = [];
export const CameraBoxInteractions: Story = {
  name: "观察盒添加与取景交互",
  render: () => <Harness cameraBoxSource={cameraBoxPreview} onApplied={draft=>boxChanges.push(draft)} />,
  play: async ({canvasElement}) => {
    const wait = () => new Promise(resolve=>setTimeout(resolve,180));
    const panel = canvasElement.querySelector('.spatial-panel')!;
    const button = (label: string) => [...panel.querySelectorAll<HTMLButtonElement>('button')].find(el=>el.textContent?.trim()===label)!;
    boxChanges.length = 0; button(zh.spatial.addCameraBox).click(); await wait();
    if (boxChanges.length !== 1 || boxChanges[0].cameraBoxes?.length !== 1) throw new Error("Adding a camera box must save exactly one operation");
    const whole = boxChanges[0].cameraBoxes![0];
    button(zh.spatial.fitCameraBoxHands).click(); await wait();
    if (Number(boxChanges.length) !== 2 || boxChanges[1].cameraBoxes![0].size >= whole.size) throw new Error("Hand fitting must tighten the captured region");
    if (JSON.stringify(boxChanges[1].characters)!==JSON.stringify(fixture.characters) || JSON.stringify(boxChanges[1].cameras)!==JSON.stringify(fixture.cameras)) throw new Error("Observation boxes must preserve the pose and main camera");
    panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click(); await wait();
    if (![...panel.querySelectorAll('.ant-tree-node-content-wrapper')].some(el=>el.textContent?.trim()===zh.spatial.cameraBox)) throw new Error("Box must be in the unified object tree");
    panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')[2].click(); await wait();
    const count = boxChanges.length;
    panel.querySelectorAll<HTMLInputElement>('.spatial-reference-tabs input')[2].click(); await wait();
    if (boxChanges.length !== count || !panel.querySelector('img')?.alt.endsWith(zh.spatial.referenceDepth)) throw new Error("Preview changes must not write a scene revision");
    const body = panel.querySelector<HTMLElement>('.spatial-panel-body')!;
    if (body.scrollWidth > body.clientWidth || document.documentElement.scrollWidth > innerWidth) throw new Error("Box controls must fit the desktop sidebar");
  },
};

export const SkeletonProjection: Story = {
  name: "镜头骨架投影",
  render: () => <Harness initial={cameraFixture} initialCameraId="portrait" cameraSource={referencePreview} />,
  play: async ({canvasElement}) => {
    const tab = [...canvasElement.querySelectorAll<HTMLElement>('.spatial-reference-tabs .ant-segmented-item')].find(el=>el.textContent===zh.spatial.referenceSkeleton)!;
    tab.click();
  },
};
