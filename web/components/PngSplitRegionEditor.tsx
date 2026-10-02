"use client";

import { DeleteOutlined, NodeIndexOutlined } from "@ant-design/icons";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import type { InfiniteCanvasRenderState } from "@human2ai/ui";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { isValidPngSplitRegion, MAX_PNG_SPLIT_POINTS, MAX_PNG_SPLIT_REGIONS,
  type PngSplitPoint, type PngSplitRegion } from "../../src/domain/ui-sketch/png-split-regions";
import styles from "./UiSketchPngSplitDialog.module.css";

export function PngSplitRegionEditor({ view, regions, onRegionsChange, onDrawingChange, ready, toolsHost }: {
  view: InfiniteCanvasRenderState; regions: PngSplitRegion[]; ready: boolean;
  onRegionsChange(regions: PngSplitRegion[]): void; onDrawingChange(drawing: boolean): void;
  toolsHost: HTMLDivElement | null;
}) {
  const { t } = useTranslation();
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<PngSplitRegion>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const guide = useRef<SVGPathElement>(null);
  const start = useRef<SVGCircleElement>(null);
  const frame = useRef(0);
  const cursor = useRef<{ x: number; y: number } | null>(null);
  const latest = useRef({ view, draft, drawing }); latest.current = { view, draft, drawing };
  const canClose = isValidPngSplitRegion(draft);
  const { viewportBounds, zoom } = view;
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function pointAt(clientX: number, clientY: number): PngSplitPoint {
    const point = new DOMPoint(clientX, clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return [point.x, point.y];
  }
  function nearStart(point: PngSplitPoint): boolean {
    const { draft, view } = latest.current;
    return isValidPngSplitRegion(draft) && Math.hypot(point[0] - draft[0][0], point[1] - draft[0][1]) * view.zoom <= 10;
  }
  function clearGuide(): void {
    cancelAnimationFrame(frame.current); frame.current = 0;
    guide.current?.setAttribute("d", "");
    start.current?.removeAttribute("data-close-ready");
  }
  function finishDrawing(): void {
    clearGuide(); setDraft([]); setDrawing(false); onDrawingChange(false);
  }
  function closeRegion(): void {
    if (!canClose) return;
    onRegionsChange([...regions, draft]);
    setSelected(regions.length);
    finishDrawing();
    svg.current?.focus();
  }
  function removeSelected(): void {
    if (selected === null) return;
    onRegionsChange(regions.filter((_region, index) => index !== selected));
    setSelected(null);
    svg.current?.focus();
  }
  function updateGuide(): void {
    frame.current = 0;
    const { draft, drawing } = latest.current;
    if (!drawing || !draft.length || !cursor.current || !svg.current) return;
    const point = pointAt(cursor.current.x, cursor.current.y);
    const closing = nearStart(point), target = closing ? draft[0] : point;
    const last = draft[draft.length - 1];
    guide.current?.setAttribute("d", `M ${last[0]} ${last[1]} L ${target[0]} ${target[1]}`);
    start.current?.toggleAttribute("data-close-ready", closing);
  }
  // Pointer movement mutates only the provisional edge/highlight, at most once per frame.
  // Reproject that same cursor after a viewport zoom without publishing document state.
  useEffect(() => {
    if (drawing && cursor.current && !frame.current) frame.current = requestAnimationFrame(updateGuide);
  });
  return <>
    <svg ref={svg} className={styles.regionEditor} data-png-region-editor data-drawing={drawing}
      viewBox={`${viewportBounds.x} ${viewportBounds.y} ${viewportBounds.width} ${viewportBounds.height}`}
      tabIndex={0} role="group" aria-label={t("uiSketch.pngSplit.preview")}
      onPointerMove={event => {
        if (!drawing) return;
        cursor.current = { x: event.clientX, y: event.clientY };
        if (!frame.current) frame.current = requestAnimationFrame(updateGuide);
      }}
      onPointerLeave={clearGuide}
      onClick={event => {
        svg.current?.focus();
        if (!drawing) { setSelected(null); return; }
        const point = pointAt(event.clientX, event.clientY);
        if (nearStart(point)) { closeRegion(); return; }
        if (draft.length >= MAX_PNG_SPLIT_POINTS || (draft.length && Math.hypot(point[0] - draft[draft.length - 1][0], point[1] - draft[draft.length - 1][1]) * zoom < 2)) return;
        clearGuide(); setDraft([...draft, point]);
      }}
      onKeyDown={event => {
        if (event.key === "Escape" && drawing) {
          event.preventDefault(); event.stopPropagation(); finishDrawing();
        } else if (event.key === "Enter" && drawing) {
          event.preventDefault(); event.stopPropagation(); closeRegion();
        } else if ((event.key === "Delete" || event.key === "Backspace") && !drawing && selected !== null) {
          event.preventDefault(); event.stopPropagation(); removeSelected();
        }
      }}>
      {regions.map((region, index) => <polygon key={index} data-png-manual-region data-selected={selected === index}
        className={styles.manualRegion} points={region.map(point => point.join(",")).join(" ")} fillRule="evenodd"
        vectorEffect="non-scaling-stroke" role="button" tabIndex={drawing ? -1 : 0}
        aria-label={t("uiSketch.pngSplit.manualRegion", { index: index + 1 })} aria-pressed={selected === index}
        onClick={event => { if (!drawing) { event.stopPropagation(); setSelected(index); svg.current?.focus(); } }}
        onKeyDown={event => {
          if (!drawing && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault(); event.stopPropagation(); setSelected(index); svg.current?.focus();
          }
        }} />)}
      {drawing && <g className={styles.regionDraft} aria-hidden="true" pointerEvents="none">
        <polyline points={draft.map(point => point.join(",")).join(" ")} vectorEffect="non-scaling-stroke" />
        <path ref={guide} data-png-region-guide vectorEffect="non-scaling-stroke" strokeDasharray="6 4" />
        {draft.map(([x, y], index) => <circle key={index} ref={index === 0 ? start : undefined}
          className={index === 0 ? styles.startAnchor : undefined} cx={x} cy={y} r={4 / zoom}
          vectorEffect="non-scaling-stroke" />)}
      </g>}
    </svg>
    {toolsHost && createPortal(<div className={styles.regionTools} data-png-region-tools data-infinite-canvas-ui="true">
      <BasicButton size="small" icon={<NodeIndexOutlined />} aria-pressed={drawing}
        disabled={!ready || (!drawing && regions.length >= MAX_PNG_SPLIT_REGIONS)}
        title={t("uiSketch.pngSplit.interactionHelp")} onClick={() => {
          if (drawing) finishDrawing();
          else { setSelected(null); setDraft([]); setDrawing(true); onDrawingChange(true); }
          svg.current?.focus();
        }}>{t("uiSketch.pngSplit.freeAnchors")}</BasicButton>
      {drawing && <BasicButton size="small" disabled={!canClose} onClick={closeRegion}>{t("uiSketch.pngSplit.closeRegion")}</BasicButton>}
      <BasicButton size="small" mode="icon-only" icon={<DeleteOutlined />} iconLabel={t("actions.delete")}
        disabled={drawing || selected === null} onClick={removeSelected} />
    </div>, toolsHost)}
  </>;
}
