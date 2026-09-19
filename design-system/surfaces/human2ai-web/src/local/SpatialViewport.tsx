"use client";

import { useEffect, useRef, useState } from "react";
import { AmbientLight, AxesHelper, BoxGeometry, Color, EdgesGeometry, LineSegments, CameraHelper, DirectionalLight, GridHelper, Group, Mesh, MeshLambertMaterial, Object3D, PCFShadowMap, PerspectiveCamera, Raycaster, Scene, Vector2, WebGLRenderer, LineBasicMaterial } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { angles, boneAngles, fingerBasis, handJointIds, fingerPart, boneWorldTransforms, applySpatialOperations, jointWorldTransforms, quaternion, vector, isRigidBodyConnector, type SpatialDraft, type SpatialOperation, type Vec3 } from "../../../../../src/domain/spatial";
import { createOutputCamera, disposeSpatialScene } from "../../../../../src/domain/spatial/scene";
import { SpatialSceneCache } from "../../../../../src/domain/spatial/scene-cache";
import { fitSpatialLight, getSpatialLighting } from "../../../../../src/domain/spatial/lighting";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";

export type SpatialSelection = { characterId: string; jointId?: string; boneId?: string; handBoneId?: string } | { objectId: string } | { cameraId: string } | { cameraBoxId: string } | null;
export interface SpatialViewportProps {
  interactionResetKey?: number;
  draft: SpatialDraft;
  selection: SpatialSelection;
  mode: "translate" | "rotate";
  onSelect(selection: SpatialSelection): void;
  onOperation(operation: SpatialOperation): void;
  onViewChange?(view: { position: Vec3; target: Vec3 }): void;
  label: string;
  errorLabel: string;
  disabled?: boolean;
  showRig?: boolean;
}

export function SpatialViewport(props: SpatialViewportProps) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef(props);
  current.current = props;
  const runtime = useRef<{ rebuild(draft: SpatialDraft): void; select(): void; cancel(): void } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = host.current!;
    let renderer: WebGLRenderer;
    try { renderer = new WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    element.appendChild(renderer.domElement);
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 1, 0.01, 30000);
    camera.position.set(3, 2.2, 5);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.target.set(0, 0.9, 0); orbit.update();
    const grid = new GridHelper(20, 40, "#a4aeb8", "#e0e4e8");
    const ambient = new AmbientLight(0xffffff);
    scene.add(grid, ambient);
    const light = new DirectionalLight(0xffffff); scene.add(light,light.target);
    const anchor = new Object3D(); scene.add(anchor);
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setSpace("world"); transform.setSize(0.75); scene.add(transform.getHelper());
    const contentCache = new SpatialSceneCache(), content = contentCache.scene;
    scene.add(content);
    const baseColors = new WeakMap<Mesh, Color>();
    let lightingEnabled: boolean | undefined;
    const boxGuides = new Group(); scene.add(boxGuides);
    let cameraGuide: CameraHelper | null = null;
    let dragging = false;
    let base: SpatialDraft | null = null;
    let frame = 0;
    let drawFrame = 0;
    const draw = () => {
      if (!drawFrame) drawFrame = requestAnimationFrame(() => { drawFrame = 0; renderer.render(scene, camera); });
    };
    const rebuild = (draft: SpatialDraft) => {
      const surfacesChanged = contentCache.update(draft, { showRig: current.current.showRig, dragging });
      const lightChanged = lightingEnabled !== Boolean(draft.lightingEnabled);
      lightingEnabled = Boolean(draft.lightingEnabled);
      const lighting = getSpatialLighting(draft);
      ambient.intensity = lighting.ambient*Math.PI; light.intensity = lighting.key*Math.PI;
      renderer.shadowMap.enabled = Boolean(lighting.shadowStrength);
      if (surfacesChanged || lightChanged) {
        if (renderer.shadowMap.enabled) fitSpatialLight(light,content);
        renderer.shadowMap.needsUpdate = true;
      }
      const selection = current.current.selection;
      if (cameraGuide) { scene.remove(cameraGuide); cameraGuide.dispose(); cameraGuide = null; }
      const selectedCamera = selection && "cameraId" in selection ? draft.cameras.find(c => c.id === selection.cameraId) : undefined;
      if (selectedCamera) {
        const outputCamera = createOutputCamera(selectedCamera);
        // Show the useful framing at the look-at target, rather than the distant clipping plane.
        outputCamera.far = Math.max(outputCamera.near * 2, outputCamera.position.distanceTo(vector(selectedCamera.target)));
        outputCamera.updateProjectionMatrix();
        cameraGuide = new CameraHelper(outputCamera);
        const material = cameraGuide.material as LineBasicMaterial;
        material.vertexColors = false; material.color.set("#9cbbd3");
        material.transparent = true; material.opacity = .7;
        material.depthTest = false; cameraGuide.renderOrder = 1;
        scene.add(cameraGuide);
      }
      disposeSpatialScene(boxGuides); boxGuides.clear();
      for (const box of draft.cameraBoxes ?? []) {
        const selected = selection && "cameraBoxId" in selection && selection.cameraBoxId === box.id;
        const geometry = new BoxGeometry(box.size,box.size,box.size);
        const outline = new LineSegments(new EdgesGeometry(geometry), new LineBasicMaterial({ color: selected ? "#467bd3" : "#9cbbd3", transparent: true, opacity: selected ? .95 : .45, depthTest: false }));
        geometry.dispose(); outline.position.copy(vector(box.position)); outline.quaternion.copy(quaternion(box.rotation));
        outline.userData.cameraBoxId = box.id; outline.renderOrder = 1; boxGuides.add(outline);
        if (selected) { const axes = new AxesHelper(box.size * .25); axes.position.copy(outline.position); axes.quaternion.copy(outline.quaternion); boxGuides.add(axes); }
      }
      const highlight = getComputedStyle(element).getPropertyValue("--yisiui-color-action-primary").trim() || "#467bd3";
      const handActor = selection && "characterId" in selection && selection.handBoneId ? draft.characters.find(c => c.id === selection.characterId) : undefined;
      const hand = handActor?.bones.find(b => b.id === (selection && "characterId" in selection ? selection.handBoneId : undefined));
      const handIds = handActor && hand ? handJointIds(handActor,hand) : undefined;
      content.traverse(mesh => {
        if (!(mesh instanceof Mesh) || !(mesh.material instanceof MeshLambertMaterial)) return;
        const baseColor = baseColors.get(mesh);
        if (baseColor) mesh.material.color.copy(baseColor);
        else baseColors.set(mesh, mesh.material.color.clone());
        if (!selection) return;
        const data = mesh.userData;
        const selected = "characterId" in selection
          ? data.characterId === selection.characterId && (handIds ? handIds.has(data.jointId) || data.jointId === hand!.startJointId || handIds.has(handActor!.bones.find(b => b.id === data.boneId)?.endJointId ?? "") : selection.jointId ? data.jointId === selection.jointId : selection.boneId ? data.boneId === selection.boneId : true)
          : "objectId" in selection && data.objectId === selection.objectId;
        if (selected) {
          const coloredFinger = fingerPart(data.modelPart ?? "") && draft.characters.find(c=>c.id===data.characterId)?.appearance === "geometric";
          if (coloredFinger) mesh.material.color.lerp(new Color("#ffffff"),.3);
          else mesh.material.color.set(highlight);
        }
      });
      draw();
    };
    const select = () => {
      if (dragging) return;
      const { draft, selection, mode, disabled } = current.current;
      const activeMode = selection && "characterId" in selection ? selection.jointId ? "translate" : selection.boneId || selection.handBoneId ? "rotate" : mode : mode;
      transform.setMode(activeMode);
      transform.setSpace(selection && "characterId" in selection && (selection.boneId || selection.handBoneId) ? "local" : "world");
      transform.detach();
      if (disabled || !selection || "cameraId" in selection) { draw(); return; }
      if ("characterId" in selection) {
        const actor = draft.characters.find(c => c.id === selection.characterId);
        if (!actor) return;
        const joint = actor.joints.find(j => j.id === selection.jointId);
        const bone = actor.bones.find(b=>b.id === (selection.boneId ?? selection.handBoneId));
        if (bone) {
          const world = boneWorldTransforms(actor)[bone.id];
          anchor.position.copy(world.position); anchor.quaternion.copy(world.rotation).multiply(fingerBasis(actor,bone));
          if (bone.lockRotation || isRigidBodyConnector(bone)) { draw(); return; }
        } else if (joint) {
          const world = jointWorldTransforms(actor)[joint.id];
          anchor.position.copy(world.position); anchor.quaternion.copy(world.rotation);
          if (joint.lockPosition) { draw(); return; }
        } else { anchor.position.copy(vector(actor.position)); anchor.quaternion.copy(quaternion(actor.rotation)); }
      } else {
        const object = "cameraBoxId" in selection ? draft.cameraBoxes?.find(box => box.id === selection.cameraBoxId) : draft.objects.find(o => o.id === selection.objectId);
        if (!object) return;
        anchor.position.copy(vector(object.position)); anchor.quaternion.copy(quaternion(object.rotation));
      }
      transform.attach(anchor); draw();
    };
    const operation = (): SpatialOperation | null => {
      const { selection } = current.current;
      const source = base ?? current.current.draft;
      if (!selection || "cameraId" in selection) return null;
      const position = anchor.position.toArray() as Vec3, rotation = angles(anchor.quaternion);
      if ("characterId" in selection) {
        if (selection.jointId) return { type: "move-joint", characterId: selection.characterId, jointId: selection.jointId, position };
        const actor = source.characters.find(c => c.id === selection.characterId);
        const bone = actor?.bones.find(b=>b.id === (selection.boneId ?? selection.handBoneId));
        if (actor && bone) {
          const parent = jointWorldTransforms(actor)[bone.startJointId].rotation;
          const physical = anchor.quaternion.clone().multiply(fingerBasis(actor,bone).invert());
          return { type: "rotate-bone", characterId:actor.id, boneId:bone.id, rotation:boneAngles(actor,bone,parent.clone().invert().multiply(physical)) };
        }
        return actor ? { type: "put-character", character: { ...actor, position, rotation } } : null;
      }
      if ("cameraBoxId" in selection) {
        const box = source.cameraBoxes?.find(box => box.id === selection.cameraBoxId);
        return box ? { type: "put-camera-box", box: { ...box, position, rotation } } : null;
      }
      const object = source.objects.find(o => o.id === selection.objectId);
      return object ? { type: "put-object", object: { ...object, position, rotation } } : null;
    };
    transform.addEventListener("mouseDown", () => { dragging = true; base = current.current.draft; orbit.enabled = false; });
    transform.addEventListener("objectChange", () => {
      if (!dragging || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const op = operation();
        if (!op || !base) return;
        try { rebuild(applySpatialOperations(base, [op]).draft); } catch { rebuild(base); }
      });
    });
    transform.addEventListener("mouseUp", () => {
      if (!dragging) return;
      const op = operation();
      dragging = false; orbit.enabled = true;
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      if (op) current.current.onOperation(op);
      base = null;
      rebuild(current.current.draft); select();
    });
    transform.addEventListener("change", draw);
    const cancel = () => {
      if (dragging) transform.reset();
      dragging = false; base = null; orbit.enabled = true;
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      rebuild(current.current.draft); select();
    };
    renderer.domElement.addEventListener("pointercancel", cancel);
    const viewChanged = () => {
      draw(); current.current.onViewChange?.({ position: camera.position.toArray() as Vec3, target: orbit.target.toArray() as Vec3 });
    };
    orbit.addEventListener("change", viewChanged);
    let pointerStart: [number, number] | null = null;
    const down = (event: PointerEvent) => { element.focus(); pointerStart = [event.clientX, event.clientY]; };
    const pick = (event: PointerEvent) => {
      if (!pointerStart || event.button !== 0 || dragging || transform.axis || current.current.disabled) return;
      if (Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 4) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ray = new Raycaster();
      ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      ray.params.Line.threshold = .015;
      const boxHit = ray.intersectObjects(boxGuides.children).find(hit => hit.object.userData.cameraBoxId);
      const hits = content ? ray.intersectObjects(content.children, true) : [];
      const hit = hits.find(hit=>hit.object.userData.rig === "joint") ?? hits.find(hit=>hit.object.userData.rig) ?? hits[0];
      if (boxHit && (!hit || boxHit.distance < hit.distance)) { current.current.onSelect({ cameraBoxId: boxHit.object.userData.cameraBoxId }); return; }
      if (hit) {
        const data = hit.object.userData;
        current.current.onSelect(data.characterId ? { characterId: data.characterId, jointId: data.jointId, boneId: data.boneId } : { objectId: data.objectId });
      }
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", pick);
    const resize = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); draw();
    });
    resize.observe(element);
    runtime.current = { rebuild, select, cancel };
    rebuild(current.current.draft); select(); viewChanged();
    return () => {
      runtime.current = null;
      if (frame) cancelAnimationFrame(frame);
      if (drawFrame) cancelAnimationFrame(drawFrame);
      resize.disconnect(); orbit.dispose(); transform.dispose();
      grid.geometry.dispose(); for (const material of Array.isArray(grid.material) ? grid.material : [grid.material]) material.dispose();
      contentCache.dispose();
      cameraGuide?.dispose(); disposeSpatialScene(boxGuides);
      light.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, []);
  useEffect(() => { runtime.current?.rebuild(props.draft); runtime.current?.select(); }, [props.draft, props.selection, props.mode, props.disabled, props.showRig]);

  useEffect(() => { if (props.interactionResetKey !== undefined) runtime.current?.cancel(); }, [props.interactionResetKey]);

  return <div {...uiAssetAttributes({ namespace: "human2ai", id: "spatial-viewport", name: "SpatialViewport", category: "canvas", origin: "project", status: "candidate" })}
    ref={host} className="spatial-viewport" tabIndex={0} role="region" aria-label={props.label}
    onKeyDown={event => {
      if (event.key === "Escape") { runtime.current?.cancel(); props.onSelect(null); return; }
      const axes: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowDown: [1, -1], ArrowUp: [1, 1], PageDown: [2, -1], PageUp: [2, 1] };
      const delta = axes[event.key], selection = props.selection;
      if (!delta || props.disabled || !selection || !("characterId" in selection)) return;
      const actor = props.draft.characters.find(c => c.id === selection.characterId);
      if (!actor) return;
      if (selection.jointId) {
        event.preventDefault();
        const position = jointWorldTransforms(actor)[selection.jointId].position.toArray() as Vec3;
        const finger = fingerPart(actor.bones.find(b => b.endJointId === selection.jointId)?.modelPart ?? "");
        position[delta[0]] += delta[1] * (event.shiftKey ? 5 : 1) * (finger ? actor.height * .002 : .02);
        props.onOperation({ type:"move-joint",characterId:actor.id,jointId:selection.jointId,position });
      } else if (selection.boneId || selection.handBoneId) {
        event.preventDefault();
        const bone = actor.bones.find(b=>b.id===(selection.boneId ?? selection.handBoneId))!;
        if (bone.lockRotation || isRigidBodyConnector(bone)) return;
        const rotation = [...bone.rotation] as Vec3; rotation[delta[0]] += delta[1] * (event.shiftKey ? 10 : 2);
        props.onOperation({ type:"rotate-bone",characterId:actor.id,boneId:bone.id,rotation });
      }

    }}>
    {failed && <div className="spatial-viewport__error" role="alert">{props.errorLabel}</div>}
  </div>;
}
