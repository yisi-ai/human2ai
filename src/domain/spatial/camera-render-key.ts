import { Box3, Frustum, Matrix4 } from "three";
import { createOutputCamera, createSpatialScene, disposeSpatialScene } from "./scene.ts";
import { spatialEntityRenderKey } from "./render-inputs.ts";
import { entityMatrix } from "./scene-update.ts";
import { canonicalJson } from "../fingerprint.ts";
import type { SpatialCamera, SpatialDraft, SpatialRenderPass } from "./types.ts";

/** Conservative image dependencies, shared by browser previews and server PNG caches. */
export class SpatialCameraRenderKeys {
  private bounds = new Map<string, Box3>();
  private snapshot?: { key: string; bounds: Box3[] };

  key(draft: SpatialDraft, source: SpatialCamera, pass: SpatialRenderPass = "color", camera = createOutputCamera(source)): string {
    const entities = pass === "skeleton" ? draft.characters : [...draft.characters, ...draft.objects];
    const keys = entities.map(spatialEntityRenderKey);
    let relevant = keys;
    // The fitted shadow map depends on ALL surfaces, including off-camera casters.
    // Skeletons have their own projected head silhouettes; retain all characters.
    if (pass !== "skeleton" && !(pass === "color" && draft.lightingEnabled)) {
      const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const snapshotKey = JSON.stringify(keys);
      if (this.snapshot?.key !== snapshotKey) {
        const bounds = entities.map(entity => {
          const { name: _name, note: _note, ...data } = entity;
          const local = { ...data, name: "", position: [0,0,0] as [number,number,number], rotation: [0,0,0] as [number,number,number], color: "#ffffff" };
          const key = canonicalJson(local);
          let box = this.bounds.get(key);
          if (!box) {
            const scene = createSpatialScene({ ...draft, characters: "bones" in local ? [local] : [], objects: "bones" in local ? [] : [local] });
            try { box = new Box3().setFromObject(scene, true); }
            finally { disposeSpatialScene(scene); }
            this.bounds.set(key, box);
            if (this.bounds.size > 256) this.bounds.delete(this.bounds.keys().next().value!);
          }
          const world = box.clone().applyMatrix4(entityMatrix(entity));
          // Canonical skin vertices are rounded to Float32 after world transforms.
          // Include that rounding, including at large authored coordinates.
          const extent = Math.max(...world.min.toArray().map(Math.abs), ...world.max.toArray().map(Math.abs));
          return world.expandByScalar(Math.max(.00001, extent * 2 ** -21));
        });
        this.snapshot = { key: snapshotKey, bounds };
      }
      const bounds = this.snapshot.bounds;
      const visible = bounds.map(box => frustum.intersectsBox(box));
      // Vertex contact rays may extend past the frustum. Include neighbors of the
      // entire visible entity, since its vertex colors interpolate across triangles.
      const receivers = pass === "color" ? bounds.flatMap((box, i) => {
        if (!visible[i]) return [];
        const entity = entities[i];
        const radius = ("bones" in entity ? entity.height : Math.max(...entity.size)) * .025;
        return [box.clone().expandByScalar(radius * 1.026 + .00001)];
      }) : [];
      relevant = keys.filter((_, i) => visible[i] || receivers.some(box => box.intersectsBox(bounds[i])));
    }
    return JSON.stringify(["spatial-image-1", draft.version, pass, source.position, source.target, source.projection,
      source.fov, source.span, source.width, source.height, source.background,
      camera.projectionMatrix.elements, camera.matrixWorldInverse.elements, pass === "color" && Boolean(draft.lightingEnabled), relevant]);
  }
}
