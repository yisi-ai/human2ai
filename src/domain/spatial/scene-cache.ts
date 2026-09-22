import { Color, Group, Matrix4, Mesh } from "three";
import { createSpatialScene, disposeSpatialScene, updateSpatialRig } from "./scene.ts";
import { applySpatialContactShading, spatialSurfaces } from "./lighting.ts";
import type { SpatialDraft } from "./types.ts";
import { spatialEntityRenderKey } from "./render-inputs.ts";
import { entityMatrix, rememberSpatialColors, updateSpatialGeometry } from "./scene-update.ts";
import { updateCharacterModel } from "./model.ts";

interface ShadingRequest { draft: SpatialDraft; key: string; topology: string }
interface SceneCacheOptions {
  shade?(draft: SpatialDraft): Promise<Float32Array[]>;
  onShaded?(): void;
}

/** Editor-owned meshes; deterministic exports continue to use createSpatialScene. */
export class SpatialSceneCache {
  readonly scene = new Group();
  private entries = new Map<string, { key: string; shapeKey: string; group: Group; origin: Matrix4 }>();
  readonly baseColors = new WeakMap<Mesh, Color>();
  private shadedKey?: string;
  private shadedTopology?: string;
  private colors?: Float32Array[];
  private desired?: ShadingRequest;
  private shading = false;
  private disposed = false;

  constructor(private options: SceneCacheOptions = {}) {}

  update(draft: SpatialDraft, options: { showRig?: boolean; dragging?: boolean } = {}): boolean {
    const next: typeof this.entries = new Map();
    let changed = false;
    for (const entity of [...draft.characters, ...draft.objects]) {
      const key = JSON.stringify([spatialEntityRenderKey(entity), Boolean(options.showRig)]);
      let entry = this.entries.get(entity.id);
      if (entry?.key !== key) {
        const shapeKey = JSON.stringify([spatialEntityRenderKey({ ...entity, position: [0,0,0], rotation: [0,0,0] }), Boolean(options.showRig)]);
        if (entry?.shapeKey === shapeKey) {
          entry.group.matrixAutoUpdate = false;
          entry.group.matrix.copy(entityMatrix(entity).multiply(entry.origin));
          entry.group.matrixWorldNeedsUpdate = true;
          entry.key = key;
        } else {
          const part = "bones" in entity
            ? { ...draft, characters: [entity], objects: [] }
            : { ...draft, characters: [], objects: [entity] };
          const rig = entry?.group.children.filter(object => object.userData.rig) ?? [];
          if (rig.length) entry!.group.remove(...rig);
          const model = entry?.group.children[0];
          if (entry && "bones" in entity && model instanceof Group && updateCharacterModel(model, entity)) {
            entry.group.matrixAutoUpdate = true; entry.group.matrix.identity();
            entry = { key, shapeKey, group: entry.group, origin: entityMatrix(entity).invert() };
          } else {
            const fresh = createSpatialScene(part);
            if (entry && updateSpatialGeometry(entry.group, fresh)) {
              disposeSpatialScene(fresh);
              entry = { key, shapeKey, group: entry.group, origin: entityMatrix(entity).invert() };
            } else {
              if (entry) { this.scene.remove(entry.group); disposeSpatialScene(entry.group); }
              entry = { key, shapeKey, group: fresh, origin: entityMatrix(entity).invert() };
            }
          }
          if ("bones" in entity && options.showRig && entity.appearance !== "geometric") {
            if (rig.length) entry.group.add(...rig);
            updateSpatialRig(entry.group, entity, true);
          } else if (rig.length) disposeSpatialScene(new Group().add(...rig));
          rememberSpatialColors(entry.group, this.baseColors);
        }
        changed = true;
      }
      next.set(entity.id, entry);
    }
    for (const [id, entry] of this.entries) {
      if (!next.has(id)) { this.scene.remove(entry.group); disposeSpatialScene(entry.group); changed = true; }
    }
    const groups = [...next.values()].map(entry => entry.group);
    if (groups.some((group,i) => this.scene.children[i] !== group)) {
      this.scene.clear(); this.scene.add(...groups); changed = true;
    }
    this.entries = next;
    if (changed) this.scene.updateMatrixWorld(true);

    // Cameras, selection, helpers and light switches do not affect contact rays.
    const surfaceKey = JSON.stringify([...next.values()].map(entry => entry.key));
    const meshes = spatialSurfaces(this.scene);
    const topology = meshes.map(mesh => JSON.stringify([mesh.userData, mesh.geometry.getAttribute("position").count])).join("/");
    const needsShading = !this.colors || topology !== this.shadedTopology || surfaceKey !== this.shadedKey;
    this.desired = !options.dragging && needsShading ? { draft, key: surfaceKey, topology } : undefined;
    if (this.options.shade) {
      if (!this.colors || topology !== this.shadedTopology) {
        this.colors = meshes.map(mesh => new Float32Array(mesh.geometry.getAttribute("position").count * 3).fill(1));
        this.shadedTopology = topology; this.shadedKey = undefined;
      }
      if (changed) applySpatialContactShading(this.scene, draft, this.colors);
      this.scheduleShading();
    } else if (!this.colors || topology !== this.shadedTopology || (!options.dragging && needsShading)) {
      this.colors = applySpatialContactShading(this.scene, draft);
      this.shadedKey = surfaceKey; this.shadedTopology = topology;
    } else if (changed) {
      applySpatialContactShading(this.scene, draft, this.colors);
    }
    return changed;
  }

  private scheduleShading(): void {
    if (this.shading || !this.desired || this.disposed) return;
    const request = this.desired;
    this.shading = true;
    void this.options.shade!(request.draft).then(colors => {
      if (this.disposed || this.desired?.key !== request.key || this.desired.topology !== request.topology) return;
      this.colors = applySpatialContactShading(this.scene, request.draft, colors);
      this.shadedKey = request.key; this.shadedTopology = request.topology;
      this.desired = undefined;
      this.options.onShaded?.();
    }).catch(() => {
      // Keep the last valid colors; a subsequent scene change can retry the worker.
      if (this.desired?.key === request.key) this.desired = undefined;
    }).finally(() => { this.shading = false; this.scheduleShading(); });
  }

  dispose(): void {
    this.disposed = true; this.desired = undefined;
    disposeSpatialScene(this.scene); this.scene.clear(); this.entries.clear();
    this.colors = undefined; this.shadedKey = undefined; this.shadedTopology = undefined;
  }
}
