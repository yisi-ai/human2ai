import { Group } from "three";
import { createSpatialScene, disposeSpatialScene } from "./scene.ts";
import { applySpatialContactShading, spatialSurfaces } from "./lighting.ts";
import type { SpatialDraft } from "./types.ts";

/** Editor-owned meshes; deterministic exports continue to use createSpatialScene. */
export class SpatialSceneCache {
  readonly scene = new Group();
  private entries = new Map<string, { key: string; group: Group }>();
  private shadedKey?: string;
  private shadedTopology?: string;
  private colors?: Float32Array[];

  update(draft: SpatialDraft, options: { showRig?: boolean; dragging?: boolean } = {}): boolean {
    const next = new Map<string, { key: string; group: Group }>();
    let changed = false;
    for (const entity of [...draft.characters, ...draft.objects]) {
      const key = JSON.stringify([entity, Boolean(options.showRig)]);
      let entry = this.entries.get(entity.id);
      if (entry?.key !== key) {
        if (entry) { this.scene.remove(entry.group); disposeSpatialScene(entry.group); }
        const part = "bones" in entity
          ? { ...draft, characters: [entity], objects: [] }
          : { ...draft, characters: [], objects: [entity] };
        entry = { key, group: createSpatialScene(part, options) };
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
    const surfaceKey = JSON.stringify([draft.characters, draft.objects]);
    const meshes = spatialSurfaces(this.scene);
    const topology = meshes.map(mesh => JSON.stringify([mesh.userData, mesh.geometry.getAttribute("position").count])).join("/");
    if (!this.colors || topology !== this.shadedTopology || (!options.dragging && surfaceKey !== this.shadedKey)) {
      this.colors = applySpatialContactShading(this.scene, draft);
      this.shadedKey = surfaceKey; this.shadedTopology = topology;
    } else if (changed) {
      applySpatialContactShading(this.scene, draft, this.colors);
    }
    return changed;
  }

  dispose(): void {
    disposeSpatialScene(this.scene); this.scene.clear(); this.entries.clear();
    this.colors = undefined; this.shadedKey = undefined; this.shadedTopology = undefined;
  }
}
