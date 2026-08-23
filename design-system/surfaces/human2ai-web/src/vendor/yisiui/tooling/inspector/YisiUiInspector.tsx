"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import {
  YISIUI_ASSET_SELECTOR,
  YISIUI_BLOCKING_LAYER_SELECTOR,
} from "../../runtime/src/assetMarker";

import {
  formatAssetCopyText,
  mergeRegistries,
  readMarkedAsset,
} from "./registry";
import type { InspectorRegistry, MarkedAsset } from "./registry";

interface VisibleAsset {
  element: HTMLElement;
  marker: MarkedAsset;
  instanceId: string;
  rect: DOMRect;
}

export interface YisiUiInspectorProps {
  surface: string;
  registries: InspectorRegistry[];
  enabledByDefault?: boolean;
  storageNamespace?: string;
}

const layerStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2_147_483_000,
  pointerEvents: "none",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: 11,
};

const controlStyle: CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 16,
  minHeight: 36,
  padding: "0 12px",
  color: "#F8FAFC",
  background: "#172033",
  border: "1px solid #60A5FA",
  borderRadius: 8,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.24)",
  cursor: "pointer",
  pointerEvents: "auto",
};

const copyButtonStyle: CSSProperties = {
  minHeight: 34,
  padding: "0 11px",
  color: "#F8FAFC",
  background: "#25324A",
  border: "1px solid #64748B",
  borderRadius: 7,
  cursor: "pointer",
};

function activeBlockingLayer(): HTMLElement | null {
  const layers = [...document.querySelectorAll<HTMLElement>(YISIUI_BLOCKING_LAYER_SELECTOR)]
    .filter((element) => element.getAttribute("aria-hidden") !== "true");
  return layers.at(-1) ?? null;
}

function collectAssets(): VisibleAsset[] {
  const blockingLayer = activeBlockingLayer();
  const counts = new Map<string, number>();
  return [...document.querySelectorAll<HTMLElement>(YISIUI_ASSET_SELECTOR)]
    .filter((element) => !element.closest("[data-yisiui-inspector-root]"))
    .filter((element) => !blockingLayer || blockingLayer.contains(element))
    .map((element): VisibleAsset | null => {
      const marker = readMarkedAsset(element);
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (
        !marker
        || rect.width <= 0
        || rect.height <= 0
        || style.display === "none"
        || style.visibility === "hidden"
      ) {
        return null;
      }
      const occurrence = (counts.get(marker.key) ?? 0) + 1;
      counts.set(marker.key, occurrence);
      return {
        element,
        marker,
        instanceId: `${marker.id}#${String(occurrence).padStart(2, "0")}`,
        rect,
      };
    })
    .filter((asset): asset is VisibleAsset => asset !== null);
}

function InspectorRuntime({
  surface,
  registries,
  enabledByDefault = false,
  storageNamespace = surface,
}: YisiUiInspectorProps) {
  const storageKey = `yisiui:inspector:${storageNamespace}:enabled`;
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(enabledByDefault);
  const [assets, setAssets] = useState<VisibleAsset[]>([]);
  const [hovered, setHovered] = useState<VisibleAsset | null>(null);
  const registry = useMemo(() => mergeRegistries(registries), [registries]);

  const refresh = useCallback(() => {
    setAssets(collectAssets());
  }, []);

  useEffect(() => {
    setMounted(true);
    try {
      setEnabled(window.localStorage.getItem(storageKey) === "enabled" || enabledByDefault);
    } catch {
      setEnabled(enabledByDefault);
    }
  }, [enabledByDefault, storageKey]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    try {
      window.localStorage.setItem(storageKey, enabled ? "enabled" : "disabled");
    } catch {
      // Persistence is optional; the inspector remains usable for this page load.
    }
  }, [enabled, mounted, storageKey]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "u") {
        event.preventDefault();
        setEnabled((current) => !current);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAssets([]);
      setHovered(null);
      return;
    }
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    const onPointerMove = (event: PointerEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>(YISIUI_ASSET_SELECTOR)
        : null;
      setHovered(target ? collectAssets().find((asset) => asset.element === target) ?? null : null);
    };
    document.addEventListener("pointermove", onPointerMove, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
      document.removeEventListener("pointermove", onPointerMove, true);
    };
  }, [enabled, refresh]);

  const copyHovered = useCallback(async () => {
    if (!hovered) {
      return;
    }
    await navigator.clipboard.writeText(formatAssetCopyText({
      surface,
      page: `${window.location.pathname}${window.location.search}${window.location.hash}` || "/",
      instanceId: hovered.instanceId,
      marker: hovered.marker,
      registryAsset: registry.get(hovered.marker.key),
    }));
  }, [hovered, registry, surface]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div data-yisiui-inspector-root style={layerStyle}>
      {enabled ? assets.map((asset) => {
        const isHovered = hovered?.element === asset.element;
        return (
          <div
            key={`${asset.marker.key}:${asset.instanceId}`}
            style={{
              position: "fixed",
              left: Math.max(0, asset.rect.left),
              top: Math.max(0, asset.rect.top),
              width: asset.rect.width,
              height: asset.rect.height,
              border: `${isHovered ? 3 : 2}px solid ${asset.marker.origin === "shared" ? "#22C55E" : "#F59E0B"}`,
              boxSizing: "border-box",
              pointerEvents: "none",
            }}
          >
            <span style={{
              position: "absolute",
              left: -2,
              top: -22,
              maxWidth: 320,
              padding: "2px 6px",
              overflow: "hidden",
              color: "#FFFFFF",
              background: asset.marker.origin === "shared" ? "#15803D" : "#B45309",
              borderRadius: "6px 6px 6px 0",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {asset.instanceId} · {asset.marker.name}
            </span>
          </div>
        );
      }) : null}

      {enabled && hovered ? (
        <aside style={{
          position: "fixed",
          right: 16,
          bottom: 64,
          width: "min(420px, calc(100vw - 32px))",
          padding: 12,
          color: "#E2E8F0",
          background: "#172033",
          border: "1px solid #475569",
          borderRadius: 8,
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.24)",
          pointerEvents: "auto",
        }}>
          <strong>{hovered.instanceId} · {hovered.marker.name}</strong>
          <pre style={{ margin: "8px 0", whiteSpace: "pre-wrap" }}>
            {formatAssetCopyText({
              surface,
              page: `${window.location.pathname}${window.location.search}${window.location.hash}` || "/",
              instanceId: hovered.instanceId,
              marker: hovered.marker,
              registryAsset: registry.get(hovered.marker.key),
            })}
          </pre>
          <button type="button" style={copyButtonStyle} onClick={() => void copyHovered()}>
            复制资产信息
          </button>
        </aside>
      ) : null}

      <button
        type="button"
        style={controlStyle}
        aria-pressed={enabled}
        title="切换 YisiUI 资产标注；快捷键 Ctrl/⌘ + Shift + U"
        onClick={() => setEnabled((current) => !current)}
      >
        {enabled ? `关闭 UI 标注 · ${assets.length}` : "UI 资产"}
      </button>
    </div>,
    document.body,
  );
}

export function YisiUiInspector(props: YisiUiInspectorProps) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }
  return <InspectorRuntime {...props} />;
}
