import { isYisiUiAssetKey } from "../../runtime/src/assetMarker";

export interface InspectorAsset {
  id: string;
  name: string;
  category: string;
  status: string;
  source: string;
  storyId?: string;
  aliases?: string[];
  distribution?: string;
  release?: string;
  ownerRepository?: string;
}

export interface InspectorRegistry {
  namespace: string;
  surface: string;
  assets: InspectorAsset[];
}

export interface MarkedAsset {
  key: string;
  id: string;
  namespace: string;
  name: string;
  category: string;
  origin: string;
  status: string;
}

export type InspectorCopyMode = "name" | "page";

export function mergeRegistries(
  registries: InspectorRegistry[],
): ReadonlyMap<string, InspectorAsset & { namespace: string }> {
  const merged = new Map<string, InspectorAsset & { namespace: string }>();
  for (const registry of registries) {
    for (const asset of registry.assets) {
      const key = `${registry.namespace}/${asset.id}`;
      if (!isYisiUiAssetKey(key)) {
        throw new Error(`Invalid asset key in inspector registry: ${key}`);
      }
      if (merged.has(key)) {
        throw new Error(`Duplicate asset key in inspector registries: ${key}`);
      }
      merged.set(key, { ...asset, namespace: registry.namespace });
    }
  }
  return merged;
}

export function readMarkedAsset(element: HTMLElement): MarkedAsset | null {
  const key = element.dataset.yisiuiAsset;
  const name = element.dataset.yisiuiName;
  const category = element.dataset.yisiuiCategory;
  if (!key || !name || !category || !isYisiUiAssetKey(key)) {
    return null;
  }
  const [namespace, id] = key.split("/");
  return {
    key,
    id,
    namespace,
    name,
    category,
    origin: element.dataset.yisiuiOrigin ?? "project",
    status: element.dataset.yisiuiStatus ?? "candidate",
  };
}

interface CopyDetails {
  mode?: InspectorCopyMode;
  surface: string;
  page: string;
  instanceId: string;
  marker: MarkedAsset;
  registryAsset?: InspectorAsset & { namespace: string };
}

export function formatAssetCopyText(details: CopyDetails): string {
  const asset = details.registryAsset;
  if (details.mode === "name") {
    return [
      `Category: ${asset?.category ?? details.marker.category}`,
      `Name: ${asset?.name ?? details.marker.name}`,
      `Asset: ${details.marker.key}`,
    ].join("\n");
  }
  return [
    `Surface: ${details.surface}`,
    `Asset: ${details.marker.key}`,
    `Instance: ${details.instanceId}`,
    `Owner: ${asset?.ownerRepository ?? details.marker.origin}`,
    `Distribution: ${asset?.distribution ?? "project-local"}${asset?.release ? `@${asset.release}` : ""}`,
    `Story: ${asset?.storyId ?? "unregistered"}`,
    `Source: ${asset?.source ?? "registry-missing"}`,
    `Page: ${details.page}`,
  ].join("\n");
}
