"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Input, Modal } from "antd";
import { InfiniteCanvasViewport } from "@human2ai/ui";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { useTranslation } from "react-i18next";
import type { UiSketchImage } from "../../src/domain/ui-sketch/types";
import type { PngSplitBatch, PngSplitOptions, PngSplitPreview } from "../../src/domain/ui-sketch/png-split";
import { Human2AiApiError, imageAssetContentUrl, preparePngSplit, previewPngSplit } from "../lib/human2ai-api";
import { isValidPngSplitOptions, readPngSplitOptions, savePngSplitOptions } from "../lib/png-split-settings";
import type { PngSplitRegion } from "../../src/domain/ui-sketch/png-split-regions";
import { PngSplitRegionEditor } from "./PngSplitRegionEditor";
import styles from "./UiSketchPngSplitDialog.module.css";

export function UiSketchPngSplitDialog({ sessionId, images, mode, options, resolveImageSource, onSplit, onApply, onError, onCancel }: {
  sessionId: string;
  images: UiSketchImage[];
  mode: "split" | "settings";
  options: PngSplitOptions;
  resolveImageSource?(image: UiSketchImage): string;
  onSplit(options: PngSplitOptions): void;
  onApply(batch: PngSplitBatch): void;
  onError(message: string, keepOpen?: boolean): void;
  onCancel(): void;
}) {
  const { t } = useTranslation();
  const fieldId = useId();
  const [fields, setFields] = useState(() => {
    const saved = readPngSplitOptions(options);
    return { alphaThreshold: String(saved.alphaThreshold), minSize: String(saved.minSize), gap: String(saved.gap) };
  });
  const [previewState, setPreviewState] = useState<{ key: string; data?: PngSplitPreview; error?: string }>();
  const [retry, setRetry] = useState(0);
  const [regions, setRegions] = useState<PngSplitRegion[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [splitError, setSplitError] = useState<string>();
  const [toolsHost, setToolsHost] = useState<HTMLDivElement | null>(null);
  const sources = useMemo(() => images.map(image => ({ nodeId: image.id, assetId: image.assetId!,
    ...(regions.length ? { regions } : {}) })), [images, regions]);
  const composing = useRef(false);
  const callbacks = useRef({ onApply, onError }); callbacks.current = { onApply, onError };
  const prepared = useRef<{ sessionId: string; sources: typeof sources; options: PngSplitOptions; result: Promise<PngSplitBatch> } | null>(null);
  useLayoutEffect(() => {
    if (mode !== "split") return;
    let active = true;
    setSplitError(undefined);
    // Reuse preparation across Strict Mode effect replay; invalidate for every request dependency.
    if (!prepared.current || prepared.current.sessionId !== sessionId || prepared.current.sources !== sources || prepared.current.options !== options) {
      prepared.current = { sessionId, sources, options, result: preparePngSplit(sessionId, sources, options) };
    }
    void prepared.current.result.then(batch => { if (active) callbacks.current.onApply(batch); }).catch(error => {
      if (!active) return;
      const key = error instanceof Human2AiApiError && error.code === "INVALID_IMAGE_ASSET" ? "uiSketch.pngSplit.invalid" : "uiSketch.pngSplit.failed";
      if (sources.some(source => source.regions?.length)) setSplitError(key);
      callbacks.current.onError(t(key), sources.some(source => source.regions?.length));
    });
    return () => { active = false; };
  }, [sessionId, sources, mode, options, t]);
  const edited: PngSplitOptions = { alphaThreshold: Number(fields.alphaThreshold), minSize: Number(fields.minSize), gap: Number(fields.gap) };
  const valid = Object.values(fields).every(value => value.trim() !== "") && isValidPngSplitOptions(edited);
  function updateField(key: keyof PngSplitOptions, value: string, persist: boolean): void {
    const next = { ...fields, [key]: value };
    setFields(next);
    const nextOptions = { alphaThreshold: Number(next.alphaThreshold), minSize: Number(next.minSize), gap: Number(next.gap) };
    if (persist && Object.values(next).every(value => value.trim() !== "") && isValidPngSplitOptions(nextOptions)) {
      savePngSplitOptions(nextOptions);
    }
  }
  const previewKey = JSON.stringify([sessionId, sources, edited.alphaThreshold, edited.minSize]);
  const preview = valid && previewState?.key === previewKey ? previewState : undefined;
  useEffect(() => {
    if (mode !== "settings" || !valid) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void previewPngSplit(sessionId, sources,
        { alphaThreshold: edited.alphaThreshold, minSize: edited.minSize, gap: 0 }, controller.signal)
        .then(data => { if (!controller.signal.aborted) setPreviewState({ key: previewKey, data }); })
        .catch(error => {
          if (!controller.signal.aborted) setPreviewState({ key: previewKey, error: error instanceof Human2AiApiError && error.code === "INVALID_IMAGE_ASSET"
            ? "uiSketch.pngSplit.invalid" : "uiSketch.pngSplit.previewFailed" });
        });
    }, 120);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [sessionId, sources, mode, valid, edited.alphaThreshold, edited.minSize, previewKey, retry]);
  if (mode === "split") return null;
  return <Modal open centered title={t("uiSketch.pngSplit.settings")} width="min(1280px, calc(100vw - 64px))" onCancel={onCancel}
    okText={t("uiSketch.pngSplit.applySettings")} footer={(_origin, { OkBtn }) => <OkBtn />}
    okButtonProps={{ disabled: drawing || !valid || !preview?.data }} onOk={() => { if (!drawing && valid && preview?.data && !composing.current) onSplit(edited); }}>
    <div className={styles.layout}>
      <section className={styles.previews} aria-label={t("uiSketch.pngSplit.preview")} aria-busy={valid && !preview} data-png-split-preview>
        {images.map(image => {
          const source = preview?.data?.sources.find(source => source.nodeId === image.id);
          const src = resolveImageSource?.(image) ?? imageAssetContentUrl(sessionId, image.assetId!);
          return <PngSplitImagePreview key={`${image.id}:${src}`} src={src} source={source}
            regions={regions} onRegionsChange={setRegions} onDrawingChange={setDrawing} toolsHost={toolsHost} />;
        })}
      </section>
      <div className={styles.parameters} data-png-split-parameters>
      <div ref={setToolsHost} />
      {(["alphaThreshold", "minSize", "gap"] as const).map(key => <label key={key} className={styles.field}>
        <span>{t(`uiSketch.pngSplit.${key}`)}</span>
        <Input type="number" aria-label={t(`uiSketch.pngSplit.${key}`)} value={fields[key]} min={0}
          aria-describedby={key === "alphaThreshold" ? undefined : `${fieldId}-${key}-unit`}
          suffix={key === "alphaThreshold" ? undefined : <span id={`${fieldId}-${key}-unit`}>{t("units.pixels")}</span>}
          max={key === "alphaThreshold" ? 254 : key === "minSize" ? Number.MAX_SAFE_INTEGER : undefined}
          step={key === "gap" ? "any" : 1}
          onCompositionStart={() => { composing.current = true; }} onCompositionEnd={event => {
            composing.current = false; updateField(key, event.currentTarget.value, true);
          }}
          onChange={event => updateField(key, event.target.value, !composing.current)} />
      </label>)}
      {splitError && <div role="alert" className={styles.error}>{t(splitError)}</div>}
      {preview?.error ? <div role="alert" className={styles.error}>
        {t(preview.error)} <BasicButton size="small" onClick={() => { setPreviewState(undefined); setRetry(value => value + 1); }}>{t("actions.retry")}</BasicButton>
      </div> : valid && <div role="status" className={styles.status}>
        {preview?.data ? t("uiSketch.pngSplit.previewSummary", {
          count: preview.data.sources.reduce<number>((sum, source) => sum + source.rects.length, 0),
          discarded: preview.data.sources.reduce<number>((sum, source) => sum + source.discarded, 0),
        }) : t("uiSketch.pngSplit.previewing")}
      </div>}
      </div>
    </div>
  </Modal>;
}

function PngSplitImagePreview({ src, source, regions, onRegionsChange, onDrawingChange, toolsHost }: {
  src: string; source?: PngSplitPreview["sources"][number]; regions: PngSplitRegion[];
  onRegionsChange(regions: PngSplitRegion[]): void; onDrawingChange(drawing: boolean): void;
  toolsHost: HTMLDivElement | null;
}) {
  const { t } = useTranslation();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const bounds = { x: 0, y: 0, ...size };
  // Keep range elements outside the viewport render callback: zoom only changes their viewBox.
  const ranges = source?.rects.map(([x, y, width, height], index) =>
    <rect key={index} x={x} y={y} width={width} height={height} className={styles.bounds} vectorEffect="non-scaling-stroke" data-png-split-bound />);
  return <div className={styles.image} data-png-split-image>
    <InfiniteCanvasViewport backgroundPattern="none" minimumZoom={0.01} maximumZoom={16}
      contentBounds={bounds} fitRequest={size.width > 0 ? { id: 1, bounds } : undefined}
      aria-label={t("uiSketch.pngSplit.preview")}
      labels={{ zoomIn: t("uiSketch.pngSplit.zoomIn"), zoomOut: t("uiSketch.pngSplit.zoomOut"),
        currentZoom: t("composition.canvasZoom"), fitAll: t("composition.fitAll"),
        help: t("uiSketch.pngSplit.help"), interactionHelp: t("uiSketch.pngSplit.interactionHelp") }}>
      {view => {
        const { zoom, viewportBounds, worldToScreen } = view;
        const origin = worldToScreen({ x: 0, y: 0 });
        return <>
          <img src={src} alt="" draggable={false} style={{ width: size.width * zoom, height: size.height * zoom,
            transform: `translate(${origin.x}px, ${origin.y}px)` }}
            onLoad={event => {
              const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
              setSize(current => current.width === width && current.height === height ? current : { width, height });
            }} />
          <svg className={styles.boundsOverlay} viewBox={`${viewportBounds.x} ${viewportBounds.y} ${viewportBounds.width} ${viewportBounds.height}`}
            aria-hidden="true" data-png-split-source={source?.nodeId}>{ranges}</svg>
          <PngSplitRegionEditor view={view} regions={regions} onRegionsChange={onRegionsChange}
            onDrawingChange={onDrawingChange} ready={size.width > 0} toolsHost={toolsHost} />
        </>;
      }}
    </InfiniteCanvasViewport>
  </div>;
}
