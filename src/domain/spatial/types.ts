export type Vec3 = [number, number, number];
export type SpatialBodyType = "male" | "female";
export type SpatialAppearance = "quaternius" | "geometric";
import type { SpatialFinger } from "./hands.ts";
/** Actor-wide factors relative to the head-count profile; omitted means 1. */
export interface SpatialBodyShape {
  neckLength?: number;
  palmSize?: number;
  fingerLength?: number;
  footSize?: number;
}
export interface SpatialJoint {
  id: string;
  name: string;
  parentId: string | null;
  /** Anatomical rest offset; head-count width is applied before bone rotation. */
  offset: Vec3;
  lockPosition: boolean;
  radius: number;
  terminal: boolean;
}
export interface SpatialBone {
  id: string;
  name: string;
  startJointId: string;
  endJointId: string;
  rotation: Vec3;
  restRotation: Vec3;
  limits: { min: Vec3; max: Vec3 };
  lockRotation: boolean;
  /** Original body segment whose mesh module is used, also on cloned limbs. */
  modelPart: string;
}
export interface SpatialCharacter extends SpatialBodyShape {
  id: string;
  name: string;
  kind: "humanoid" | "custom";
  position: Vec3;
  rotation: Vec3;
  height: number;
  headRatio: number;
  /** Quaternius anatomical mesh; omitted selects the male source. */
  bodyType?: SpatialBodyType;
  /** Marks the one-time correction of default thumb limits; preserves explicit bounds. */
  thumbLimitsVersion?: 2;
  /** Torso share of head-excluded rest height; omitted means the model default. */
  torsoRatio?: number;
  color: string;
  joints: SpatialJoint[];
  bones: SpatialBone[];
  appearance: SpatialAppearance;
}
export interface SpatialObject {
  id: string;
  name: string;
  kind: "box" | "sphere" | "plane";
  position: Vec3;
  rotation: Vec3;
  size: Vec3;
  color: string;
}
export interface SpatialCamera {
  id: string;
  name: string;
  position: Vec3;
  target: Vec3;
  projection: "perspective" | "orthographic";
  fov: number;
  span: number;
  width: number;
  height: number;
  background: string | null;
}
export interface SpatialDraft {
  version: 2;
  kind: "spatial-draft";
  /** Scene-wide directional lighting and shadows; omitted means evenly lit. */
  lightingEnabled?: boolean;
  characters: SpatialCharacter[];
  objects: SpatialObject[];
  cameras: SpatialCamera[];
  cameraBoxes?: SpatialCameraBox[];
}
export interface SpatialCameraBox {
  id: string;
  name: string;
  position: Vec3;
  rotation: Vec3;
  /** Cubic crop edge length in metres. */
  size: number;
  resolution: number;
}
export const SPATIAL_BOX_FACES = ["front", "back", "left", "right", "top", "bottom"] as const;
export type SpatialBoxFace = typeof SPATIAL_BOX_FACES[number];
export type SpatialBoxView = SpatialBoxFace | "sheet";
export const SPATIAL_BOX_LABEL_HEIGHT = 28;
export const SPATIAL_BOX_GAP = 12;
export type SpatialOperation =
  | { type: "set-lighting"; enabled: boolean }
  | ({ type: "add-character"; id: string; name: string; height?: number; headRatio?: number; torsoRatio?: number; bodyType?: SpatialBodyType; appearance?: SpatialAppearance } & SpatialBodyShape)
  | { type: "put-character"; character: SpatialCharacter }
  | { type: "add-limb"; characterId: string; sourceJointId: string; parentId: string; idPrefix: string; offset: Vec3 }
  | ({ type: "set-proportions"; characterId: string; height: number; headRatio: number; torsoRatio?: number; bodyType?: SpatialBodyType } & SpatialBodyShape)
  | { type: "move-joint"; characterId: string; jointId: string; position: Vec3 }
  | { type: "rotate-bone"; characterId: string; boneId: string; rotation: Vec3 }
  | { type: "lock-bone"; characterId: string; boneId: string; rotation: boolean }
  | { type: "set-bone-limits"; characterId: string; boneId: string; limits: SpatialBone["limits"] }
  | { type: "reset-pose"; characterId: string }
  | { type: "pose-hand"; characterId: string; handBoneId: string; curl?: Partial<Record<SpatialFinger, number>>; spread?: number; thumbOpposition?: number }
  | { type: "reset-hand"; characterId: string; handBoneId: string }
  | { type: "lock-joint"; characterId: string; jointId: string; position: boolean }
  | { type: "put-object"; object: SpatialObject }
  | { type: "put-camera"; camera: SpatialCamera }
  | { type: "put-camera-box"; box: SpatialCameraBox }
  | { type: "fit-camera-box"; id: string; region: "scene" | "hands" }
  | { type: "remove"; id: string };
export const SPATIAL_RENDER_PASSES = ["color", "structure", "depth", "skeleton"] as const;
export type SpatialRenderPass = typeof SPATIAL_RENDER_PASSES[number];
