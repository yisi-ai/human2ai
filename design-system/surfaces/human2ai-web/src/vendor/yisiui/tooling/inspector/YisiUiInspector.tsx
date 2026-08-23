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
import type {
  InspectorCopyMode,
  InspectorRegistry,
  MarkedAsset,
} from "./registry";
import { useDraggableInspectorControls } from "./useDraggableInspectorControls";

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

const controlContainerStyle: CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 16,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  pointerEvents: "auto",
};

const optionsStyle: CSSProperties = {
  display: "grid",
  minWidth: 220,
  padding: "10px 12px",
  color: "#E2E8F0",
  background: "#172033",
  border: "1px solid #475569",
  borderRadius: 8,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.24)",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  fontSize: 12,
};

const optionRowStyle: CSSProperties = {
  display: "flex",
  minHeight: 32,
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const toggleButtonStyle: CSSProperties = {
  minHeight: 36,
  padding: "0 12px",
  color: "#F8FAFC",
  background: "#172033",
  border: "1px solid #60A5FA",
  borderRadius: 8,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.24)",
  cursor: "grab",
  pointerEvents: "auto",
  touchAction: "none",
  userSelect: "none",
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

const copyModeGroupStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 2,
  marginTop: 4,
  padding: 2,
  background: "#0F172A",
  borderRadius: 7,
};

const feedbackStyle: CSSProperties = {
  display: "block",
  marginTop: 6,
  color: "#94A3B8",
  lineHeight: 1.4,
  textAlign: "center",
};

interface InspectorSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function InspectorSwitch({ label, checked, onChange }: InspectorSwitchProps) {
  return (
    <div style={optionRowStyle}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        style={{
          position: "relative",
          width: 32,
          height: 18,
          padding: 0,
          background: checked ? "#2563EB" : "#475569",
          border: 0,
          borderRadius: 999,
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 16 : 2,
            width: 14,
            height: 14,
            background: "#FFFFFF",
            borderRadius: "50%",
          }}
        />
      </button>
    </div>
  );
}

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
  const storagePrefix = `yisiui:inspector:${storageNamespace}`;
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(enabledByDefault);
  const [showAllNames, setShowAllNames] = useState(false);
  const [showAssetInfo, setShowAssetInfo] = useState(true);
  const [copyMode, setCopyMode] = useState<InspectorCopyMode>("page");
  const [copyStatus, setCopyStatus] = useState("");
  const [assets, setAssets] = useState<VisibleAsset[]>([]);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const registry = useMemo(() => mergeRegistries(registries), [registries]);
  const hovered = useMemo(
    () => assets.find((asset) => asset.element === hoveredElement) ?? null,
    [assets, hoveredElement],
  );
  const {
    controlsRef,
    controlsStyle,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerEnd,
    shouldSuppressToggleClick,
  } = useDraggableInspectorControls(mounted, enabled);

  const refresh = useCallback(() => {
    const nextAssets = collectAssets();
    setAssets(nextAssets);
    setHoveredElement((current) => (
      current && nextAssets.some((asset) => asset.element === current) ? current : null
    ));
  }, []);

  useEffect(() => {
    setMounted(true);
    try {
      const storedEnabled = window.localStorage.getItem(`${storagePrefix}:enabled`);
      setEnabled(storedEnabled === null ? enabledByDefault : storedEnabled === "enabled");
      setShowAllNames(window.localStorage.getItem(`${storagePrefix}:show-names`) === "enabled");
      setShowAssetInfo(window.localStorage.getItem(`${storagePrefix}:show-info`) !== "disabled");
      setCopyMode(window.localStorage.getItem(`${storagePrefix}:copy-mode`) === "name" ? "name" : "page");
    } catch {
      setEnabled(enabledByDefault);
      setShowAllNames(false);
      setShowAssetInfo(true);
      setCopyMode("page");
    }
  }, [enabledByDefault, storagePrefix]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    try {
      window.localStorage.setItem(`${storagePrefix}:enabled`, enabled ? "enabled" : "disabled");
      window.localStorage.setItem(`${storagePrefix}:show-names`, showAllNames ? "enabled" : "disabled");
      window.localStorage.setItem(`${storagePrefix}:show-info`, showAssetInfo ? "enabled" : "disabled");
      window.localStorage.setItem(`${storagePrefix}:copy-mode`, copyMode);
    } catch {
      // Persistence is optional; the inspector remains usable for this page load.
    }
  }, [copyMode, enabled, mounted, showAllNames, showAssetInfo, storagePrefix]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey)
        && event.shiftKey
        && event.key.toLowerCase() === "u"
        && !event.repeat
      ) {
        event.preventDefault();
        setCopyStatus("");
        setEnabled((current) => !current);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAssets([]);
      setHoveredElement(null);
      setCopyStatus("");
      return;
    }
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    const onPointerMove = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-yisiui-inspector-root]")) {
        return;
      }
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>(YISIUI_ASSET_SELECTOR)
        : null;
      setHoveredElement(target);
    };
    document.addEventListener("pointermove", onPointerMove, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
      document.removeEventListener("pointermove", onPointerMove, true);
    };
  }, [enabled, refresh]);

  useEffect(() => {
    setCopyStatus("");
  }, [copyMode, hoveredElement]);

  const copyHovered = useCallback(async (): Promise<void> => {
    if (!hovered) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(formatAssetCopyText({
        mode: copyMode,
        surface,
        page: `${window.location.pathname}${window.location.search}${window.location.hash}` || "/",
        instanceId: hovered.instanceId,
        marker: hovered.marker,
        registryAsset: registry.get(hovered.marker.key),
      }));
      setCopyStatus(copyMode === "name" ? "已复制名字信息" : "已复制页面信息");
    } catch (error) {
      setCopyStatus(error instanceof Error ? `复制失败：${error.message}` : "复制失败");
    }
  }, [copyMode, hovered, registry, surface]);

  useEffect(() => {
    const onCopyShortcut = (event: KeyboardEvent): void => {
      if (
        !enabled
        || !hovered
        || !(event.ctrlKey || event.metaKey)
        || !event.altKey
        || event.shiftKey
        || event.key.toLowerCase() !== "c"
        || event.repeat
      ) {
        return;
      }
      event.preventDefault();
      void copyHovered();
    };
    window.addEventListener("keydown", onCopyShortcut);
    return () => window.removeEventListener("keydown", onCopyShortcut);
  }, [copyHovered, enabled, hovered]);

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
            data-yisiui-inspector-outline={asset.marker.key}
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
            {showAllNames || isHovered ? (
              <span
                data-yisiui-inspector-label={asset.marker.key}
                style={{
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
                }}
              >
                {asset.instanceId} · {asset.marker.name}
              </span>
            ) : null}
          </div>
        );
      }) : null}

      {enabled && showAssetInfo && hovered ? (
        <aside
          aria-label="UI 资产详情"
          style={{
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
          }}
        >
          <strong>{hovered.instanceId} · {hovered.marker.name}</strong>
          <pre style={{ margin: "8px 0", overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
            {formatAssetCopyText({
              mode: "page",
              surface,
              page: `${window.location.pathname}${window.location.search}${window.location.hash}` || "/",
              instanceId: hovered.instanceId,
              marker: hovered.marker,
              registryAsset: registry.get(hovered.marker.key),
            })}
          </pre>
          <button type="button" style={copyButtonStyle} onClick={() => void copyHovered()}>
            {copyMode === "name" ? "复制名字信息" : "复制页面信息"}
          </button>
        </aside>
      ) : null}

      <div
        ref={controlsRef}
        data-yisiui-inspector-controls
        style={{ ...controlContainerStyle, ...controlsStyle }}
      >
        {enabled ? (
          <div style={optionsStyle} role="group" aria-label="UI 资产显示选项">
            <InspectorSwitch
              label="显示全部资产名称"
              checked={showAllNames}
              onChange={setShowAllNames}
            />
            <InspectorSwitch
              label="显示悬停资产详情"
              checked={showAssetInfo}
              onChange={(checked) => {
                setCopyStatus("");
                setShowAssetInfo(checked);
              }}
            />
            <div style={{ marginTop: 6 }}>
              <span>复制内容</span>
              <div style={copyModeGroupStyle} role="group" aria-label="复制资产信息模式">
                {(["name", "page"] as const).map((mode) => {
                  const selected = copyMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setCopyMode(mode)}
                      style={{
                        minHeight: 28,
                        color: selected ? "#FFFFFF" : "#94A3B8",
                        background: selected ? "#334155" : "transparent",
                        border: 0,
                        borderRadius: 5,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      {mode === "name" ? "名字信息" : "页面信息"}
                    </button>
                  );
                })}
              </div>
            </div>
            <span style={feedbackStyle}>悬停资产后按 Ctrl/⌘ + Alt + C</span>
            {copyStatus ? (
              <span style={feedbackStyle} role="status" aria-live="polite">{copyStatus}</span>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          style={{ ...toggleButtonStyle, cursor: isDragging ? "grabbing" : "grab" }}
          aria-pressed={enabled}
          title="点击切换 YisiUI 资产标注；拖动可移动位置；快捷键 Ctrl/⌘ + Shift + U"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClick={() => {
            if (!shouldSuppressToggleClick()) {
              setCopyStatus("");
              setEnabled((current) => !current);
            }
          }}
        >
          {enabled ? `关闭 UI 标注 · ${assets.length}` : "UI 资产"}
        </button>
      </div>
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
