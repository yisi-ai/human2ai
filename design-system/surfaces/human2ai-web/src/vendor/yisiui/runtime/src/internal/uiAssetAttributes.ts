import { uiAssetAttributes as createUiAssetAttributes } from "../assetMarker";
import type { UiAssetAttributes } from "../assetMarker";

const ASSET_CATEGORIES = {
  "basic-button": "button",
  "composite-button": "button",
  "copy-action": "button",
  "form-actions": "button",
  "confirm-action": "button",
  "number-badge": "number",
  "animated-number": "number",
  "border-scan": "motion",
  "text-shine": "motion",
  "tab-switch": "switching",
  "underline-tab-switch": "switching",
  "status-card": "card",
  "status-badge": "status",
  "status-light": "status",
  "aspect-ratio-selector": "module",
  "asset-skeleton-tree": "module",
  "message-composer": "module",
  "side-action-panel": "module",
} as const;

type SharedAssetId = keyof typeof ASSET_CATEGORIES;

export function uiAssetAttributes(
  id: SharedAssetId,
  name: string,
  _legacyCategory?: string,
): UiAssetAttributes {
  return createUiAssetAttributes({
    namespace: "yisiui",
    id,
    name,
    category: ASSET_CATEGORIES[id],
    origin: "shared",
    status: "experimental",
  });
}
