import type { SpatialCharacter, SpatialObject } from "./types.ts";
import { canonicalJson } from "../fingerprint.ts";

const keys = new WeakMap<SpatialCharacter | SpatialObject, { raw: string; key: string }>();

/** Authored names and instructions do not alter spatial geometry or camera output. */
export function spatialEntityRenderKey(entity: SpatialCharacter | SpatialObject) {
  const { name: _name, note: _note, ...data } = entity;
  // A cheap snapshot also detects in-place edits; reference identity alone is unsafe.
  const raw = JSON.stringify(data), previous = keys.get(entity);
  if (previous?.raw === raw) return previous.key;
  const key = canonicalJson(data);
  keys.set(entity, { raw, key });
  return key;
}
