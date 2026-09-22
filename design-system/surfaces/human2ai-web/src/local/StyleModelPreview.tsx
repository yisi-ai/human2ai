"use client";

import { QuestionCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { useEffect, useRef, useState } from "react";
import { ACESFilmicToneMapping, AmbientLight, Box3, DirectionalLight, Group, LoadingManager, Mesh, PerspectiveCamera, Scene, Spherical, Texture, Vector3, WebGLRenderer } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { PMREMGenerator } from "three";
import { BasicButton } from "../vendor/yisiui/runtime/src/components/BasicButton";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";

import "./StyleModelPreview.css";

export interface StyleModelPreviewLabels {
  label: string;
  loading: string;
  failed: string;
  reset: string;
  controls: string;
  retry: string;
}

export default function StyleModelPreview({ url, labels }: { url: string; labels: StyleModelPreviewLabels }) {
  const host = useRef<HTMLDivElement>(null);
  const reset = useRef<(() => void) | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = host.current!;
    setState("loading");
    let renderer: WebGLRenderer;
    try { renderer = new WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setState("error"); return; }
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    element.appendChild(renderer.domElement);
    const scene = new Scene();
    const camera = new PerspectiveCamera(35, 1, 0.01, 100);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enablePan = false;
    const ambient = new AmbientLight(0xffffff, 0.5);
    const light = new DirectionalLight(0xffffff, 2);
    light.position.set(3, 5, 4);
    scene.add(ambient, light);
    const room = new RoomEnvironment();
    const pmrem = new PMREMGenerator(renderer);
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
    let model: Group | undefined;
    let loadedScenes: Group[] = [];
    let cancelled = false;
    let radius = 1;
    const draw = () => renderer.render(scene, camera);
    const fit = () => {
      const halfFov = Math.atan(Math.tan(camera.fov * Math.PI / 360) * Math.min(1, camera.aspect));
      const distance = radius / Math.sin(halfFov) * 1.15;
      camera.position.copy(new Vector3(1, 0.7, 1.2).normalize().multiplyScalar(distance));
      camera.near = radius / 100;
      camera.far = distance + radius * 100;
      camera.updateProjectionMatrix();
      orbit.target.set(0, 0, 0);
      orbit.minDistance = radius * 1.15;
      orbit.maxDistance = distance * 4;
      orbit.update();
      draw();
    };
    reset.current = fit;
    const resize = () => {
      const width = element.clientWidth, height = element.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (model) fit();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    orbit.addEventListener("change", draw);
    const keydown = (event: KeyboardEvent) => {
      if (!model || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "Home"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Home") { fit(); return; }
      const spherical = new Spherical().setFromVector3(camera.position.clone().sub(orbit.target));
      if (event.key === "ArrowLeft") spherical.theta -= 0.12;
      if (event.key === "ArrowRight") spherical.theta += 0.12;
      if (event.key === "ArrowUp") spherical.phi -= 0.12;
      if (event.key === "ArrowDown") spherical.phi += 0.12;
      if (event.key === "+" || event.key === "=") spherical.radius /= 1.15;
      if (event.key === "-") spherical.radius *= 1.15;
      spherical.makeSafe();
      spherical.radius = Math.max(orbit.minDistance, Math.min(orbit.maxDistance, spherical.radius));
      camera.position.setFromSpherical(spherical).add(orbit.target);
      orbit.update();
    };
    element.addEventListener("keydown", keydown);
    const controller = new AbortController();
    const manager = new LoadingManager();
    // Generated examples are self-contained; never resolve external dependencies.
    manager.setURLModifier((resource) => {
      if (!resource.startsWith("blob:")) throw new Error("External model resources are unsupported");
      return resource;
    });
    void fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Model request failed");
        return response.arrayBuffer();
      })
      .then((data) => new GLTFLoader(manager).parseAsync(data, ""))
      .then((gltf) => {
        if (cancelled) { gltf.scenes.forEach(disposeModel); return; }
        loadedScenes = gltf.scenes;
        model = gltf.scene;
        const bounds = new Box3().setFromObject(model);
        radius = bounds.getSize(new Vector3()).length() / 2;
        if (!Number.isFinite(radius) || radius <= 0) throw new Error("Model has no visible geometry");
        model.position.sub(bounds.getCenter(new Vector3()));
        scene.add(model);
        resize();
        setState("ready");
      })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => {
      cancelled = true;
      controller.abort();
      reset.current = null;
      observer.disconnect();
      element.removeEventListener("keydown", keydown);
      orbit.dispose();
      loadedScenes.forEach(disposeModel);
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url, attempt]);

  return <div
    {...uiAssetAttributes({ namespace: "human2ai", id: "style-model-preview", name: "StyleModelPreview", category: "canvas", origin: "project", status: "candidate" })}
    className="human2ai-style-model-preview"
    data-state={state}
  >
    <div ref={host} className="human2ai-style-model-preview__canvas" role="region" aria-label={labels.label} aria-busy={state === "loading"} tabIndex={0} />
    {state !== "ready" ? <div className="human2ai-style-model-preview__status" role={state === "error" ? "alert" : "status"}>
      <span>{state === "error" ? labels.failed : labels.loading}</span>
      {state === "error" ? <BasicButton type="text" onClick={() => setAttempt((value) => value + 1)}>{labels.retry}</BasicButton> : null}
    </div> : null}
    <div className="human2ai-style-model-preview__tools">
      <Tooltip title={labels.controls}><BasicButton type="text" mode="icon-only" aria-label={labels.controls} icon={<QuestionCircleOutlined aria-hidden="true" />} /></Tooltip>
      <Tooltip title={labels.reset}><BasicButton type="text" mode="icon-only" aria-label={labels.reset} disabled={state !== "ready"} icon={<ReloadOutlined aria-hidden="true" />} onClick={() => reset.current?.()} /></Tooltip>
    </div>
  </div>;
}

function disposeModel(model: Group): void {
  const textures = new Set<Texture>();
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
      material.dispose();
    }
    if ("skeleton" in object) (object as Mesh & { skeleton: { dispose(): void } }).skeleton.dispose();
  });
  for (const texture of textures) {
    if (typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap) texture.image.close();
    texture.dispose();
  }
}
