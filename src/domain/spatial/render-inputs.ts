import type { SpatialCharacter, SpatialObject } from "./types.ts";
import { canonicalJson } from "../fingerprint.ts";

/** Authored names and instructions do not alter spatial geometry or camera output. */
export function spatialEntityRenderKey({ name: _name, note: _note, ...data }: SpatialCharacter | SpatialObject) {
  return canonicalJson(data);
}
