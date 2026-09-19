import { uiAssetAttributes as createUiAssetAttributes } from "../assetMarker";
import type { UiAssetAttributes } from "../assetMarker";

const ASSET_CATEGORIES = {
  "basic-button": "button",
  "action-button": "button",
  "composite-button": "button",
  "confirm-action": "button",
  "number-badge": "number",
  "animated-number": "number",
  "border-scan": "motion",
  "text-shine": "motion",
  "tab-switch": "switching",
  "underline-tab-switch": "switching",
  "status-card": "card",
  "image-title-card": "card",
  "decorative-title": "typography",
  "animated-icon": "icon",
  "status-badge": "status",
  "status-light": "status",
  "loading-state": "status",
  "aspect-ratio-selector": "module",
  "model-selector": "module",
  "asset-skeleton-tree": "module",
  "message-composer": "module",
  "text-mark-editor": "module",
  "side-action-panel": "module",
  "section-navigation-panel": "module",
  "app-shell-frame": "layout",
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
