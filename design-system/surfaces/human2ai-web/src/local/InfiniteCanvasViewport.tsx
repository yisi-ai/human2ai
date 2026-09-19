"use client";

import {
  CompressOutlined,
  MinusOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { SideActionPanel } from "@human2ai/ui/yisiui/side-action-panel";
import { Tooltip } from "antd";
import { useEffect, useId, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";

import "./InfiniteCanvasViewport.css";

export interface InfiniteCanvasPoint {
  x: number;
  y: number;
}

export interface InfiniteCanvasSize {
  width: number;
  height: number;
}

export interface InfiniteCanvasBounds extends InfiniteCanvasPoint, InfiniteCanvasSize {}

export interface InfiniteCanvasFitRequest {
  id: number;
  bounds: InfiniteCanvasBounds;
  padding?: number;
}

export interface InfiniteCanvasRenderState {
  cameraCenter: InfiniteCanvasPoint;
  zoom: number;
  viewportSize: InfiniteCanvasSize;
  viewportBounds: InfiniteCanvasBounds;
  screenToWorld: (point: InfiniteCanvasPoint) => InfiniteCanvasPoint;
  worldToScreen: (point: InfiniteCanvasPoint) => InfiniteCanvasPoint;
}

export type InfiniteCanvasBackgroundPattern =
  | "none"
  | "solid-grid"
  | "dashed-grid"
  | "dots";

export type InfiniteCanvasSideActionPlacement = "left" | "right";

export interface InfiniteCanvasViewportLabels {
  zoomOut: string;
  zoomIn: string;
  currentZoom: string;
  fitAll: string;
  help: string;
  interactionHelp: ReactNode;
  sideActions: string;
  collapseSideActions: string;
  expandSideActions: string;
}

export interface InfiniteCanvasViewportProps {
  children: (state: InfiniteCanvasRenderState) => ReactNode;
  cameraCenter?: InfiniteCanvasPoint;
  defaultCameraCenter?: InfiniteCanvasPoint;
  zoom?: number;
  defaultZoom?: number;
  minimumZoom?: number;
  maximumZoom?: number;
  fitRequest?: InfiniteCanvasFitRequest;
  contentBounds?: InfiniteCanvasBounds;
  backgroundPattern?: InfiniteCanvasBackgroundPattern;
  showViewportControls?: boolean;
  sideActions?: ReactNode;
  sideActionPlacement?: InfiniteCanvasSideActionPlacement;
  sideActionPanelWidth?: CSSProperties["width"];
  sideActionPanelDefaultCollapsed?: boolean;
  labels?: Partial<InfiniteCanvasViewportLabels>;
  onCameraCenterChange?: (center: InfiniteCanvasPoint) => void;
  onZoomChange?: (zoom: number) => void;
  onContextMenuRequest?: (request: { clientX: number; clientY: number; target: EventTarget | null }) => void;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

interface PanInteraction {
  pointerId: number;
  sourceCameraCenter: InfiniteCanvasPoint;
  startClient: InfiniteCanvasPoint;
  contextTarget: EventTarget | null;
  rightButton: boolean;
  moved: boolean;
}

const DEFAULT_VIEWPORT_SIZE: InfiniteCanvasSize = { width: 1, height: 1 };
const DEFAULT_CAMERA_CENTER: InfiniteCanvasPoint = { x: 0, y: 0 };
const DEFAULT_MINIMUM_ZOOM = 0.25;
const DEFAULT_MAXIMUM_ZOOM = 4;
const DEFAULT_FIT_PADDING = 48;
const WHEEL_ZOOM_RATE = 0.0015;
const BUTTON_ZOOM_STEP = 1.2;
const BACKGROUND_GRID_SIZE = 32;
const DEFAULT_LABELS: InfiniteCanvasViewportLabels = {
  zoomOut: "缩小画布",
  zoomIn: "放大画布",
  currentZoom: "当前缩放",
  fitAll: "适应全部",
  help: "画布操作说明",
  interactionHelp: "滚轮缩放；按住右键拖动画布；按住空格键并使用左键拖动画布。",
  sideActions: "画布操作",
  collapseSideActions: "收起画布操作",
  expandSideActions: "展开画布操作",
};

export function InfiniteCanvasViewport({
  children,
  onContextMenuRequest,
  cameraCenter,
  defaultCameraCenter = DEFAULT_CAMERA_CENTER,
  zoom,
  defaultZoom = 1,
  minimumZoom = DEFAULT_MINIMUM_ZOOM,
  maximumZoom = DEFAULT_MAXIMUM_ZOOM,
  fitRequest,
  contentBounds,
  backgroundPattern = "dots",
  showViewportControls = true,
  sideActions,
  sideActionPlacement = "right",
  sideActionPanelWidth,
  sideActionPanelDefaultCollapsed = false,
  labels: labelOverrides,
  onCameraCenterChange,
  onZoomChange,
  className,
  style,
  "aria-label": ariaLabel = "无限画布",
}: InfiniteCanvasViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const backgroundPatternId = `human2ai-infinite-canvas-${useId().replaceAll(":", "")}`;
  const [viewportSize, setViewportSize] = useState<InfiniteCanvasSize>(DEFAULT_VIEWPORT_SIZE);
  const [internalCameraCenter, setInternalCameraCenter] =
    useState<InfiniteCanvasPoint>(defaultCameraCenter);
  const [internalZoom, setInternalZoom] = useState(defaultZoom);
  const [spacePressed, setSpacePressed] = useState(false);
  const [panning, setPanning] = useState(false);
  const pointerInsideRef = useRef(false);
  const spacePressedRef = useRef(false);
  const panInteractionRef = useRef<PanInteraction | null>(null);
  const suppressClickRef = useRef(false);
  const lastFitRequestIdRef = useRef<number | null>(null);
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const resolvedMinimumZoom = Math.min(minimumZoom, maximumZoom);
  const resolvedMaximumZoom = Math.max(minimumZoom, maximumZoom);
  const resolvedCameraCenter = cameraCenter ?? internalCameraCenter;
  const resolvedZoom = clampZoom(
    zoom ?? internalZoom,
    resolvedMinimumZoom,
    resolvedMaximumZoom,
  );
  const visibleWorldSize = {
    width: viewportSize.width / resolvedZoom,
    height: viewportSize.height / resolvedZoom,
  };
  const viewportBounds = {
    x: resolvedCameraCenter.x - visibleWorldSize.width / 2,
    y: resolvedCameraCenter.y - visibleWorldSize.height / 2,
    width: visibleWorldSize.width,
    height: visibleWorldSize.height,
  };
  const classes = [
    "human2ai-infinite-canvas-viewport",
    spacePressed ? "human2ai-infinite-canvas-viewport--pan-ready" : null,
    panning ? "human2ai-infinite-canvas-viewport--panning" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const screenOrigin = worldToScreen({ x: 0, y: 0 });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const measure = (): void => {
      const width = Math.max(1, viewport.clientWidth);
      const height = Math.max(1, viewport.clientHeight);
      setViewportSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const nextZoom = clampZoom(
        resolvedZoom * Math.exp(-event.deltaY * WHEEL_ZOOM_RATE),
        resolvedMinimumZoom,
        resolvedMaximumZoom,
      );
      if (nextZoom === resolvedZoom) return;
      const bounds = viewport.getBoundingClientRect();
      const pointer = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };
      const anchor = screenToWorld(pointer);
      updateCameraCenter({
        x: anchor.x + (bounds.width / 2 - pointer.x) / nextZoom,
        y: anchor.y + (bounds.height / 2 - pointer.y) / nextZoom,
      });
      updateZoom(nextZoom);
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  });

  useEffect(() => {
    if (
      !fitRequest ||
      lastFitRequestIdRef.current === fitRequest.id ||
      viewportSize.width <= 1 ||
      viewportSize.height <= 1
    ) {
      return;
    }
    lastFitRequestIdRef.current = fitRequest.id;
    fitBounds(fitRequest.bounds, fitRequest.padding);
  }, [
    fitRequest,
    resolvedMaximumZoom,
    resolvedMinimumZoom,
    viewportSize.height,
    viewportSize.width,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (
        event.code !== "Space" ||
        !pointerInsideRef.current ||
        isKeyboardInteractionTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      spacePressedRef.current = true;
      setSpacePressed(true);
    };
    const releaseSpace = (): void => {
      spacePressedRef.current = false;
      setSpacePressed(false);
    };
    const handleKeyUp = (event: globalThis.KeyboardEvent): void => {
      if (event.code === "Space") releaseSpace();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseSpace);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseSpace);
    };
  }, []);

  function updateCameraCenter(nextCenter: InfiniteCanvasPoint): void {
    if (cameraCenter === undefined) setInternalCameraCenter(nextCenter);
    onCameraCenterChange?.(nextCenter);
  }

  function updateZoom(nextZoom: number): void {
    const next = clampZoom(nextZoom, resolvedMinimumZoom, resolvedMaximumZoom);
    if (zoom === undefined) setInternalZoom(next);
    onZoomChange?.(next);
  }

  function fitBounds(bounds: InfiniteCanvasBounds, padding = DEFAULT_FIT_PADDING): void {
    const resolvedPadding = Math.max(0, padding);
    const availableWidth = Math.max(1, viewportSize.width - resolvedPadding * 2);
    const availableHeight = Math.max(1, viewportSize.height - resolvedPadding * 2);
    const nextZoom = clampZoom(
      Math.min(
        availableWidth / Math.max(1, bounds.width),
        availableHeight / Math.max(1, bounds.height),
      ),
      resolvedMinimumZoom,
      resolvedMaximumZoom,
    );
    updateCameraCenter({
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    });
    updateZoom(nextZoom);
  }

  function screenToWorld(point: InfiniteCanvasPoint): InfiniteCanvasPoint {
    return {
      x: viewportBounds.x + point.x / resolvedZoom,
      y: viewportBounds.y + point.y / resolvedZoom,
    };
  }

  function worldToScreen(point: InfiniteCanvasPoint): InfiniteCanvasPoint {
    return {
      x: (point.x - viewportBounds.x) * resolvedZoom,
      y: (point.y - viewportBounds.y) * resolvedZoom,
    };
  }

  function handlePointerDownCapture(event: ReactPointerEvent<HTMLDivElement>): void {
    if (isCanvasUiTarget(event.target)) return;
    const panRequested = event.button === 2 || (event.button === 0 && spacePressedRef.current);
    if (!panRequested) return;
    panInteractionRef.current = {
      pointerId: event.pointerId,
      sourceCameraCenter: resolvedCameraCenter,
      startClient: { x: event.clientX, y: event.clientY },
      contextTarget: event.target,
      rightButton: event.button === 2,
      moved: false,
    };
    suppressClickRef.current = true;
    setPanning(true);
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic Storybook pointer events may not create a capturable browser pointer.
    }
  }

  function handlePointerMoveCapture(event: ReactPointerEvent<HTMLDivElement>): void {
    const interaction = panInteractionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - interaction.startClient.x, event.clientY - interaction.startClient.y) > 3) {
      interaction.moved = true;
    }
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;
    if (onContextMenuRequest && interaction.rightButton && !interaction.moved) return;
    updateCameraCenter({
      x: interaction.sourceCameraCenter.x - (event.clientX - interaction.startClient.x) / resolvedZoom,
      y: interaction.sourceCameraCenter.y - (event.clientY - interaction.startClient.y) / resolvedZoom,
    });
  }

  function finishPointerInteraction(event: ReactPointerEvent<HTMLDivElement>): void {
    const interaction = panInteractionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    panInteractionRef.current = null;
    setPanning(false);
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (event.type === "pointerup" && interaction.rightButton && !interaction.moved) {
      onContextMenuRequest?.({
        clientX: event.clientX,
        clientY: event.clientY,
        target: interaction.contextTarget,
      });
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  return (
    <div
      ref={viewportRef}
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "infinite-canvas-viewport",
        name: "InfiniteCanvasViewport",
        category: "module",
        origin: "project",
        status: "candidate",
      })}
      className={classes}
      style={style}
      role="region"
      aria-label={ariaLabel}
      data-camera-center-x={resolvedCameraCenter.x}
      data-camera-center-y={resolvedCameraCenter.y}
      data-camera-zoom={resolvedZoom}
      data-background-pattern={backgroundPattern}
      onPointerEnter={() => {
        pointerInsideRef.current = true;
      }}
      onPointerLeave={() => {
        pointerInsideRef.current = false;
      }}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerUpCapture={finishPointerInteraction}
      onPointerCancelCapture={finishPointerInteraction}
      onLostPointerCapture={() => {
        panInteractionRef.current = null;
        setPanning(false);
      }}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = false;
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <CanvasBackground
        pattern={backgroundPattern}
        patternId={backgroundPatternId}
        screenOrigin={screenOrigin}
        zoom={resolvedZoom}
      />
      <div className="human2ai-infinite-canvas-viewport__world-content">
        {children({
          cameraCenter: resolvedCameraCenter,
          zoom: resolvedZoom,
          viewportSize,
          viewportBounds,
          screenToWorld,
          worldToScreen,
        })}
      </div>
      {sideActions ? (
        <div
          className={`human2ai-infinite-canvas-viewport__side-actions human2ai-infinite-canvas-viewport__side-actions--${sideActionPlacement}`}
          data-infinite-canvas-ui="true"
          data-side-action-placement={sideActionPlacement}
        >
          <SideActionPanel
            width={sideActionPanelWidth}
            defaultCollapsed={sideActionPanelDefaultCollapsed}
            aria-label={labels.sideActions}
            collapseLabel={labels.collapseSideActions}
            expandLabel={labels.expandSideActions}
          >
            {sideActions}
          </SideActionPanel>
        </div>
      ) : null}
      {showViewportControls ? (
        <div
          className="human2ai-infinite-canvas-viewport__controls"
          data-infinite-canvas-ui="true"
          role="group"
          aria-label={labels.currentZoom}
        >
          <BasicButton
            mode="icon-only"
            size="small"
            backgroundColor="none"
            icon={<MinusOutlined aria-hidden="true" />}
            iconLabel={labels.zoomOut}
            title={labels.zoomOut}
            disabled={resolvedZoom <= resolvedMinimumZoom}
            onClick={() => updateZoom(resolvedZoom / BUTTON_ZOOM_STEP)}
          />
          <output
            className="human2ai-infinite-canvas-viewport__zoom"
            aria-label={`${labels.currentZoom} ${Math.round(resolvedZoom * 100)}%`}
            aria-live="polite"
          >
            {Math.round(resolvedZoom * 100)}%
          </output>
          <BasicButton
            mode="icon-only"
            size="small"
            backgroundColor="none"
            icon={<PlusOutlined aria-hidden="true" />}
            iconLabel={labels.zoomIn}
            title={labels.zoomIn}
            disabled={resolvedZoom >= resolvedMaximumZoom}
            onClick={() => updateZoom(resolvedZoom * BUTTON_ZOOM_STEP)}
          />
          <BasicButton
            mode="icon-only"
            size="small"
            backgroundColor="none"
            icon={<CompressOutlined aria-hidden="true" />}
            iconLabel={labels.fitAll}
            title={labels.fitAll}
            disabled={!contentBounds}
            onClick={() => {
              if (contentBounds) fitBounds(contentBounds);
            }}
          />
          <Tooltip title={labels.interactionHelp} placement="topRight">
            <BasicButton
              mode="icon-only"
              size="small"
              backgroundColor="none"
              icon={<QuestionCircleOutlined aria-hidden="true" />}
              iconLabel={labels.help}
            />
          </Tooltip>
        </div>
      ) : null}
    </div>
  );
}

function CanvasBackground({
  pattern,
  patternId,
  screenOrigin,
  zoom,
}: {
  pattern: InfiniteCanvasBackgroundPattern;
  patternId: string;
  screenOrigin: InfiniteCanvasPoint;
  zoom: number;
}) {
  if (pattern === "none") return null;
  const size = BACKGROUND_GRID_SIZE * zoom;
  const isDots = pattern === "dots";
  const patternX = isDots ? screenOrigin.x - size / 2 : screenOrigin.x;
  const patternY = isDots ? screenOrigin.y - size / 2 : screenOrigin.y;

  return (
    <svg
      className="human2ai-infinite-canvas-viewport__background"
      data-canvas-background={pattern}
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={patternId}
          x={patternX}
          y={patternY}
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
        >
          {isDots ? (
            <circle
              className="human2ai-infinite-canvas-viewport__background-dot"
              cx={size / 2}
              cy={size / 2}
              r="1.5"
            />
          ) : (
            <path
              className="human2ai-infinite-canvas-viewport__background-line"
              d={`M 0 0 H ${size} M 0 0 V ${size}`}
              strokeDasharray={pattern === "dashed-grid" ? "4 4" : undefined}
            />
          )}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}

function clampZoom(zoom: number, minimumZoom: number, maximumZoom: number): number {
  return Math.min(maximumZoom, Math.max(minimumZoom, zoom));
}

function isKeyboardInteractionTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.matches("input, textarea, select, button, a[href]") || target.isContentEditable)
  );
}

function isCanvasUiTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("[data-infinite-canvas-ui]"));
}
