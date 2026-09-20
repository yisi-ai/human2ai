export type UiAssetOrigin = "shared" | "project";
export type UiAssetStatus = "candidate" | "experimental" | "stable" | "deprecated";
export type UiAssetCategory = string;

export const YISIUI_ASSET_SELECTOR =
  "[data-yisiui-asset][data-yisiui-name][data-yisiui-category]";
export const YISIUI_BLOCKING_LAYER_SELECTOR =
  "[aria-modal='true'], [data-yisiui-inspection-layer='blocking']";

const SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMPONENT_NAME_PATTERN = /^[A-Z][A-Za-z0-9]+$/;

export interface UiAssetMarkerInput {
  namespace: string;
  id: string;
  name: string;
  category: UiAssetCategory;
  origin: UiAssetOrigin;
  status: UiAssetStatus;
}

export interface UiAssetAttributes {
  "data-yisiui-asset": string;
  "data-yisiui-name": string;
  "data-yisiui-category": string;
  "data-yisiui-origin": UiAssetOrigin;
  "data-yisiui-status": UiAssetStatus;
}

export function isYisiUiAssetKey(value: string): boolean {
  const [namespace, id, ...rest] = value.split("/");
  return rest.length === 0
    && Boolean(namespace)
    && Boolean(id)
    && SEGMENT_PATTERN.test(namespace)
    && SEGMENT_PATTERN.test(id);
}

export function uiAssetAttributes(input: UiAssetMarkerInput): UiAssetAttributes {
  if (!SEGMENT_PATTERN.test(input.namespace)) {
    throw new Error(`Invalid YisiUI asset namespace: ${input.namespace}`);
  }
  if (!SEGMENT_PATTERN.test(input.id)) {
    throw new Error(`Invalid YisiUI asset id: ${input.id}`);
  }
  if (!COMPONENT_NAME_PATTERN.test(input.name)) {
    throw new Error(`Invalid YisiUI asset name: ${input.name}`);
  }
  if (!input.category.trim()) {
    throw new Error("YisiUI asset category must not be empty");
  }
  return {
    "data-yisiui-asset": `${input.namespace}/${input.id}`,
    "data-yisiui-name": input.name,
    "data-yisiui-category": input.category,
    "data-yisiui-origin": input.origin,
    "data-yisiui-status": input.status,
  };
}

export function uiInspectionLayerAttributes(): {
  "data-yisiui-inspection-layer": "blocking";
} {
  return { "data-yisiui-inspection-layer": "blocking" };
}

