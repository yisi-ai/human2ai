"use client";

import { CameraOutlined, DeleteOutlined, DragOutlined, PlusOutlined, RedoOutlined, CopyOutlined, UndoOutlined, UserOutlined, BorderOutlined, AimOutlined, LinkOutlined, LockOutlined, InfoCircleOutlined, DownloadOutlined } from "@ant-design/icons";
import { Alert, Checkbox, Input, InputNumber, Select, Slider, Tooltip } from "antd";
import { useLayoutEffect, useState, type Key, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TabSwitch } from "../vendor/yisiui/runtime/src/components/TabSwitch";
import { CompositeButton } from "../vendor/yisiui/runtime/src/components/CompositeButton";
import { AssetSkeletonTree, type AssetSkeletonTreeNode } from "../vendor/yisiui/runtime/src/patterns/AssetSkeletonTree";
import { BasicButton } from "../vendor/yisiui/runtime/src/components/BasicButton";
import { LoadingState } from "../vendor/yisiui/runtime/src/components/LoadingState";
import { ConfirmAction } from "../vendor/yisiui/runtime/src/patterns/ConfirmAction";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import { applySpatialOperations, createSpatialCamera, createSpatialCameraBox, fitSpatialCameraBox, SPATIAL_BOX_FACES, cameraBoxImageSize, DEFAULT_TORSO_RATIO, TORSO_RATIO_LIMITS, BODY_SHAPE_LIMITS, SpatialConstraintError, jointWorldTransforms, fingerPart, owningHand, handJointIds, SPATIAL_FINGERS, fingerCurlAngles, isRigidBodyConnector, type SpatialBodyShape, type SpatialFinger, type SpatialBone, type SpatialCharacter, type SpatialDraft, type SpatialOperation, type Vec3 } from "../../../../../src/domain/spatial";
import zh from "../../../../../locales/zh-CN/common.json";
import type { SpatialCamera, SpatialBoxView, SpatialRenderPass } from "../../../../../src/domain/spatial/types";
import { SpatialViewport, type SpatialSelection } from "./SpatialViewport";
import "./SpatialWorkspaceView.css";

export type SpatialLabels = Record<keyof typeof zh.spatial, string>;
export interface SpatialWorkspaceViewProps {
  draft: SpatialDraft;
  onOperation(operation: SpatialOperation): void;
  labels?: SpatialLabels;
  loading?: boolean;
  disabled?: boolean;
  error?: string | null;
  status?: string | null;
  onRetry?(): void;
  historyControls?: ReactNode;
  interactionResetKey?: number;
  initialCameraId?: string | null;
  cameraSource?: (cameraId: string, pass?: SpatialRenderPass) => string | undefined;
  cameraBoxSource?: (boxId: string, view: SpatialBoxView, pass: SpatialRenderPass) => string | undefined;
  details?: ReactNode;
  panelHost: HTMLElement | null;
  toolsLabel?: string;
  onRequestProperties?(): void;
  actions?: { retry: string; delete: string; cancel: string };
}

export function SpatialWorkspaceView({ draft, onOperation, labels = zh.spatial, loading, disabled, error, status, onRetry, historyControls, interactionResetKey, initialCameraId, cameraSource, cameraBoxSource, details, panelHost, toolsLabel = zh.canvas.tools.label, onRequestProperties, actions = zh.actions }: SpatialWorkspaceViewProps) {
  const [selection, setSelection] = useState<SpatialSelection>(initialCameraId ? { cameraId: initialCameraId } : null);
  const [panelTab, setPanelTab] = useState(initialCameraId ? "parameters" : "info");
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [showRig, setShowRig] = useState(true);
  const [proportionPreview, setProportionPreview] = useState<{ source: SpatialDraft; draft: SpatialDraft; characterId: string } | null>(null);
  const [proportionError, setProportionError] = useState<string | null>(null);
  const [handPreview, setHandPreview] = useState<{ source: SpatialDraft; draft: SpatialDraft } | null>(null);
  const [handError, setHandError] = useState<string | null>(null);
  const [mode, setMode] = useState<"translate" | "rotate">("translate");
  const [cameraId, setCameraId] = useState(initialCameraId ?? draft.cameras[0].id);
  const [boxView, setBoxView] = useState<SpatialBoxView>("sheet");
  const [referencePass, setReferencePass] = useState<SpatialRenderPass>("color");
  const [view, setView] = useState<{ position: Vec3; target: Vec3 }>({ position: [3, 2.2, 5], target: [0, 0.9, 0] });
  const actor = selection && "characterId" in selection ? draft.characters.find(c => c.id === selection.characterId) : undefined;
  const joint = actor && selection && "characterId" in selection ? actor.joints.find(j => j.id === selection.jointId) : undefined;
  const bone = actor && selection && "characterId" in selection ? actor.bones.find(b => b.id === selection.boneId) : undefined;
  const hand = actor && selection && "characterId" in selection ? actor.bones.find(b => b.id === selection.handBoneId) : undefined;
  const part = joint ?? bone ?? hand;
  const object = selection && "objectId" in selection ? draft.objects.find(o => o.id === selection.objectId) : undefined;
  const camera = draft.cameras.find(c => c.id === (selection && "cameraId" in selection ? selection.cameraId : cameraId)) ?? draft.cameras[0];
  const editingCamera = selection && "cameraId" in selection ? camera : undefined;
  const cameraBox = selection && "cameraBoxId" in selection ? draft.cameraBoxes?.find(box => box.id === selection.cameraBoxId) : undefined;
  const referenceSource = cameraBox ? cameraBoxSource?.(cameraBox.id, boxView, referencePass) : cameraSource?.(camera.id, referencePass);
  const faceLabel = (face: SpatialBoxView) => labels[`cameraBox${face[0].toUpperCase()}${face.slice(1)}` as keyof SpatialLabels];
  const selected = actor ?? object ?? editingCamera ?? cameraBox;
  const world = actor && joint ? jointWorldTransforms(actor)[joint.id] : undefined;
  const preview = proportionPreview?.source === draft && proportionPreview.characterId === actor?.id && !part && !disabled && panelTab === "parameters" ? proportionPreview : null;
  const previewActor = preview?.draft.characters.find(c => c.id === actor?.id) ?? actor;
  const torsoPercent = Number(((previewActor?.torsoRatio ?? DEFAULT_TORSO_RATIO) * 100).toFixed(1));
  const ratioText = (value: number) => `${labels.torso} ${Number(value.toFixed(1))}%, ${labels.legs} ${Number((100 - value).toFixed(1))}%`;
  const fingerName = (finger: SpatialFinger) => labels[`finger${finger[0].toUpperCase()}${finger.slice(1)}` as keyof SpatialLabels];
  const fingerLabel = (modelPart: string, bone = false) => {
    const finger = fingerPart(modelPart);
    if (!finger) return undefined;
    const key = bone ? ["", "fingerProximalBone", "fingerMiddleBone", "fingerDistalBone"][finger.segment] : ["fingerRoot", "fingerMiddleJoint", "fingerDistalJoint", "fingerTip"][finger.segment];
    if (bone && finger.finger === "thumb" && finger.segment < 3) return finger.segment === 1 ? labels.thumbMetacarpal : labels.thumbProximal;
    return labels[key as keyof SpatialLabels]?.replace("{{finger}}",fingerName(finger.finger));
  };
  const jointLabel = (id: string, name: string, modelPart = id) => fingerLabel(modelPart) ?? (name === id ? (labels as Record<string, string>)["joint" + id.split("-").map(s => s[0].toUpperCase() + s.slice(1)).join("")] ?? name : name);
  const boneLabel = (id: string, name: string, modelPart: string) => fingerLabel(modelPart,true) ?? (name === id ? (labels as Record<string,string>)["bone" + modelPart.split("-").map(s=>s[0].toUpperCase()+s.slice(1)).join("")] ?? name : name);
  const handLabel = (hand: SpatialBone) => `${hand.id === hand.modelPart ? "" : hand.id.slice(0,-hand.modelPart.length).replace(/-$/,"") + " "}${hand.modelPart.startsWith("left") ? labels.handLeft : labels.handRight}`;
  const nextId = (prefix: string) => `${prefix}-${globalThis.crypto.randomUUID()}`;
  useLayoutEffect(() => {
    if (interactionResetKey === undefined) return;
    if (selection && (
      !selected
      || "cameraId" in selection && !draft.cameras.some(item => item.id === selection.cameraId)
      || "characterId" in selection && (
        selection.jointId && !joint || selection.boneId && !bone || selection.handBoneId && !hand
      )
    )) setSelection(null);
    setProportionPreview(null);
    setProportionError(null);
    setHandPreview(null);
    setHandError(null);
  }, [interactionResetKey]);
  const perform = (operation: SpatialOperation) => { if (!disabled) onOperation(operation); };
  const poseHand = (patch: Partial<Extract<SpatialOperation, { type: "pose-hand" }>>, previewOnly = false) => {
    if (!actor || !hand || disabled || loading) return;
    const operation: SpatialOperation = { ...patch, type: "pose-hand", characterId: actor.id, handBoneId: hand.id };
    try {
      const result = applySpatialOperations(draft,[operation]);
      setHandError(result.constrained ? labels.constrained : null);
      setHandPreview(previewOnly ? { source: draft, draft: result.draft } : null);
      if (!previewOnly) perform(operation);
    } catch { setHandPreview(null); setHandError(labels.constrained); }
  };
  const changeProportions = (patch: Partial<Pick<SpatialCharacter, "height" | "headRatio" | "torsoRatio" | "bodyType">> & SpatialBodyShape, previewOnly = false) => {
    if (!actor || disabled || loading) return;
    const operation: SpatialOperation = { type: "set-proportions", characterId: actor.id, height: actor.height, headRatio: actor.headRatio, torsoRatio: actor.torsoRatio ?? DEFAULT_TORSO_RATIO, ...patch };
    try {
      const result = applySpatialOperations(draft, [operation]);
      setProportionError(null);
      setProportionPreview(previewOnly ? { source: draft, draft: result.draft, characterId: actor.id } : null);
      if (!previewOnly) perform(operation);
    } catch (failure) {
      setProportionPreview(null);
      setProportionError(failure instanceof SpatialConstraintError ? labels.proportionsLocked : labels.constrained);
    }
  };
  const updateSelected = (patch: Record<string, unknown>) => {
    if (actor) perform({ type: "put-character", character: { ...actor, ...patch } });
    else if (object) perform({ type: "put-object", object: { ...object, ...patch } });
    else if (editingCamera) perform({ type: "put-camera", camera: { ...editingCamera, ...patch } });
    else if (cameraBox) perform({ type: "put-camera-box", box: { ...cameraBox, ...patch } });
  };
  const vectorField = (label: string, value: Vec3, change: (value: Vec3) => void, locked = false, step = 0.05) => <div className="spatial-field">
    <span>{label}</span><div className="spatial-vector">{value.map((v, axis) => <InputNumber key={axis} aria-label={`${label} ${[labels.x, labels.y, labels.z][axis]}`} value={Number(v.toFixed(3))} step={step} controls={false} disabled={disabled || locked} onChange={next => { if (next !== null) { const result = [...value] as Vec3; result[axis] = next; change(result); } }} />)}</div>
  </div>;
  const selectionKey = (value: SpatialSelection) => !value ? undefined : "characterId" in value
    ? JSON.stringify(["character", value.characterId, value.jointId ?? null, value.boneId ?? null, value.handBoneId ?? null])
    : "objectId" in value ? JSON.stringify(["object", value.objectId]) : "cameraBoxId" in value ? JSON.stringify(["camera-box", value.cameraBoxId]) : JSON.stringify(["camera", value.cameraId]);
  const nodes: AssetSkeletonTreeNode[] = [];
  const selections = new Map<string, SpatialSelection>();
  const addNode = (value: SpatialSelection, title: string, parentKey: string | null, order: number, trailing?: ReactNode) => {
    const key = selectionKey(value)!;
    selections.set(key, value);
    nodes.push({ key, title, parentKey, order, nodeKind: value && "characterId" in value && !value.jointId && !value.boneId ? "container" : "content", trailing });
  };
  draft.characters.forEach((item, index) => {
    const key = selectionKey({ characterId: item.id })!;
    addNode({ characterId: item.id }, item.name, null, index);
    const hands = item.bones.filter(b => b.modelPart.endsWith("-hand"));
    const parents = new Map<string,string>();
    hands.forEach(h => {
      const value = { characterId:item.id,handBoneId:h.id }, handKey = selectionKey(value)!;
      addNode(value,handLabel(h),key,item.joints.findIndex(j => j.id === h.endJointId)*3);
      for (const id of handJointIds(item,h)) parents.set(id,handKey);
      parents.set(h.startJointId,handKey);
    });
    item.joints.forEach((j,index) => {
      const incoming = item.bones.find(b=>b.endJointId===j.id);
      const finger = incoming && fingerPart(incoming.modelPart);
      if (!j.terminal || finger) addNode({ characterId:item.id,jointId:j.id },jointLabel(j.id,j.name,incoming?.modelPart),parents.get(j.id) ?? key,index*3+1,
        j.lockPosition && <Tooltip title={labels.lockPosition}><LockOutlined aria-label={labels.lockPosition} /></Tooltip>);
      if (incoming && finger?.segment !== 0) addNode({ characterId:item.id,boneId:incoming.id },boneLabel(incoming.id,incoming.name,incoming.modelPart),incoming.modelPart.endsWith("-wrist") ? key : parents.get(j.id) ?? key,index*3+(finger ? 0 : 2),
        incoming.lockRotation && <Tooltip title={labels.lockRotation}><RedoOutlined aria-label={labels.lockRotation} /></Tooltip>);
    });

  });
  draft.objects.forEach((item, index) => addNode({ objectId: item.id }, item.name, null, draft.characters.length + index));
  draft.cameras.forEach((item, index) => addNode({ cameraId: item.id }, item.name, null, draft.characters.length + draft.objects.length + index));
  draft.cameraBoxes?.forEach((item, index) => addNode({ cameraBoxId: item.id }, item.name, null, draft.characters.length + draft.objects.length + draft.cameras.length + index));
  const choose = (value: SpatialSelection, openParameters = true) => {
    setProportionPreview(null); setProportionError(null);
    setHandPreview(null); setHandError(null);
    setSelection(value);
    if (!value) return;
    if (openParameters) setPanelTab("parameters");
    onRequestProperties?.();
    if ("cameraId" in value) setCameraId(value.cameraId);
    if ("characterId" in value) {
      if (value.jointId) setMode("translate");
      if (value.boneId || value.handBoneId) setMode("rotate");
      const key = selectionKey({ characterId: value.characterId })!;
      const item = draft.characters.find(c => c.id === value.characterId);
      const part = item?.bones.find(b => b.id === value.boneId || b.endJointId === value.jointId);
      const owner = item && part ? owningHand(item,part) ?? item.bones.find(b => b.modelPart.endsWith("-hand") && b.startJointId === value.jointId) : undefined;
      const parent = owner ? selectionKey({ characterId:value.characterId,handBoneId:owner.id })! : undefined;
      setExpandedKeys(keys => [...new Set([...keys,key,...(parent ? [parent] : [])])]);
    }
  };
  const modeButtons = <>
    <Tooltip title={labels.translate}><BasicButton mode="with-icon" aria-label={labels.translate} aria-pressed={mode === "translate"} icon={<DragOutlined aria-hidden="true" />} disabled={disabled || loading || Boolean(bone || hand)} onClick={() => setMode("translate")}>{labels.translateMode}</BasicButton></Tooltip>
    <Tooltip title={labels.rotate}><BasicButton mode="with-icon" aria-label={labels.rotate} aria-pressed={mode === "rotate"} icon={<RedoOutlined aria-hidden="true" />} disabled={disabled || loading || Boolean(joint)} onClick={() => setMode("rotate")}>{labels.rotateMode}</BasicButton></Tooltip>
  </>;
  const panel = <div className="spatial-panel" data-canvas-editor>
    <TabSwitch className="spatial-panel-tabs" aria-label={labels.panelViews} value={panelTab} onChange={key => { setPanelTab(key); setProportionPreview(null); setHandPreview(null); }} items={[
      { key: "info", label: labels.infoToolsTab, mode: "text-only" },
      { key: "objects", label: labels.objects, mode: "text-only" },
      { key: "parameters", label: labels.parameters, mode: "text-only" },
    ]} />
    <div className="spatial-panel-body">
      {panelTab === "info" ? <>
        {details}
        <section className="spatial-tools" aria-label={toolsLabel}>
          <h2>{toolsLabel}</h2>
          <div className="spatial-add-actions">
            <CompositeButton icon={<UserOutlined aria-hidden="true" />} label={labels.addCharacter} disabled={disabled || loading} onClick={() => {
              const id = nextId("character"); perform({ type: "add-character", id, name: labels.character }); choose({ characterId: id });
            }} />
            <CompositeButton icon={<CameraOutlined aria-hidden="true" />} label={labels.addCamera} disabled={disabled || loading} onClick={() => {
              const id = nextId("camera"); perform({ type: "put-camera", camera: createSpatialCamera(id, labels.camera.replace("{{number}}", String(draft.cameras.length + 1))) }); choose({ cameraId: id });
            }} />
          </div>
          <CompositeButton icon={<BorderOutlined aria-hidden="true" />} label={labels.addCameraBox} disabled={disabled || loading} onClick={() => {
            const id = nextId("camera-box"), box = fitSpatialCameraBox(createSpatialCameraBox(id, labels.cameraBox), draft, "scene");
            perform({ type: "put-camera-box", box }); choose({ cameraBoxId: id }); setBoxView("sheet");
          }} />
          <div className="spatial-add-actions">{(["box", "sphere", "plane"] as const).map(kind => <CompositeButton key={kind} icon={<PlusOutlined aria-hidden="true" />} label={labels[kind]} disabled={disabled || loading} onClick={() => {
            const id = nextId(kind);
            perform({ type: "put-object", object: { id, name: labels[kind], kind, position: [0, 0.3, 0], rotation: [0, 0, 0], size: kind === "plane" ? [2, 1, 2] : [0.6, 0.6, 0.6], color: "#b6a58c" } }); choose({ objectId: id });
          }} />)}</div>
          <Checkbox checked={draft.lightingEnabled ?? false} disabled={disabled || loading} onChange={event => perform({ type: "set-lighting", enabled: event.target.checked })}>{labels.lightingEffects}</Checkbox>
          <Checkbox checked={showRig} onChange={e=>setShowRig(e.target.checked)}>{labels.showRig}</Checkbox>
          <div className="spatial-rig-legend"><span><i className="spatial-joint-dot" />{labels.joints}</span><span><i className="spatial-bone-dot" />{labels.bones}</span></div>
          <div className="spatial-tool-modes">
            {modeButtons}
          </div>
        </section>
      </> : panelTab === "objects" ? <>
        <section className="spatial-objects" aria-label={labels.objects}>
          <h2>{labels.objects}</h2>
          {loading ? <LoadingState label={labels.title} rows={4} /> : <AssetSkeletonTree className="spatial-object-tree" aria-label={labels.objects}
            nodes={nodes} mode="view" showCurrent={false} showContentOrder={false} showStatus={false} showDraft={false} showLock={false}
            showIcon expandAction={false} expandedKeys={expandedKeys} onExpand={keys => setExpandedKeys(keys)}
            selectedKeys={selection ? [selectionKey(selection)!] : []} onSelect={keys => choose(selections.get(String(keys[0])) ?? null, false)}
            icon={({ eventKey }) => { const value = selections.get(String(eventKey)); return value && "cameraId" in value ? <CameraOutlined aria-hidden="true" /> : value && ("objectId" in value || "cameraBoxId" in value) ? <BorderOutlined aria-hidden="true" /> : value && "characterId" in value && value.jointId ? <AimOutlined className="spatial-joint-icon" aria-hidden="true" /> : value && "characterId" in value && value.boneId ? <LinkOutlined className="spatial-bone-icon" aria-hidden="true" /> : <UserOutlined aria-hidden="true" />; }} />}
        </section>
      </> : <>
      {!selected && <p className="spatial-parameters-empty">{labels.selectObjectForParameters}</p>}
      {selected && <section className="spatial-parameters" aria-label={labels.parameters}>
        <h2>{labels.parameters}</h2>
        {!editingCamera && !part && <div className="spatial-tool-modes">{modeButtons}</div>}
        <label className="spatial-field"><span>{joint ? labels.joints : bone ? labels.bones : labels.name}</span><Input key={`${selected.id}/${part?.id ?? ""}/${selected.name}`} aria-label={labels.name} defaultValue={joint ? jointLabel(joint.id, joint.name,actor?.bones.find(b => b.endJointId === joint.id)?.modelPart) : bone ? boneLabel(bone.id,bone.name,bone.modelPart) : hand ? handLabel(hand) : selected.name} disabled={disabled || Boolean(part)} onBlur={event => { if (event.target.value.trim() && event.target.value !== selected.name) updateSelected({ name: event.target.value.trim() }); }} /></label>
        {world && joint && actor ? <>
          <div className="spatial-locks"><Checkbox checked={joint.lockPosition} disabled={disabled} onChange={e => perform({ type: "lock-joint", characterId: actor.id, jointId: joint.id, position: e.target.checked })}>{labels.lockPosition}</Checkbox></div>
          {vectorField(labels.position, world.position.toArray() as Vec3, position => perform({ type: "move-joint", characterId: actor.id, jointId: joint.id, position }), joint.lockPosition, fingerPart(actor.bones.find(b => b.endJointId === joint.id)?.modelPart ?? "") ? .005 : .05)}
        </> : (bone || hand) && actor ? <>
          <div className="spatial-locks"><Checkbox checked={(bone ?? hand)!.lockRotation} disabled={disabled} onChange={e=>perform({type:"lock-bone",characterId:actor.id,boneId:(bone ?? hand)!.id,rotation:e.target.checked})}>{labels.lockRotation}</Checkbox></div>
          {vectorField(labels.localRotation,(bone ?? hand)!.rotation,rotation=>perform({type:"rotate-bone",characterId:actor.id,boneId:(bone ?? hand)!.id,rotation}),(bone ?? hand)!.lockRotation || isRigidBodyConnector((bone ?? hand)!),5)}
          {bone && vectorField(labels.angleMinimum,bone.limits.min,min=>perform({type:"set-bone-limits",characterId:actor.id,boneId:bone.id,limits:{...bone.limits,min}}),isRigidBodyConnector(bone),5)}
          {bone && vectorField(labels.angleMaximum,bone.limits.max,max=>perform({type:"set-bone-limits",characterId:actor.id,boneId:bone.id,limits:{...bone.limits,max}}),isRigidBodyConnector(bone),5)}
        </> : <>
          {vectorField(labels.position, selected.position, position => updateSelected({ position }))}
          {editingCamera ? vectorField(labels.target, editingCamera.target, target => updateSelected({ target })) : vectorField(labels.rotation, (actor ?? object ?? cameraBox)!.rotation, rotation => updateSelected({ rotation }), false, 5)}
        </>}
        {actor && hand && (() => {
          const shown = handPreview?.source === draft ? handPreview.draft.characters.find(c => c.id === actor.id)! : actor;
          const ids = handJointIds(shown,hand);
          const first = (finger: SpatialFinger) => shown.bones.find(b => ids.has(b.endJointId) && fingerPart(b.modelPart)?.finger === finger && fingerPart(b.modelPart)?.segment === 1);
          const slider = (label: string, value: number, patch: (value: number) => Partial<Extract<SpatialOperation,{type:"pose-hand"}>>) => <div className="spatial-hand-control" key={label}>
            <span>{label}</span><Slider min={0} max={100} step={2} value={Math.round(Math.max(0,Math.min(100,value)))} disabled={disabled || loading} ariaLabelForHandle={label} tooltip={{ formatter: value => `${value}%` }} onChange={value => poseHand(patch(value/100),true)} onChangeComplete={value => poseHand(patch(value/100))} onBlur={() => setHandPreview(null)} />
          </div>;
          return <div className="spatial-hand-controls">
            <Tooltip title={labels.resetHandHint}><BasicButton mode="with-icon" icon={<UndoOutlined aria-hidden="true" />} disabled={disabled || loading} onClick={() => { setHandPreview(null); setHandError(null); perform({ type:"reset-hand",characterId:actor.id,handBoneId:hand.id }); }}>{labels.resetHand}</BasicButton></Tooltip>
            {SPATIAL_FINGERS.filter(finger => first(finger)).map(finger => slider(labels.fingerCurl.replace("{{finger}}",fingerName(finger)),first(finger)!.rotation[0]/fingerCurlAngles(finger)[0]*100,value => ({ curl: { [finger]:value } })))}
            {first("little") && slider(labels.fingerSpread,first("little")!.rotation[2]/(hand.modelPart.startsWith("left") ? -18 : 18)*100,spread => ({ spread }))}
            {first("thumb") && slider(labels.thumbOpposition,first("thumb")!.rotation[1]/(hand.modelPart.startsWith("left") ? 60 : -60)*100,thumbOpposition => ({ thumbOpposition }))}
            {handError && <span className="spatial-proportion-error" role="alert">{handError}</span>}
          </div>;
        })()}
        {actor && !part && <>
          <Tooltip title={labels.resetPoseHint}><BasicButton mode="with-icon" icon={<UndoOutlined aria-hidden="true" />} disabled={disabled} onClick={()=>{ setProportionError(null); setProportionPreview(null); perform({type:"reset-pose",characterId:actor.id}); }}>{labels.resetPose}</BasicButton></Tooltip>
          <label className="spatial-field"><span>{labels.appearance}</span><Select aria-label={labels.appearance} value={actor.appearance} disabled={disabled || loading} options={[{value:"quaternius",label:labels.appearanceQuaternius},{value:"geometric",label:labels.appearanceGeometric}]} onChange={appearance => updateSelected({appearance})} /></label>
          <label className="spatial-field"><span>{labels.bodyType}</span><Select aria-label={labels.bodyType} value={actor.bodyType ?? "male"} disabled={disabled || loading} options={[{ value: "male", label: labels.bodyMale }, { value: "female", label: labels.bodyFemale }]} onChange={bodyType => changeProportions({ bodyType })} /></label>
          <div className="spatial-dimensions">
            <label className="spatial-field"><span>{labels.proportions}</span><InputNumber controls={false} aria-label={labels.proportions} min={2} max={12} step={0.5} precision={1} value={actor.headRatio} disabled={disabled} onChange={headRatio => headRatio !== null && changeProportions({ headRatio })} /></label>
            <label className="spatial-field"><span>{labels.height}</span><InputNumber controls={false} aria-label={labels.height} min={0.2} max={20} step={0.1} value={actor.height} disabled={disabled} onChange={height => height !== null && changeProportions({ height })} /></label>
          </div>
          <div className="spatial-body-ratio">
            <div className="spatial-ratio-heading"><span>{labels.bodyLegRatio} <Tooltip title={labels.bodyLegRatioHint}><InfoCircleOutlined tabIndex={0} aria-label={labels.bodyLegRatioHint} /></Tooltip></span><Tooltip title={labels.resetBodyLegRatio}><BasicButton size="small" mode="icon-only" icon={<UndoOutlined aria-hidden="true" />} aria-label={labels.resetBodyLegRatio} disabled={disabled || loading} onClick={() => changeProportions({ torsoRatio: DEFAULT_TORSO_RATIO })} /></Tooltip></div>
            <div className="spatial-ratio-values"><span>{labels.torso} {torsoPercent}%</span><span>{labels.legs} {Number((100 - torsoPercent).toFixed(1))}%</span></div>
            <div className="spatial-ratio-track" style={{ background: `linear-gradient(to right, var(--yisiui-color-action-primary) ${torsoPercent}%, var(--yisiui-color-border-default) ${torsoPercent}%)` }}>
              <Slider className="spatial-ratio-slider" min={TORSO_RATIO_LIMITS.min * 100} max={TORSO_RATIO_LIMITS.max * 100} step={2} value={torsoPercent} disabled={disabled || loading}
                marks={torsoPercent % 2 ? { [torsoPercent]: torsoPercent } : undefined}
                styles={{ root: { left: `${TORSO_RATIO_LIMITS.min * 100}%`, right: `${(1 - TORSO_RATIO_LIMITS.max) * 100}%` }, rail: { background: "transparent" }, track: { background: "transparent" } }}
                ariaLabelForHandle={labels.bodyLegRatio} ariaValueTextFormatterForHandle={ratioText} tooltip={{ formatter: value => ratioText(value ?? torsoPercent) }}
                onChange={value => changeProportions({ torsoRatio: value / 100 }, true)} onChangeComplete={value => changeProportions({ torsoRatio: value / 100 })} onBlur={() => setProportionPreview(null)} />
            </div>
          </div>
          {(Object.keys(BODY_SHAPE_LIMITS) as (keyof SpatialBodyShape)[]).map(key => {
            const limits = BODY_SHAPE_LIMITS[key], percent = Number(((previewActor?.[key] ?? 1) * 100).toFixed(1));
            return <div className="spatial-shape-control" key={key}>
              <span>{labels[key]}{key === "neckLength" && <> <Tooltip title={labels.bodyShapeHint}><InfoCircleOutlined tabIndex={0} aria-label={labels.bodyShapeHint} /></Tooltip></>}</span>
              <Slider min={limits.min * 100} max={limits.max * 100} step={2} value={percent} disabled={disabled || loading}
                marks={percent % 2 ? { [percent]: "" } : undefined}
                ariaLabelForHandle={labels[key]} ariaValueTextFormatterForHandle={value => `${value}%`} tooltip={{ formatter: value => `${value}%` }}
                onChange={value => changeProportions({ [key]: value / 100 }, true)} onChangeComplete={value => changeProportions({ [key]: value / 100 })} onBlur={() => setProportionPreview(null)} />
              <InputNumber aria-label={labels[key]} controls={false} min={limits.min * 100} max={limits.max * 100} step={2} value={percent} disabled={disabled || loading}
                formatter={value => `${value}%`} parser={value => Number(value?.replace("%", ""))} onChange={value => value !== null && changeProportions({ [key]: value / 100 })} />
            </div>;
          })}
          {proportionError && <span className="spatial-proportion-error" role="alert">{proportionError}</span>}
        </>}
        {object && vectorField(labels.size, object.size, size => updateSelected({ size }))}
        {(actor || object) && !part && <label className="spatial-field"><span>{labels.color}</span><input type="color" aria-label={labels.color} disabled={disabled} value={(actor ?? object)!.color} onChange={event => updateSelected({ color: event.target.value })} /></label>}
        {cameraBox && <>
          <div className="spatial-tool-modes"><Tooltip title={labels.cameraBoxHint}><InfoCircleOutlined tabIndex={0} aria-label={labels.cameraBoxHint} /></Tooltip>
            <BasicButton size="small" disabled={disabled || loading || !draft.characters.length && !draft.objects.length} onClick={() => perform({ type: "fit-camera-box", id: cameraBox.id, region: "scene" })}>{labels.fitCameraBoxScene}</BasicButton>
            <BasicButton size="small" disabled={disabled || loading || !draft.characters.length} onClick={() => perform({ type: "fit-camera-box", id: cameraBox.id, region: "hands" })}>{labels.fitCameraBoxHands}</BasicButton>
          </div>
          <label className="spatial-field"><span>{labels.cameraBoxSize}</span><InputNumber controls={false} aria-label={labels.cameraBoxSize} value={Number(cameraBox.size.toFixed(3))} min={.05} max={1000} step={.05} disabled={disabled} onChange={size => size !== null && updateSelected({ size })} /></label>
          <label className="spatial-field"><span>{labels.cameraBoxResolution}</span><Select aria-label={labels.cameraBoxResolution} value={cameraBox.resolution} disabled={disabled} options={[...new Set([128,256,512,1024,cameraBox.resolution])].sort((a,b)=>a-b).map(value => ({value,label:`${value} × ${value}`}))} onChange={resolution => updateSelected({ resolution })} /></label>
        </>}
        {editingCamera && <>
          <BasicButton size="small" disabled={disabled} onClick={() => updateSelected(view)}>{labels.useView}</BasicButton>
          <label className="spatial-field"><span>{labels.projection}</span><Select aria-label={labels.projection} value={editingCamera.projection} disabled={disabled} options={[{ value: "perspective", label: labels.perspective }, { value: "orthographic", label: labels.orthographic }]} onChange={projection => updateSelected({ projection })} /></label>
          <label className="spatial-field"><span>{editingCamera.projection === "perspective" ? labels.fov : labels.span}</span><InputNumber controls={false} aria-label={editingCamera.projection === "perspective" ? labels.fov : labels.span} value={editingCamera.projection === "perspective" ? editingCamera.fov : editingCamera.span} min={editingCamera.projection === "perspective" ? 10 : 0.1} max={editingCamera.projection === "perspective" ? 120 : 1000} disabled={disabled} onChange={v => v !== null && updateSelected(editingCamera.projection === "perspective" ? { fov: v } : { span: v })} /></label>
          <div className="spatial-output-size">{(["width", "height"] as const).map(axis => <label className="spatial-field" key={axis}><span>{axis === "width" ? labels.outputWidth : labels.outputHeight}</span><InputNumber controls={false} aria-label={axis === "width" ? labels.outputWidth : labels.outputHeight} min={128} max={2048} step={16} precision={0} disabled={disabled} value={editingCamera[axis]} onChange={value => value !== null && updateSelected({ [axis]: value })} /></label>)}</div>
          <Checkbox checked={editingCamera.background === null} disabled={disabled} onChange={event => updateSelected({ background: event.target.checked ? null : "#ffffff" })}>{labels.transparent}</Checkbox>
        </>}
        {!part && <div className="spatial-object-actions"><BasicButton mode="with-icon" size="small" icon={<CopyOutlined aria-hidden="true" />} disabled={disabled} onClick={() => {
          const id = nextId("copy");
          if (actor) perform({ type: "put-character", character: { ...structuredClone(actor), id, position: [actor.position[0] + 0.8, actor.position[1], actor.position[2]] } });
          else if (object) perform({ type: "put-object", object: { ...structuredClone(object), id, position: [object.position[0] + 0.8, object.position[1], object.position[2]] } });
          else if (editingCamera) perform({ type: "put-camera", camera: { ...structuredClone(editingCamera), id } });
          else if (cameraBox) perform({ type: "put-camera-box", box: { ...structuredClone(cameraBox), id } });
        }}>{labels.duplicate}</BasicButton><ConfirmAction aria-label={actions.delete} size="small" icon={<DeleteOutlined />} disabled={disabled || Boolean(editingCamera && draft.cameras.length === 1)} confirmLabel={actions.delete} cancelLabel={actions.cancel} title={labels.deleteConfirm} onConfirm={() => { perform({ type: "remove", id: selected.id }); setSelection(null); }}>{null}</ConfirmAction></div>}
      </section>}
      <section className="spatial-preview" aria-label={labels.cameraView}>
        <h2>{cameraBox ? labels.cameraBoxSheet : labels.cameraView}</h2>
        {cameraBox ? <Select aria-label={labels.cameraBoxView} value={boxView} options={(["sheet", ...SPATIAL_BOX_FACES] as SpatialBoxView[]).map(value => ({ value, label: faceLabel(value) }))} onChange={setBoxView} /> : <Select aria-label={labels.selectCamera} value={camera.id} options={draft.cameras.map(c => ({ value: c.id, label: c.name }))} onChange={id => { setCameraId(id); if (editingCamera) choose({ cameraId: id }); }} />}
        <TabSwitch className="spatial-reference-tabs" aria-label={labels.referencePass} value={referencePass} onChange={value => setReferencePass(value as SpatialRenderPass)} items={[
          { key: "color", label: labels.referenceColor, mode: "text-only", disabled: disabled || loading },
          { key: "structure", label: labels.referenceStructure, mode: "text-only", disabled: disabled || loading },
          { key: "depth", label: labels.referenceDepth, mode: "text-only", disabled: disabled || loading },
          { key: "skeleton", label: labels.referenceSkeleton, mode: "text-only", disabled: disabled || loading },
        ]} />
        {referenceSource && <CameraReferencePreview key={referenceSource} source={referenceSource} camera={cameraBox ? { id: `${cameraBox.id}-${boxView}`, name: `${cameraBox.name} · ${faceLabel(boxView)}`, ...cameraBoxImageSize(cameraBox, boxView) } : camera} pass={referencePass} labels={labels} retryLabel={actions.retry} disabled={disabled} />}
      </section>
      </>}
    </div>
  </div>;
  return <>
    <section {...uiAssetAttributes({ namespace: "human2ai", id: "spatial-workspace-view", name: "SpatialWorkspaceView", category: "composition", origin: "project", status: "candidate" })} className="spatial-workspace" data-canvas-editor aria-label={labels.title}>
      <div className="spatial-center">
        {historyControls}
        {error && <Alert type="error" message={error} action={onRetry && <BasicButton size="small" onClick={onRetry}>{actions.retry}</BasicButton>} />}
        {status && <div className="spatial-status" role="status">{status}</div>}
        {loading ? <LoadingState label={labels.title} rows={6} /> : <SpatialViewport interactionResetKey={interactionResetKey} showRig={showRig} draft={handPreview?.source === draft ? handPreview.draft : preview?.draft ?? draft} selection={selection} mode={mode} onSelect={choose} onOperation={perform} onViewChange={setView} label={labels.viewport} errorLabel={labels.webglFailed} disabled={disabled} />}
      </div>
    </section>
    {panelHost && createPortal(panel, panelHost)}
  </>;
}

function CameraReferencePreview({ source, camera, pass, labels, retryLabel, disabled }: { source: string; camera: Pick<SpatialCamera, "id" | "name" | "width" | "height">; pass: SpatialRenderPass; labels: SpatialLabels; retryLabel: string; disabled?: boolean }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const label = pass === "color" ? labels.referenceColor : pass === "structure" ? labels.referenceStructure : pass === "depth" ? labels.referenceDepth : labels.referenceSkeleton;
  return <>
    {state === "loading" && <LoadingState label={label} rows={1} />}
    {state === "error" && <Alert type="error" message={labels.referenceLoadFailed} action={<BasicButton size="small" disabled={disabled} onClick={() => { setState("loading"); setAttempt(value => value + 1); }}>{retryLabel}</BasicButton>} />}
    <img key={attempt} src={source} alt={`${camera.name} · ${label}`} width={camera.width} height={camera.height} onLoad={() => setState("ready")} onError={() => setState("error")}
      style={{ display: state === "error" ? "none" : undefined, visibility: state === "loading" ? "hidden" : undefined, aspectRatio: `${camera.width} / ${camera.height}`, maxWidth: 230 * camera.width / camera.height }} />
    <BasicButton mode="with-icon" size="small" icon={<DownloadOutlined aria-hidden="true" />} disabled={disabled || state !== "ready"} href={!disabled && state === "ready" ? source : undefined} download={`${camera.id}-${pass}.png`}>{labels.downloadReference}</BasicButton>
  </>;
}
