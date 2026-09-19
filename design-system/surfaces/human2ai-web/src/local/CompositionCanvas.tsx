"use client";

import { Dropdown, Select, Switch } from "antd";
import {
  TextMarkEditorField,
  TextMarkEditorTextArea,
} from "@human2ai/ui/yisiui/text-mark-editor";
import { useId, useLayoutEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

import { useCanvasContextMenu, DEFAULT_CANVAS_LAYER_LABELS, type CanvasLayerLabels } from "./useCanvasContextMenu";
import { sortCanvasLayers, CANVAS_LAYER_ACTIONS } from "../../../../../src/domain/canvas-layer-order.ts";
import { reorderCompositionLayers } from "../../../../../src/domain/composition/layers.ts";
import {
  COMPOSITION_CANVAS,
  areaGeometry,
  addArea,
  addCompositionImage,
  addDirectionLine,
  addFocus,
  addTextRegion,
  createDraft,
  compositionDraftContentBounds,
  copyCompositionItems,
  frameBoundsInCanvas,
  isCompositionTextRegion,
  moveFrame,
  moveItem,
  moveTextRegionCorner,
  textRegionLines,
  pasteCompositionItems,
  removeItem,
  renderCompositionLightSourceSvg,
  resizeArea,
  resizeCompositionImage,
  resizeFreeArea,
  resizeFrame,
  resizeFrameToBounds,
  rotateArea,
  rotateCompositionImage,
  rotateDirectionLine,
  updateAreaMetadata,
  updateCompositionImage,
  updateItemMetadata,
  type AreaGeometry,
  type CompositionArea,
  type CompositionClipboardItem,
  type CompositionDraft,
  type CompositionFrameBounds,
  type CompositionImage,
  type CompositionVisualWeight,
  type DirectionLine,
  type FocusPoint,
  type Point,
} from "../../../../../src/domain/composition";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import { CanvasFrame, type CanvasFrameMoveChange } from "./CanvasFrame";
import { CanvasImage } from "./CanvasImage";
import { useCanvasImagePaste } from "./useCanvasImagePaste";
import {
  CanvasImageEditorFields,
  type CanvasImageEditorLabels,
} from "./CanvasImageEditorFields";
import { CanvasLine } from "./CanvasLine";
import {
  CanvasNode,
  type CanvasNodeBounds,
  type CanvasNodeResizeChange,
  type CanvasNodeSelectEvent,
} from "./CanvasNode";
import { CanvasPoint } from "./CanvasPoint";
import { CanvasPlacement, type CanvasPlacementResult, type CanvasPlacementTool } from "./CanvasPlacement";
import { CanvasScene } from "./CanvasScene";
import { CanvasShape } from "./CanvasShape";
import {
  Human2AiCanvasNodeEditor,
  type Human2AiCanvasNodeEditorLabels,
  type Human2AiCanvasNodeKind,
} from "./Human2AiCanvasNodeEditor";
import {
  InfiniteCanvasViewport,
  type InfiniteCanvasBackgroundPattern,
  type InfiniteCanvasRenderState,
  type InfiniteCanvasSideActionPlacement,
  type InfiniteCanvasViewportLabels,
} from "./InfiniteCanvasViewport";

import "./CompositionCanvas.css";

export interface CompositionCanvasProps {
  interactionResetKey?: number;
  draft: CompositionDraft;
  appearance?: "editor" | "reference";
  showGuideGrid?: boolean;
  frameLocked?: boolean;
  zoom?: number;
  viewportAction?: CompositionCanvasViewportAction;
  backgroundPattern?: InfiniteCanvasBackgroundPattern;
  showViewportControls?: boolean;
  sideActions?: ReactNode;
  sideActionPlacement?: InfiniteCanvasSideActionPlacement;
  sideActionPanelWidth?: CSSProperties["width"];
  sideActionPanelDefaultCollapsed?: boolean;
  viewportLabels?: Partial<InfiniteCanvasViewportLabels>;
  layerLabels?: Partial<CanvasLayerLabels>;
  nodeEditorLabels?: Partial<Human2AiCanvasNodeEditorLabels>;
  directionControlLabels?: readonly [string, string];
  areaEditorLabels?: Partial<CompositionAreaEditorLabels>;
  imageEditorLabels?: Partial<CanvasImageEditorLabels>;
  renderCameraReference?: (image: CompositionImage) => ReactNode;
  resolveImageSource?: (assetId: string) => string | undefined;
  onImageUpload?: (file: File) => Promise<string>;
  onReadImageFile?: (src: string) => Promise<File>;
  selectedIds?: readonly string[];
  onDraftChange?: (draft: CompositionDraft) => void;
  placementTool?: CompositionPlacementTool | null;
  onPlacementToolChange?: (tool: CompositionPlacementTool | null) => void;
  onSelectionChange?: (ids: string[]) => void;
  onItemDoubleClick?: (id: string) => void;
  onZoomChange?: (zoom: number) => void;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

export type CompositionPlacementTool = "focus" | "direction" | "circle" | "triangle" | "quadrilateral" | "text" | "image";

export interface CompositionAreaEditorLabels {
  cornerLabel: string;
  lightSource: string;
  displayText: string;
  displayTextPlaceholder: string;
  visualWeight: string;
  weightAuto: string;
  weightHigh: string;
  weightMedium: string;
  weightLow: string;
  weightDecorative: string;
}

export interface CompositionCanvasViewportAction {
  id: number;
  type: "fit-frame" | "fit-all";
}

type PointerInteraction =
  | {
      type: "move-text-corner";
      pointerId: number;
      sourceDraft: CompositionDraft;
      id: string;
      cornerIndex: number;
      start: Point;
      startClient: Point;
      movingPoint: Point;
      moved: boolean;
    }
  | {
      type: "move-items";
      pointerId: number;
      ids: string[];
      sourceDraft: CompositionDraft;
      start: Point;
      startClient: Point;
      moved: boolean;
    }
  | {
      type: "move-direction-point";
      pointerId: number;
      sourceDraft: CompositionDraft;
      pointIndex: number;
      fixedPoint: Point;
      movingPoint: Point;
      start: Point;
    }
  | {
      type: "marquee";
      pointerId: number;
      sourceSelectedIds: string[];
      start: Point;
      startClient: Point;
      moved: boolean;
      additive: boolean;
    };

type CompositionItem = CompositionArea | CompositionImage | FocusPoint | DirectionLine;

interface GroupResizeSource {
  signature: string;
  draft: CompositionDraft;
  ids: string[];
  bounds: CompositionFrameBounds;
}

interface NodeEditorTarget {
  id: string;
  kind: Human2AiCanvasNodeKind;
}

const AREA_LABELS: Record<CompositionArea["primitive"], string> = {
  circle: "圆形",
  triangle: "三角形",
  quadrilateral: "矩形",
};

const DEFAULT_AREA_EDITOR_LABELS: CompositionAreaEditorLabels = {
  cornerLabel: "文字轮廓角点 {{index}}",
  lightSource: "作为光源",
  displayText: "显示文字",
  displayTextPlaceholder: "填写要显示的文字；留空由生图模型决定",
  visualWeight: "视觉权重",
  weightAuto: "自动",
  weightHigh: "高",
  weightMedium: "中",
  weightLow: "低",
  weightDecorative: "装饰",
};

const DEFAULT_IMAGE_EDITOR_LABELS: CanvasImageEditorLabels = {
  content: "图片内容",
  upload: "上传图片",
  download: "下载图片",
  downloading: "正在下载",
  downloadFailed: "图片下载失败，请重试。",
  replace: "替换图片",
  uploading: "正在上传",
  uploadFailed: "上传失败，请重试",
  fileTypes: "支持 PNG、JPEG、WebP、SVG，最大 10 MB",
  cropTitle: "裁剪图片",
  cropLoadFailed: "图片加载失败",
  svgSource: "SVG 源码",
  svgPaste: "粘贴 SVG",
  svgApply: "使用 SVG",
  svgSaveFailed: "SVG 保存失败，请检查代码后重试。",
  svgCopy: "复制源码",
  svgCopying: "正在复制源码",
  svgCopyFailed: "源码复制失败",
  sourceLoading: "正在读取图片内容",
  sourceLoadFailed: "图片内容读取失败，请重试。",
  svgCopied: "已复制",
  cancel: "取消",
  retry: "重试",
};

const MINIMUM_CANVAS_ZOOM = 0.25;
const MAXIMUM_CANVAS_ZOOM = 4;
const VIEWPORT_FIT_PADDING = 48;
const CLIPBOARD_PASTE_OFFSET = 24;
export const COMPOSITION_FRAME_ID = "composition-frame";

export function CompositionCanvas({
  interactionResetKey,
  draft,
  appearance = "editor",
  showGuideGrid = false,
  frameLocked = false,
  zoom,
  viewportAction,
  backgroundPattern,
  showViewportControls,
  sideActions,
  sideActionPlacement,
  sideActionPanelWidth,
  sideActionPanelDefaultCollapsed,
  viewportLabels,
  layerLabels: layerLabelOverrides,
  nodeEditorLabels,
  directionControlLabels = ["动势线操作点 1", "动势线操作点 2"],
  areaEditorLabels: areaEditorLabelOverrides,
  imageEditorLabels: imageEditorLabelOverrides,
  resolveImageSource,
  renderCameraReference,
  onImageUpload,
  onReadImageFile,
  selectedIds = [],
  onDraftChange,
  placementTool = null,
  onPlacementToolChange,
  onSelectionChange,
  onItemDoubleClick,
  onZoomChange,
  className,
  style,
  "aria-label": ariaLabel = "构图画布",
}: CompositionCanvasProps) {
  const classes = [
    "human2ai-composition-canvas",
    `human2ai-composition-canvas--${appearance}`,
    frameLocked ? "human2ai-composition-canvas--frame-locked" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const canvasRootRef = useRef<HTMLDivElement>(null);
  const { contextMenuOpen, contextMenuPoint, contextMenuPopupRef, openContextMenuAt, closeContextMenu, dismissContextMenu } = useCanvasContextMenu();
  const layerLabels = { ...DEFAULT_CANVAS_LAYER_LABELS, ...layerLabelOverrides };
  const [controlsHost, setControlsHost] = useState<SVGGElement | null>(null);
  const interactionRef = useRef<PointerInteraction | null>(null);
  const suppressClickRef = useRef(false);
  const suppressItemSelectionRef = useRef(false);
  const groupResizeSourceRef = useRef<GroupResizeSource | null>(null);
  const clipboardRef = useRef<CompositionClipboardItem[]>([]);
  const clipboardTokenRef = useRef("");
  const pasteCountRef = useRef(0);
  const [draggingItems, setDraggingItems] = useState(false);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [cornerFocused, setCornerFocused] = useState(false);
  // Handle spacing is editor state; an infinite line persists only position and angle.
  const [directionControlDistance, setDirectionControlDistance] = useState(160);
  const [marqueeBounds, setMarqueeBounds] = useState<CompositionFrameBounds | null>(null);
  const [editingTarget, setEditingTarget] = useState<NodeEditorTarget | null>(null);
  const frame = frameBoundsInCanvas(draft.frame);
  const canvasStyle = appearance === "reference"
    ? ({
        ...style,
        "--human2ai-composition-reference-aspect": frame.width / frame.height,
      } as CSSProperties)
    : style;
  const contentBounds = compositionDraftContentBounds(draft);
  const frameEditable = appearance !== "reference" && Boolean(onDraftChange) && !frameLocked;
  const frameSelected = appearance !== "reference" && selectedIds.includes(COMPOSITION_FRAME_ID);
  const selectedItemIds = appearance === "reference" || frameSelected
    ? []
    : uniqueIds(selectedIds).filter((id) => Boolean(findItem(draft, id)));
  const selectedItemIdSet = new Set(selectedItemIds);
  const multiSelectionBounds =
    selectedItemIds.length > 1 ? boundsForItems(draft, selectedItemIds) : null;
  const multiSelectionHasImage = selectedItemIds.some((id) => (
    draft.images.some((image) => image.id === id)
  ));
  const fitRequest = viewportAction
    ? {
        id: viewportAction.id,
        bounds:
          viewportAction.type === "fit-frame" ? frame : contentBounds,
        padding: VIEWPORT_FIT_PADDING,
      }
    : undefined;
  const editingItem = editingTarget ? findItem(draft, editingTarget.id) : null;
  const editingArea = editingTarget
    ? draft.areas.find(({ id }) => id === editingTarget.id) ?? null
    : null;
  const editingImage = editingTarget
    ? draft.images.find(({ id }) => id === editingTarget.id) ?? null
    : null;
  const areaEditorLabels = { ...DEFAULT_AREA_EDITOR_LABELS, ...areaEditorLabelOverrides };
  const lightGradientPrefix = useId().replace(/:/g, "");
  const imageEditorLabels = { ...DEFAULT_IMAGE_EDITOR_LABELS, ...imageEditorLabelOverrides };
  const latestDraftRef = useRef({ draft, onDraftChange, interactionResetKey });
  useLayoutEffect(() => { latestDraftRef.current = { draft, onDraftChange, interactionResetKey }; });
  const imagePaste = useCanvasImagePaste({
    disabled: appearance === "reference" || !onDraftChange || Boolean(editingTarget),
    resetKey: interactionResetKey,
    labels: imageEditorLabels,
    onUpload: onImageUpload,
    onCopy: handleCanvasCopy,
    onPasteFallback: handleCanvasPaste,
    onImageReady: ({ assetId, x, y, width, height }) => {
      const added = addCompositionImage(draft, {
        x: x / COMPOSITION_CANVAS.width,
        y: y / COMPOSITION_CANVAS.height,
        width: width / COMPOSITION_CANVAS.width,
        height: height / COMPOSITION_CANVAS.height,
      });
      onDraftChange?.(updateCompositionImage(added.draft, added.id, { assetId }));
      onSelectionChange?.([added.id]);
      onPlacementToolChange?.(null);
    },
  });
  const visualWeightOptions: Array<{ value: CompositionVisualWeight; label: string }> = [
    { value: "auto", label: areaEditorLabels.weightAuto },
    { value: "high", label: areaEditorLabels.weightHigh },
    { value: "medium", label: areaEditorLabels.weightMedium },
    { value: "low", label: areaEditorLabels.weightLow },
    { value: "decorative", label: areaEditorLabels.weightDecorative },
  ];

  const placementAvailable = appearance !== "reference" && Boolean(onDraftChange)
    && (placementTool !== "focus" || draft.focusPoints.length < 3)
    && (placementTool !== "direction" || !draft.directionLine);

  useLayoutEffect(() => {
    if (interactionResetKey === undefined) return;
    interactionRef.current = null;
    setDraggingItems(false);
    groupResizeSourceRef.current = null;
    setMarqueeBounds(null);
    setEditingTarget(null);
    setCornerFocused(false);
    dismissContextMenu();
  }, [interactionResetKey]);

  useLayoutEffect(() => {
    const update = (event: globalThis.KeyboardEvent) => setCtrlPressed(event.ctrlKey);
    const blur = () => {
      setCtrlPressed(false);
      setCornerFocused(false);
      if (interactionRef.current?.type === "move-text-corner") interactionRef.current = null;
    };
    window.addEventListener("keydown", update);
    window.addEventListener("keyup", update);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", update);
      window.removeEventListener("keyup", update);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useLayoutEffect(() => {
    if (placementTool) closeItemEditor();
    if (placementTool && !placementAvailable) onPlacementToolChange?.(null);
  }, [placementTool, placementAvailable]);

  function itemTooltip(item: CompositionItem, displayText = ""): ReactNode {
    const fields = [
      [nodeEditorLabels?.nodeDescription ?? "节点说明", item.annotation],
      [areaEditorLabels.displayText, displayText],
      [nodeEditorLabels?.note ?? "备注", item.note],
    ].filter(([, value]) => value.trim());
    if (fields.length === 0) return undefined;
    return (
      <dl className="human2ai-composition-canvas__node-tooltip">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  function placeNode(placement: CanvasPlacementResult): void {
    if (!placementTool || !onDraftChange || !placementAvailable) return;
    const { bounds, start, end, dragged } = placement;
    const center = {
      x: (bounds.x + bounds.width / 2) / COMPOSITION_CANVAS.width,
      y: (bounds.y + bounds.height * (placementTool === "triangle" ? 2 / 3 : 1 / 2))
        / COMPOSITION_CANVAS.height,
    };
    let added: { draft: CompositionDraft; id: string };
    if (placementTool === "focus") {
      added = addFocus(draft, {
        x: start.x / COMPOSITION_CANVAS.width,
        y: start.y / COMPOSITION_CANVAS.height,
      });
    } else if (placementTool === "direction") {
      added = addDirectionLine(draft);
      setDirectionControlDistance(dragged ? Math.hypot(end.x - start.x, end.y - start.y) : 160);
      added.draft = rotateDirectionLine(moveItem(added.draft, added.id, dragged ? center : {
        x: start.x / COMPOSITION_CANVAS.width,
        y: start.y / COMPOSITION_CANVAS.height,
      }), added.id, Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI);
    } else if (placementTool === "image") {
      added = addCompositionImage(draft, {
        ...center,
        width: bounds.width / COMPOSITION_CANVAS.width,
        height: bounds.height / COMPOSITION_CANVAS.height,
      });
    } else {
      added = placementTool === "text"
        ? addTextRegion(draft, center)
        : addArea(draft, {
            ...center,
            primitive: placementTool,
            aspect: placementTool === "quadrilateral" ? "free" : "square",
          });
      if (dragged) added.draft = resizeFreeArea(added.draft, added.id,
        bounds.width / COMPOSITION_CANVAS.width, bounds.height / COMPOSITION_CANVAS.height);
    }
    onDraftChange(added.draft);
    onSelectionChange?.([added.id]);
    onPlacementToolChange?.(null);
    suppressClickRef.current = true;
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
  }

  function selectItem(id: string, event: CanvasNodeSelectEvent): void {
    if (suppressItemSelectionRef.current) {
      suppressItemSelectionRef.current = false;
      return;
    }
    onSelectionChange?.(
      event.shiftKey
        ? toggleIds(selectedItemIds, [id])
        : [id],
    );
  }

  function nudgeItem(id: string, delta: Point): void {
    if (!onDraftChange) return;
    const ids = selectedItemIds.length > 1 && selectedItemIdSet.has(id)
      ? selectedItemIds
      : [id];
    onDraftChange(moveItemsByDelta(draft, ids, delta));
  }

  function deleteItem(id: string): void {
    if (!onDraftChange || !findItem(draft, id)) return;
    const ids = selectedItemIds.length > 1 && selectedItemIdSet.has(id)
      ? selectedItemIds
      : [id];
    onDraftChange(removeItems(draft, ids));
    onSelectionChange?.([]);
    if (editingTarget && ids.includes(editingTarget.id)) closeItemEditor();
  }

  function openItemEditor(
    id: string,
    kind: Human2AiCanvasNodeKind,
  ): void {
    setEditingTarget({ id, kind });
    onSelectionChange?.([id]);
    onItemDoubleClick?.(id);
  }

  function closeItemEditor(): void {
    setEditingTarget(null);
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>): void {
    if (!(event.target instanceof Element)) return;
    suppressClickRef.current = false;
    suppressItemSelectionRef.current = false;
    if (event.button !== 0) return;
    const point = canvasPoint(event, event.currentTarget);
    const handle = event.target.closest<SVGElement>("[data-handle]");

    if (handle) {
      if (!onDraftChange) return;
      const id = handle.dataset.itemId;
      const type = handle.dataset.handle;
      if (!id || !type) return;
      const direction = draft.directionLine?.id === id ? draft.directionLine : null;

      if (type === "move-text-corner" && event.ctrlKey) {
        const area = draft.areas.find((area) => area.id === id);
        if (!area || !isCompositionTextRegion(area)) return;
        const geometry = areaGeometry(area, COMPOSITION_CANVAS);
        const cornerIndex = Number(handle.dataset.cornerIndex);
        if (geometry.type !== "polygon" || !geometry.points[cornerIndex]) return;
        interactionRef.current = {
          type, pointerId: event.pointerId, sourceDraft: draft, id, cornerIndex,
          start: point,
          startClient: { x: event.clientX, y: event.clientY },
          movingPoint: geometry.points[cornerIndex],
          moved: false,
        };
        handle.focus();
      } else if (direction && type === "move-direction-point") {
        const pointIndex = Number(handle.dataset.pointIndex);
        const points = directionControlPoints(direction, directionControlDistance);
        interactionRef.current = {
          type,
          pointerId: event.pointerId,
          sourceDraft: draft,
          pointIndex,
          fixedPoint: points[1 - pointIndex],
          movingPoint: points[pointIndex],
          start: point,
        };
        handle.focus();
      } else {
        return;
      }
    } else {
      const itemElement = event.target.closest<SVGGElement>("[data-composition-item]");
      const id = itemElement?.dataset.compositionItem;
      const item = id ? findItem(draft, id) : null;
      if (id && item) {
        if (!onDraftChange) return;
        const moveIds = selectedItemIdSet.has(id) ? selectedItemIds : [id];
        interactionRef.current = {
          type: "move-items",
          pointerId: event.pointerId,
          ids: moveIds,
          sourceDraft: draft,
          start: point,
          startClient: { x: event.clientX, y: event.clientY },
          moved: false,
        };
      } else if (onSelectionChange) {
        const sourceSelectedIds = selectedItemIds;
        interactionRef.current = {
          type: "marquee",
          pointerId: event.pointerId,
          sourceSelectedIds,
          start: point,
          startClient: { x: event.clientX, y: event.clientY },
          moved: false,
          additive: event.shiftKey,
        };
      } else {
        return;
      }
    }

    const interaction = interactionRef.current;
    if (!interaction) return;
    if (interaction.type === "move-direction-point" || interaction.type === "move-text-corner") {
      suppressClickRef.current = true;
      event.preventDefault();
      capturePointer(event.currentTarget, event.pointerId);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>): void {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const point = canvasPoint(event, event.currentTarget);

    if (interaction.type === "move-items") {
      if (
        !interaction.moved
        && Math.hypot(
          event.clientX - interaction.startClient.x,
          event.clientY - interaction.startClient.y,
        ) < 3
      ) {
        return;
      }
      if (!interaction.moved) {
        interaction.moved = true;
        setDraggingItems(true);
        capturePointer(event.currentTarget, event.pointerId);
      }
      suppressClickRef.current = true;
      suppressItemSelectionRef.current = true;
      event.preventDefault();
      if (!onDraftChange) return;
      onDraftChange(moveItemsByDelta(interaction.sourceDraft, interaction.ids, {
        x: (point.x - interaction.start.x) / COMPOSITION_CANVAS.width,
        y: (point.y - interaction.start.y) / COMPOSITION_CANVAS.height,
      }));
      return;
    }

    if (interaction.type === "marquee") {
      if (
        !interaction.moved
        && Math.hypot(
          event.clientX - interaction.startClient.x,
          event.clientY - interaction.startClient.y,
        ) < 3
      ) {
        return;
      }
      if (!interaction.moved) {
        interaction.moved = true;
        capturePointer(event.currentTarget, event.pointerId);
      }
      event.preventDefault();
      suppressClickRef.current = true;
      setMarqueeBounds(rectangleFromPoints(interaction.start, point));
      return;
    }

    event.preventDefault();
    suppressClickRef.current = true;

    if (!onDraftChange) return;

    if (interaction.type === "move-text-corner") {
      if (!interaction.moved && Math.hypot(
        event.clientX - interaction.startClient.x,
        event.clientY - interaction.startClient.y,
      ) < 3) return;
      interaction.moved = true;
      const next = moveTextRegionCorner(interaction.sourceDraft, interaction.id, interaction.cornerIndex, {
        x: (interaction.movingPoint.x + point.x - interaction.start.x) / COMPOSITION_CANVAS.width,
        y: (interaction.movingPoint.y + point.y - interaction.start.y) / COMPOSITION_CANVAS.height,
      });
      if (next !== interaction.sourceDraft) onDraftChange(next);
      return;
    }

    moveDirectionPoint(interaction.sourceDraft, interaction.pointIndex, {
      x: interaction.movingPoint.x + point.x - interaction.start.x,
      y: interaction.movingPoint.y + point.y - interaction.start.y,
    }, interaction.fixedPoint);
  }

  function moveDirectionPoint(
    sourceDraft: CompositionDraft,
    pointIndex: number,
    movingPoint: Point,
    fixedPoint: Point,
  ): void {
    const direction = sourceDraft.directionLine;
    if (!direction || !onDraftChange) return;
    const [first, second] = pointIndex === 0
      ? [movingPoint, fixedPoint]
      : [fixedPoint, movingPoint];
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const distance = Math.hypot(dx, dy);
    setDirectionControlDistance(distance);
    onDraftChange(rotateDirectionLine(
      moveItem(sourceDraft, direction.id, {
        x: (first.x + second.x) / 2 / COMPOSITION_CANVAS.width,
        y: (first.y + second.y) / 2 / COMPOSITION_CANVAS.height,
      }),
      direction.id,
      distance < 0.001 ? direction.rotation : Math.atan2(dy, dx) * 180 / Math.PI,
    ));
  }

  function nudgeDirectionPoint(pointIndex: number, delta: Point): void {
    if (!draft.directionLine) return;
    const points = directionControlPoints(draft.directionLine, directionControlDistance);
    moveDirectionPoint(draft, pointIndex, {
      x: points[pointIndex].x + delta.x,
      y: points[pointIndex].y + delta.y,
    }, points[1 - pointIndex]);
  }

  function finishPointerInteraction(event: ReactPointerEvent<SVGSVGElement>): void {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    if (interaction.type === "move-text-corner") handlePointerMove(event);
    if (interaction.type === "marquee") {
      const hitIds = interaction.moved
        ? itemsIntersectingBounds(
            draft,
            rectangleFromPoints(
              interaction.start,
              canvasPoint(event, event.currentTarget),
            ),
          )
        : [];
      onSelectionChange?.(
        hitIds.length === 0
          ? []
          : interaction.additive
            ? toggleIds(interaction.sourceSelectedIds, hitIds)
            : hitIds,
      );
      setMarqueeBounds(null);
    }
    interactionRef.current = null;
    setDraggingItems(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressItemSelectionRef.current = false;
    }, 0);
  }

  function cancelPointerInteraction(event: ReactPointerEvent<SVGSVGElement>): void {
    if (interactionRef.current?.pointerId !== event.pointerId) return;
    interactionRef.current = null;
    setDraggingItems(false);
    setMarqueeBounds(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resizeAreaNode(id: string, change: CanvasNodeResizeChange): void {
    if (!onDraftChange) return;
    const area = draft.areas.find((item) => item.id === id);
    if (!area) return;
    const origin = areaOriginForBounds(area, change.bounds);
    const offset = rotateVector(origin, change.sourceRotation);
    const resized = resizeFreeArea(
      draft,
      id,
      change.bounds.width / COMPOSITION_CANVAS.width,
      change.bounds.height / COMPOSITION_CANVAS.height,
    );
    onDraftChange(
      moveItem(resized, id, {
        x: (change.sourcePosition.x + offset.x) / COMPOSITION_CANVAS.width,
        y: (change.sourcePosition.y + offset.y) / COMPOSITION_CANVAS.height,
      }),
    );
  }

  function resizeImageNode(id: string, change: CanvasNodeResizeChange): void {
    if (!onDraftChange || !draft.images.some((item) => item.id === id)) return;
    const origin = {
      x: change.bounds.x + change.bounds.width / 2,
      y: change.bounds.y + change.bounds.height / 2,
    };
    const offset = rotateVector(origin, change.sourceRotation);
    const resized = resizeCompositionImage(
      draft,
      id,
      change.bounds.width / COMPOSITION_CANVAS.width,
      change.bounds.height / COMPOSITION_CANVAS.height,
    );
    onDraftChange(moveItem(resized, id, {
      x: (change.sourcePosition.x + offset.x) / COMPOSITION_CANVAS.width,
      y: (change.sourcePosition.y + offset.y) / COMPOSITION_CANVAS.height,
    }));
  }

  function resizeSelectedItems(change: CanvasNodeResizeChange): void {
    if (!onDraftChange || selectedItemIds.length < 2) return;
    const sourceBounds = {
      x: change.sourcePosition.x + change.sourceBounds.x,
      y: change.sourcePosition.y + change.sourceBounds.y,
      width: change.sourceBounds.width,
      height: change.sourceBounds.height,
    };
    const signature = groupResizeSignature(selectedItemIds, sourceBounds);
    if (groupResizeSourceRef.current?.signature !== signature) {
      groupResizeSourceRef.current = {
        signature,
        draft,
        ids: [...selectedItemIds],
        bounds: sourceBounds,
      };
    }
    const source = groupResizeSourceRef.current;
    const nextBounds = {
      x: change.sourcePosition.x + change.bounds.x,
      y: change.sourcePosition.y + change.bounds.y,
      width: change.bounds.width,
      height: change.bounds.height,
    };
    onDraftChange(
      resizeItemsToBounds(
        source.draft,
        source.ids,
        source.bounds,
        nextBounds,
        change.scaleX,
        change.scaleY,
        change.proportional,
      ),
    );
  }

  function resizeCompositionFrame(change: CanvasNodeResizeChange): void {
    if (!onDraftChange) return;
    onDraftChange(
      resizeFrameToBounds(draft, {
        x: change.sourcePosition.x + change.bounds.x,
        y: change.sourcePosition.y + change.bounds.y,
        width: change.bounds.width,
        height: change.bounds.height,
      }),
    );
  }

  function moveCompositionFrame(change: CanvasFrameMoveChange): void {
    if (!onDraftChange) return;
    onDraftChange(
      moveFrame(draft, {
        x: change.bounds.x / COMPOSITION_CANVAS.width,
        y: change.bounds.y / COMPOSITION_CANVAS.height,
      }),
    );
  }

  function handleFrameKeyDown(event: KeyboardEvent<SVGGElement>): void {
    if (!onDraftChange) return;
    if (!["+", "=", "-", "_"].includes(event.key)) return;
    event.preventDefault();
    onSelectionChange?.([COMPOSITION_FRAME_ID]);
    onDraftChange(resizeFrame(draft, event.key === "+" || event.key === "=" ? 1.05 : 0.95));
  }

  function openContextMenu(request: { clientX: number; clientY: number; target: EventTarget | null }): void {
    if (appearance === "reference" || !(request.target instanceof Element)) return;
    const node = request.target.closest<SVGGElement>("[data-composition-item]");
    const id = node?.dataset.compositionItem;
    if (id && !selectedItemIdSet.has(id)) onSelectionChange?.([id]);
    else if (request.target.closest("[data-canvas-frame]")) onSelectionChange?.([COMPOSITION_FRAME_ID]);
    openContextMenuAt(request, node ?? canvasRootRef.current?.querySelector<SVGSVGElement>("[data-composition-scene]") ?? null);
  }

  function handleCanvasKeyDown(event: KeyboardEvent<SVGSVGElement>): void {
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      event.stopPropagation();
      const target = event.target instanceof Element ? event.target : event.currentTarget;
      const bounds = target.getBoundingClientRect();
      openContextMenu({ clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2, target });
      return;
    }
  }

  function handleCanvasCopy(event: ClipboardEvent): void {
    if (selectedItemIds.length === 0 || !event.clipboardData) return;
    clipboardRef.current = copyCompositionItems(draft, selectedItemIds);
    clipboardTokenRef.current = crypto.randomUUID();
    pasteCountRef.current = 0;
    event.clipboardData.setData("application/x-human2ai-composition", clipboardTokenRef.current);
    event.preventDefault();
    event.stopPropagation();
  }

  function handleCanvasPaste(event: ClipboardEvent): void {
    if (event.defaultPrevented || !onDraftChange || clipboardRef.current.length === 0
      || event.clipboardData?.getData("application/x-human2ai-composition") !== clipboardTokenRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    const pasteCount = pasteCountRef.current + 1;
    const pasted = pasteCompositionItems(draft, clipboardRef.current, {
      x: (CLIPBOARD_PASTE_OFFSET * pasteCount) / COMPOSITION_CANVAS.width,
      y: (CLIPBOARD_PASTE_OFFSET * pasteCount) / COMPOSITION_CANVAS.height,
    });
    if (pasted.ids.length === 0) return;
    pasteCountRef.current = pasteCount;
    closeItemEditor();
    onDraftChange(pasted.draft);
    onSelectionChange?.(pasted.ids);
  }

  function renderCanvas(viewport?: InfiniteCanvasRenderState): ReactNode {
    const viewportBounds = viewport?.viewportBounds ?? frame;
    const sceneBounds = appearance === "reference" ? frame : viewportBounds;
    const screenScale = viewport?.zoom ?? 1;
    const multiSelectionCenter = multiSelectionBounds
      ? {
          x: multiSelectionBounds.x + multiSelectionBounds.width / 2,
          y: multiSelectionBounds.y + multiSelectionBounds.height / 2,
        }
      : null;

    return (
      <CanvasScene
        ref={imagePaste.sceneRef}
        data-composition-scene
        bounds={sceneBounds}
        className="human2ai-composition-canvas__svg"
        data-camera-center-x={viewport?.cameraCenter.x}
        data-camera-center-y={viewport?.cameraCenter.y}
        data-camera-zoom={viewport?.zoom}
        data-frame-crop={appearance === "reference" ? "true" : undefined}
        data-frame-locked={frameLocked ? "true" : undefined}
        data-canvas-dragging={draggingItems ? "node" : undefined}
        role="group"
        aria-label={ariaLabel}
        aria-keyshortcuts={
          appearance !== "reference" ? "Control+C Meta+C Control+V Meta+V" : undefined
        }
        tabIndex={appearance !== "reference" ? -1 : undefined}
        onKeyDown={appearance !== "reference" ? handleCanvasKeyDown : undefined}
        onPointerDownCapture={
          appearance !== "reference"
            ? (event) => event.currentTarget.focus()
            : undefined
        }
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return;
          event.stopPropagation();
          suppressClickRef.current = false;
        }}
        onClick={
          appearance !== "reference" && onSelectionChange
            ? (event) => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                if (
                  event.target instanceof Element &&
                  (event.target.closest("[data-composition-item]") ||
                    event.target.closest("[data-handle]") ||
                    event.target.closest("[data-resize-handle]") ||
                    event.target.closest("[data-rotation-handle]"))
                ) {
                  return;
                }
                onSelectionChange([]);
                closeItemEditor();
              }
            : undefined
        }
        onPointerDown={appearance !== "reference" ? handlePointerDown : undefined}
        onPointerMove={appearance !== "reference" ? handlePointerMove : undefined}
        onPointerUp={appearance !== "reference" ? finishPointerInteraction : undefined}
        onPointerCancel={appearance !== "reference" ? cancelPointerInteraction : undefined}
        onLostPointerCapture={
          appearance !== "reference"
            ? () => {
                interactionRef.current = null;
                setDraggingItems(false);
                setMarqueeBounds(null);
              }
            : undefined
        }
      >
        <rect
          className="human2ai-composition-canvas__surface"
          x={appearance === "reference" ? frame.x : viewportBounds.x}
          y={appearance === "reference" ? frame.y : viewportBounds.y}
          width={appearance === "reference" ? frame.width : viewportBounds.width}
          height={appearance === "reference" ? frame.height : viewportBounds.height}
        />

        {appearance !== "reference" ? (
          <CanvasFrame
            controlsHost={draft.layerOrder ? controlsHost : undefined}
            id={COMPOSITION_FRAME_ID}
            label="移动或缩放画框"
            bounds={frame}
            selected={frameSelected}
            locked={!frameEditable}
            resizeMode="proportional"
            resizeCenter={{ x: 0, y: 0 }}
            screenScale={screenScale}
            resizeHitSize={40}
            minimumWidth={96}
            minimumHeight={96}
            onSelect={
              frameEditable ? () => onSelectionChange?.([COMPOSITION_FRAME_ID]) : undefined
            }
            onNudge={
              frameEditable
                ? (delta) => {
                    onSelectionChange?.([COMPOSITION_FRAME_ID]);
                    onDraftChange?.(
                      moveFrame(draft, {
                        x: draft.frame.bounds.x + delta.x,
                        y: draft.frame.bounds.y + delta.y,
                      }),
                    );
                  }
                : undefined
            }
            onMove={frameEditable ? moveCompositionFrame : undefined}
            onResize={frameEditable ? resizeCompositionFrame : undefined}
            onKeyDown={frameEditable ? handleFrameKeyDown : undefined}
            nudgeStep={0.01}
            largeNudgeStep={0.05}
            className="human2ai-composition-canvas__frame"
          />
        ) : null}

        {sortCanvasLayers([
          ...draft.images.map((image) => {
          const width = image.width * COMPOSITION_CANVAS.width;
          const height = image.height * COMPOSITION_CANVAS.height;
          const src = image.assetId ? resolveImageSource?.(image.assetId) : undefined;
          const imageLabel = nodeEditorLabels?.imageKind ?? "图片";
          return (
            <CanvasNode
              controlsHost={draft.layerOrder ? controlsHost : undefined}
              key={image.id}
              id={image.id}
              label={`${imageLabel} ${image.id}`}
              tooltip={itemTooltip(image)}
              x={image.x * COMPOSITION_CANVAS.width}
              y={image.y * COMPOSITION_CANVAS.height}
              rotation={image.rotation}
              selected={selectedItemIdSet.has(image.id)}
              bounds={
                appearance === "reference" ||
                (multiSelectionBounds && selectedItemIdSet.has(image.id))
                  ? undefined
                  : centeredBounds(width, height)
              }
              resizeMode="proportional"
              resizeCenter={{ x: 0, y: 0 }}
              screenScale={screenScale}
              onSelect={appearance !== "reference" ? selectItem : undefined}
              onNudge={
                appearance !== "reference" && onDraftChange
                  ? (delta) => nudgeItem(image.id, delta)
                  : undefined
              }
              onResize={
                appearance !== "reference" && onDraftChange &&
                !(multiSelectionBounds && selectedItemIdSet.has(image.id))
                  ? (change) => resizeImageNode(image.id, change)
                  : undefined
              }
              onRotate={
                appearance !== "reference" && onDraftChange &&
                !(multiSelectionBounds && selectedItemIdSet.has(image.id))
                  ? (change) => onDraftChange(
                      rotateCompositionImage(draft, image.id, change.rotation),
                    )
                  : undefined
              }
              onDoubleClick={
                appearance !== "reference" && (onDraftChange || onItemDoubleClick)
                  ? () => openItemEditor(image.id, "image")
                  : undefined
              }
              onDelete={
                appearance !== "reference" && onDraftChange
                  ? () => deleteItem(image.id)
                  : undefined
              }
              nudgeStep={0.01}
              largeNudgeStep={0.05}
              className="human2ai-composition-canvas__item human2ai-composition-canvas__image"
              data-composition-item={image.id}
              data-composition-kind="image"
            >
              <CanvasImage
                src={src}
                alt={image.note || imageLabel}
                width={width}
                height={height}
                fit="cover"
                crop={image.crop}
                status={src ? "ready" : "empty"}
                emptyLabel={imageLabel}
              />
            </CanvasNode>
          );
        }),
          ...draft.areas.map((area, index) => {
          const geometry = areaGeometry(area, COMPOSITION_CANVAS);
          const textRegion = isCompositionTextRegion(area);
          const center = geometry.type === "circle" || geometry.type === "ellipse"
            ? { x: geometry.cx, y: geometry.cy }
            : geometry.center;
          const bounds = areaNodeBounds(area, geometry);
          const outline = area.corners
            ? areaGeometry({ ...area, x: 0, y: 0, rotation: 0 }, COMPOSITION_CANVAS)
            : null;
          const itemLabel = textRegion
            ? nodeEditorLabels?.textKind ?? "文字区域"
            : AREA_LABELS[area.primitive];
          return (
            <CanvasNode
              controlsHost={draft.layerOrder ? controlsHost : undefined}
              key={area.id}
              id={area.id}
              label={`选择${itemLabel} ${area.id}`}
              tooltip={itemTooltip(area, textRegion ? area.displayText : undefined)}
              x={center.x}
              y={center.y}
              rotation={area.rotation ?? 0}
              selected={selectedItemIdSet.has(area.id)}
              bounds={
                appearance === "reference" ||
                (multiSelectionBounds && selectedItemIdSet.has(area.id))
                  ? undefined
                  : bounds
              }
              resizeCenter={{ x: 0, y: 0 }}
              screenScale={screenScale}
              onSelect={appearance !== "reference" ? selectItem : undefined}
              onNudge={
                appearance !== "reference" && onDraftChange
                  ? (delta) => nudgeItem(area.id, delta)
                  : undefined
              }
              onResize={
                appearance !== "reference" &&
                onDraftChange &&
                !(multiSelectionBounds && selectedItemIdSet.has(area.id))
                  ? (change) => resizeAreaNode(area.id, change)
                  : undefined
              }
              onRotate={
                appearance !== "reference" &&
                onDraftChange &&
                !(multiSelectionBounds && selectedItemIdSet.has(area.id)) &&
                (area.primitive !== "circle" || area.aspect === "free")
                  ? (change) => onDraftChange(rotateArea(draft, area.id, change.rotation))
                  : undefined
              }
              onDoubleClick={
                appearance !== "reference" && (onDraftChange || onItemDoubleClick)
                  ? () => openItemEditor(area.id, textRegion ? "text" : "shape")
                  : undefined
              }
              onDelete={
                appearance !== "reference" && onDraftChange
                  ? () => deleteItem(area.id)
                  : undefined
              }
              nudgeStep={0.01}
              largeNudgeStep={0.05}
              className={[
                "human2ai-composition-canvas__item",
                "human2ai-composition-canvas__area",
                `human2ai-composition-canvas__area--tone-${index % 6}`,
                textRegion ? "human2ai-composition-canvas__area--text-region" : null,
              ].filter(Boolean).join(" ")}
              data-composition-item={area.id}
              data-composition-kind={textRegion ? "text-region" : "area"}
            >
              {area.isLightSource ? (
                <g dangerouslySetInnerHTML={{ __html: renderCompositionLightSourceSvg(
                  { ...area, x: 0, y: 0, rotation: 0 },
                  `${lightGradientPrefix}-light-${area.id}`,
                  appearance,
                ) }} />
              ) : geometry.type === "circle" ? (
                <CanvasShape
                  type="circle"
                  size={geometry.radius * 2}
                  className="human2ai-composition-canvas__shape"
                />
              ) : geometry.type === "ellipse" ? (
                <CanvasShape
                  type="circle"
                  width={geometry.radiusX * 2}
                  height={geometry.radiusY * 2}
                  className="human2ai-composition-canvas__shape"
                />
              ) : textRegion ? (
                <>
                  {outline?.type === "polygon" ? (
                    <polygon
                      className="human2ai-composition-canvas__shape"
                      points={outline.points.map((point) => `${point.x},${point.y}`).join(" ")}
                      data-text-outline
                    />
                  ) : (
                  <CanvasShape
                    type="rectangle"
                    width={geometry.width ?? 0}
                    height={geometry.height}
                    className="human2ai-composition-canvas__shape"
                  />
                  )}
                  {outline ? (
                    <g className="human2ai-composition-canvas__text-region-marks" aria-hidden="true">
                      {textRegionLines({ ...area, x: 0, y: 0, rotation: 0 }, COMPOSITION_CANVAS).map(([start, end], index) => (
                        <line key={index} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
                      ))}
                    </g>
                  ) : <TextRegionMarks width={geometry.width ?? 0} height={geometry.height} />}
                </>
              ) : (
                <CanvasShape
                  type={area.primitive === "triangle" ? "triangle" : "rectangle"}
                  width={area.primitive === "triangle" ? geometry.side ?? 0 : geometry.width ?? 0}
                  height={geometry.height}
                  className="human2ai-composition-canvas__shape"
                />
              )}
            </CanvasNode>
          );
        }),
          ...(draft.directionLine ? [
          <DirectionLineItem
            key={draft.directionLine.id}
            draft={draft}
            label={nodeEditorLabels?.lineKind ?? "动势线"}
            selected={selectedItemIdSet.has(draft.directionLine.id)}
            onSelect={appearance !== "reference" ? selectItem : undefined}
            onNudge={appearance !== "reference" && onDraftChange ? nudgeItem : undefined}
            onDoubleClick={
              appearance !== "reference" && (onDraftChange || onItemDoubleClick)
                ? (id) => openItemEditor(id, "line")
                : undefined
            }
            onDelete={appearance !== "reference" && onDraftChange ? deleteItem : undefined}
            bounds={sceneBounds}
            tooltip={itemTooltip(draft.directionLine)}
          />
          ] : []),
          ...draft.focusPoints.map((focus) => {
          const x = focus.x * COMPOSITION_CANVAS.width;
          const y = focus.y * COMPOSITION_CANVAS.height;
          const radius = Math.min(COMPOSITION_CANVAS.width, COMPOSITION_CANVAS.height) * 0.018;
          return (
            <CanvasNode
              controlsHost={draft.layerOrder ? controlsHost : undefined}
              key={focus.id}
              id={focus.id}
              label={`选择焦点 ${focus.id}`}
              tooltip={itemTooltip(focus)}
              x={x}
              y={y}
              selected={selectedItemIdSet.has(focus.id)}
              onSelect={appearance !== "reference" ? selectItem : undefined}
              onNudge={
                appearance !== "reference" && onDraftChange
                  ? (delta) => nudgeItem(focus.id, delta)
                  : undefined
              }
              onDoubleClick={
                appearance !== "reference" && (onDraftChange || onItemDoubleClick)
                  ? () => openItemEditor(focus.id, "point")
                  : undefined
              }
              onDelete={
                appearance !== "reference" && onDraftChange
                  ? () => deleteItem(focus.id)
                  : undefined
              }
              nudgeStep={0.01}
              largeNudgeStep={0.05}
              className="human2ai-composition-canvas__item human2ai-composition-canvas__focus"
              data-composition-item={focus.id}
            >
              <circle
                className="human2ai-composition-canvas__focus-ring"
                cx={0}
                cy={0}
                r={radius}
              />
              <line x1={-radius * 1.5} y1={0} x2={radius * 1.5} y2={0} />
              <line x1={0} y1={-radius * 1.5} x2={0} y2={radius * 1.5} />
              <CanvasPoint
                className="human2ai-composition-canvas__focus-dot"
                radius={4}
              />
            </CanvasNode>
          );
        }),
        ], draft.layerOrder, (node) => String(node.key))}

        {appearance !== "reference" &&
        onDraftChange &&
        selectedItemIds.length === 1 &&
        draft.directionLine?.id === selectedItemIds[0] ? (
          <DirectionInteractionHandles
            directionLine={draft.directionLine}
            distance={directionControlDistance}
            screenScale={screenScale}
            labels={directionControlLabels}
            onNudge={nudgeDirectionPoint}
          />
        ) : null}

        {appearance !== "reference" && showGuideGrid ? (
          <g
            className="human2ai-composition-canvas__guide-grid"
            data-composition-guide-grid="true"
            aria-hidden="true"
          >
            <line
              x1={frame.x + frame.width / 3}
              y1={frame.y}
              x2={frame.x + frame.width / 3}
              y2={frame.y + frame.height}
            />
            <line
              x1={frame.x + (frame.width * 2) / 3}
              y1={frame.y}
              x2={frame.x + (frame.width * 2) / 3}
              y2={frame.y + frame.height}
            />
            <line
              x1={frame.x}
              y1={frame.y + frame.height / 3}
              x2={frame.x + frame.width}
              y2={frame.y + frame.height / 3}
            />
            <line
              x1={frame.x}
              y1={frame.y + (frame.height * 2) / 3}
              x2={frame.x + frame.width}
              y2={frame.y + (frame.height * 2) / 3}
            />
          </g>
        ) : null}

        {appearance !== "reference" &&
        multiSelectionBounds &&
        multiSelectionCenter &&
        onDraftChange ? (
          <CanvasNode
            controlsHost={draft.layerOrder ? controlsHost : undefined}
            id="composition-multi-selection"
            label={`缩放 ${selectedItemIds.length} 个所选元素`}
            x={multiSelectionCenter.x}
            y={multiSelectionCenter.y}
            selected
            bounds={centeredBounds(
              multiSelectionBounds.width,
              multiSelectionBounds.height,
            )}
            resizeMode={multiSelectionHasImage ? "proportional" : "free"}
            resizeCenter={{ x: 0, y: 0 }}
            screenScale={screenScale}
            minimumWidth={16}
            minimumHeight={16}
            showRotationHandle={false}
            tabIndex={-1}
            nudgeStep={0.01}
            largeNudgeStep={0.05}
            onNudge={(delta) => {
              onDraftChange(moveItemsByDelta(draft, selectedItemIds, delta));
            }}
            onResize={resizeSelectedItems}
            onDelete={() => {
              onDraftChange(removeItems(draft, selectedItemIds));
              onSelectionChange?.([]);
            }}
            className="human2ai-composition-canvas__multi-selection"
          >
            <rect
              className="human2ai-composition-canvas__multi-selection-surface"
              x={-multiSelectionBounds.width / 2}
              y={-multiSelectionBounds.height / 2}
              width={multiSelectionBounds.width}
              height={multiSelectionBounds.height}
              aria-hidden="true"
            />
          </CanvasNode>
        ) : null}

        {marqueeBounds ? (
          <rect
            className="human2ai-composition-canvas__marquee"
            x={marqueeBounds.x}
            y={marqueeBounds.y}
            width={marqueeBounds.width}
            height={marqueeBounds.height}
            aria-hidden="true"
          />
        ) : null}

        {appearance === "reference" ? (
          <rect
            data-composition-reference-frame="true"
            x={frame.x}
            y={frame.y}
            width={frame.width}
            height={frame.height}
            fill="none"
            stroke="var(--yisiui-color-border-interactive)"
            strokeWidth={4}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            aria-hidden="true"
          />
        ) : null}


        {draft.layerOrder && appearance !== "reference" ? (
          <rect data-canvas-layer-frame className="human2ai-canvas-shape human2ai-canvas-frame__border"
            x={frame.x} y={frame.y} width={frame.width} height={frame.height}
            aria-hidden="true" />
        ) : null}
        <g ref={setControlsHost} data-canvas-controls-layer />

        {appearance !== "reference" && onDraftChange && selectedItemIds.length === 1
          && (ctrlPressed || cornerFocused) ? draft.areas.filter((area) =>
            area.id === selectedItemIds[0] && isCompositionTextRegion(area),
          ).map((area) => {
            const geometry = areaGeometry(area, COMPOSITION_CANVAS);
            if (geometry.type !== "polygon") return null;
            return (
              <g key={area.id} className="human2ai-composition-canvas__handles"
                onFocus={() => setCornerFocused(true)}
                onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCornerFocused(false); }}>
                {geometry.points.map((point, index) => (
                  <g key={index} data-item-id={area.id} data-handle="move-text-corner" data-corner-index={index}
                    className="human2ai-composition-canvas__text-corner"
                    transform={`translate(${point.x} ${point.y})`} role="button" tabIndex={0}
                    aria-label={areaEditorLabels.cornerLabel.replace("{{index}}", String(index + 1))}
                    aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
                    onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
                    onKeyDown={(event) => {
                      const step = (event.shiftKey ? 10 : 1) / screenScale;
                      const delta: Partial<Record<string, Point>> = {
                        ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 },
                        ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step },
                      };
                      const offset = delta[event.key];
                      if (!offset) return;
                      event.preventDefault(); event.stopPropagation();
                      onDraftChange(moveTextRegionCorner(draft, area.id, index, {
                        x: (point.x + offset.x) / COMPOSITION_CANVAS.width,
                        y: (point.y + offset.y) / COMPOSITION_CANVAS.height,
                      }));
                    }}>
                    <circle className="human2ai-composition-canvas__transform-handle" r={7 / screenScale} />
                    <circle className="human2ai-composition-canvas__transform-hit" r={12 / screenScale} />
                  </g>
                ))}
              </g>
            );
          }) : null}

        {placementTool && placementAvailable ? (
          <CanvasPlacement
            key={placementTool}
            tool={compositionPlacementOptions(placementTool)}
            viewportBounds={sceneBounds}
            onPlace={placeNode}
            onCancel={() => onPlacementToolChange?.(null)}
          />
        ) : null}
      </CanvasScene>
    );
  }

  return (
    <div
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "composition-canvas",
        name: "CompositionCanvas",
        category: "module",
        origin: "project",
        status: "candidate",
      })}
      ref={canvasRootRef}
      className={classes}
      style={canvasStyle}
    >
      {appearance !== "reference" ? (
        <Dropdown
          trigger={[]}
          autoFocus
          open={contextMenuOpen}
          popupRender={(menu) => <div ref={contextMenuPopupRef}>{menu}</div>}
          onOpenChange={(open) => { if (!open) closeContextMenu(); }}
          menu={{
            items: CANVAS_LAYER_ACTIONS.map((action) => ({
              key: action,
              label: layerLabels[action],
              disabled: !onDraftChange || reorderCompositionLayers(draft, selectedItemIds, action) === draft,
            })),
            onClick: ({ key }) => {
              const action = CANVAS_LAYER_ACTIONS.find((action) => action === key);
              if (action && onDraftChange) onDraftChange(reorderCompositionLayers(draft, selectedItemIds, action));
              closeContextMenu();
            },
          }}
        >
          <span aria-hidden="true" style={{ position: "fixed", left: contextMenuPoint.x, top: contextMenuPoint.y, width: 1, height: 1, pointerEvents: "none" }} />
        </Dropdown>
      ) : null}
      {appearance === "reference" ? (
        renderCanvas()
      ) : (
        <InfiniteCanvasViewport
          onContextMenuRequest={openContextMenu}
          onCameraCenterChange={dismissContextMenu}
          className="human2ai-composition-canvas__viewport"
          defaultCameraCenter={{
            x: COMPOSITION_CANVAS.width / 2,
            y: COMPOSITION_CANVAS.height / 2,
          }}
          zoom={zoom}
          minimumZoom={MINIMUM_CANVAS_ZOOM}
          maximumZoom={MAXIMUM_CANVAS_ZOOM}
          fitRequest={fitRequest}
          contentBounds={contentBounds}
          backgroundPattern={backgroundPattern}
          showViewportControls={showViewportControls}
          sideActions={sideActions}
          sideActionPlacement={sideActionPlacement}
          sideActionPanelWidth={sideActionPanelWidth}
          sideActionPanelDefaultCollapsed={sideActionPanelDefaultCollapsed}
          labels={viewportLabels}
          onZoomChange={(nextZoom) => { dismissContextMenu(); onZoomChange?.(nextZoom); }}
          aria-label={`${ariaLabel}视口`}
        >
          {renderCanvas}
        </InfiniteCanvasViewport>
      )}
      {imagePaste.feedback}
      {appearance !== "reference" && editingTarget && editingItem ? (
        <Human2AiCanvasNodeEditor
          nodeKind={editingTarget.kind}
          metadata={editingItem}
          labels={nodeEditorLabels}
          disabled={!onDraftChange}
          leadingFields={
            editingArea && isCompositionTextRegion(editingArea) ? (
              <TextMarkEditorField label={areaEditorLabels.displayText}>
                <TextMarkEditorTextArea
                  name="displayText"
                  autoFocus
                  value={editingArea.displayText ?? ""}
                  placeholder={areaEditorLabels.displayTextPlaceholder}
                  aria-label={areaEditorLabels.displayText}
                  disabled={!onDraftChange}
                  onChange={(event) => {
                    if (!onDraftChange) return;
                    onDraftChange(updateAreaMetadata(draft, editingArea.id, {
                      displayText: event.target.value,
                    }));
                  }}
                />
              </TextMarkEditorField>
            ) : undefined
          }
          propertyFields={
            editingArea || editingImage ? (
              <>
                {editingArea && !isCompositionTextRegion(editingArea) ? (
                  <TextMarkEditorField label={areaEditorLabels.lightSource}>
                    <Switch
                      checked={editingArea.isLightSource ?? false}
                      aria-label={areaEditorLabels.lightSource}
                      disabled={!onDraftChange}
                      onChange={(isLightSource) => {
                        onDraftChange?.(updateAreaMetadata(draft, editingArea.id, { isLightSource }));
                      }}
                    />
                  </TextMarkEditorField>
                ) : null}
                <TextMarkEditorField label={areaEditorLabels.visualWeight}>
                  <Select
                    className="human2ai-canvas-node-editor__property-select"
                    value={(editingArea ?? editingImage)?.visualWeight}
                    options={visualWeightOptions}
                    aria-label={areaEditorLabels.visualWeight}
                    disabled={!onDraftChange}
                    onChange={(visualWeight: CompositionVisualWeight) => {
                      if (!onDraftChange) return;
                      onDraftChange(
                        editingArea
                          ? updateAreaMetadata(draft, editingArea.id, { visualWeight })
                          : updateCompositionImage(draft, editingImage!.id, { visualWeight }),
                      );
                    }}
                  />
                </TextMarkEditorField>
              </>
            ) : undefined
          }
          trailingFields={
            editingImage?.cameraReference && renderCameraReference ? renderCameraReference(editingImage) : editingImage ? (
              <CanvasImageEditorFields
                key={editingImage.id}
                src={
                  editingImage.assetId
                    ? resolveImageSource?.(editingImage.assetId)
                    : undefined
                }
                crop={editingImage.crop}
                aspectRatio={
                  (editingImage.width * COMPOSITION_CANVAS.width)
                  / (editingImage.height * COMPOSITION_CANVAS.height)
                }
                labels={imageEditorLabels}
                onReadFile={onReadImageFile}
                disabled={!onDraftChange || !onImageUpload}
                onUpload={async (file) => {
                  if (!onDraftChange || !onImageUpload) return;
                  const assetId = await onImageUpload(file);
                  const latest = latestDraftRef.current;
                  if (latest.interactionResetKey !== interactionResetKey
                    || !latest.draft.images.some(({ id }) => id === editingImage.id)) return;
                  latest.onDraftChange?.(updateCompositionImage(latest.draft, editingImage.id, {
                    assetId,
                    crop: null,
                  }));
                }}
                onCropChange={(crop, cropAspectRatio) => {
                  if (!onDraftChange) return;
                  const cropped = updateCompositionImage(draft, editingImage.id, { crop });
                  onDraftChange(resizeCompositionImage(
                    cropped,
                    editingImage.id,
                    editingImage.width,
                    (editingImage.width * COMPOSITION_CANVAS.width)
                      / (cropAspectRatio * COMPOSITION_CANVAS.height),
                  ));
                }}
              />
            ) : undefined
          }
          autoFocusField={
            editingArea && isCompositionTextRegion(editingArea) ? "none" : "note"
          }
          onMetadataChange={(patch) => {
            if (!onDraftChange) return;
            onDraftChange(updateItemMetadata(draft, editingTarget.id, patch));
          }}
          onRequestClose={closeItemEditor}
          onDelete={() => deleteItem(editingTarget.id)}
        />
      ) : null}
    </div>
  );
}

function centeredBounds(width: number, height: number): CanvasNodeBounds {
  return { x: -width / 2, y: -height / 2, width, height };
}

function TextRegionMarks({ width, height }: { width: number; height: number }) {
  const left = -width * 0.32;
  const lineWidths = [width * 0.64, width * 0.5, width * 0.58];
  const lineY = [-height * 0.18, 0, height * 0.18];
  return (
    <g className="human2ai-composition-canvas__text-region-marks" aria-hidden="true">
      {lineWidths.map((lineWidth, index) => (
        <line
          key={lineY[index]}
          x1={left}
          x2={left + lineWidth}
          y1={lineY[index]}
          y2={lineY[index]}
        />
      ))}
    </g>
  );
}

function areaNodeBounds(area: CompositionArea, geometry: AreaGeometry): CanvasNodeBounds {
  if (geometry.type === "circle") {
    return centeredBounds(geometry.radius * 2, geometry.radius * 2);
  }
  if (geometry.type === "ellipse") {
    return centeredBounds(geometry.radiusX * 2, geometry.radiusY * 2);
  }
  const width = area.primitive === "triangle" ? geometry.side ?? 0 : geometry.width ?? 0;
  return area.primitive === "triangle"
    ? { x: -width / 2, y: (-2 * geometry.height) / 3, width, height: geometry.height }
    : centeredBounds(width, geometry.height);
}

function areaOriginForBounds(area: CompositionArea, bounds: CanvasNodeBounds): Point {
  return area.primitive === "triangle"
    ? {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + (2 * bounds.height) / 3,
      }
    : {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
}

function DirectionLineItem({
  draft,
  label,
  selected,
  onSelect,
  onNudge,
  onDoubleClick,
  onDelete,
  bounds,
  tooltip,
}: {
  draft: CompositionDraft;
  label: string;
  selected: boolean;
  onSelect?: (id: string, event: CanvasNodeSelectEvent) => void;
  onNudge?: (id: string, delta: Point) => void;
  onDoubleClick?: (id: string, event: ReactMouseEvent<SVGGElement>) => void;
  onDelete?: (id: string) => void;
  bounds: CompositionFrameBounds;
  tooltip?: ReactNode;
}) {
  const directionLine = draft.directionLine;
  if (!directionLine) return null;
  const center = itemCenter(directionLine);
  return (
    <CanvasNode
      id={directionLine.id}
      label={`${label} ${directionLine.id}`}
      tooltip={tooltip}
      selected={selected}
      onSelect={onSelect}
      onNudge={onNudge ? (delta) => onNudge(directionLine.id, delta) : undefined}
      onDoubleClick={onDoubleClick}
      onDelete={onDelete ? () => onDelete(directionLine.id) : undefined}
      nudgeStep={0.01}
      largeNudgeStep={0.05}
      className="human2ai-composition-canvas__item human2ai-composition-canvas__direction"
      data-composition-item={directionLine.id}
    >
      <CanvasLine
        type="infinite"
        anchor={center}
        angle={directionLine.rotation}
        bounds={bounds}
        dashArray="10 8"
      />
    </CanvasNode>
  );
}

function DirectionInteractionHandles({
  directionLine,
  distance,
  screenScale,
  labels,
  onNudge,
}: {
  directionLine: DirectionLine;
  distance: number;
  screenScale: number;
  labels: readonly [string, string];
  onNudge: (pointIndex: number, delta: Point) => void;
}) {
  const resolvedScreenScale =
    screenScale > 0 && Number.isFinite(screenScale) ? screenScale : 1;
  const radius = 7 / resolvedScreenScale;
  const hitRadius = 12 / resolvedScreenScale;
  return (
    <g className="human2ai-composition-canvas__handles">
      {directionControlPoints(directionLine, distance).map((point, index) => (
        <g
          key={index}
          className="human2ai-composition-canvas__direction-control"
          data-item-id={directionLine.id}
          data-handle="move-direction-point"
          data-point-index={index}
          transform={`translate(${point.x} ${point.y})`}
          role="button"
          tabIndex={0}
          aria-label={labels[index]}
          aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
          onKeyDown={(event) => {
            const step = (event.shiftKey ? 10 : 1) / resolvedScreenScale;
            const delta: Partial<Record<string, Point>> = {
              ArrowLeft: { x: -step, y: 0 },
              ArrowRight: { x: step, y: 0 },
              ArrowUp: { x: 0, y: -step },
              ArrowDown: { x: 0, y: step },
            };
            if (!delta[event.key]) return;
            event.preventDefault();
            event.stopPropagation();
            onNudge(index, delta[event.key]!);
          }}
        >
          <circle className="human2ai-composition-canvas__transform-handle" r={radius} />
          <circle className="human2ai-composition-canvas__transform-hit" r={hitRadius} />
        </g>
      ))}
    </g>
  );
}

function directionControlPoints(directionLine: DirectionLine, distance: number): [Point, Point] {
  const center = itemCenter(directionLine);
  return [
    pointAt(center, directionLine.rotation, -distance / 2),
    pointAt(center, directionLine.rotation, distance / 2),
  ];
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function toggleIds(sourceIds: readonly string[], toggledIds: readonly string[]): string[] {
  const toggled = new Set(toggledIds);
  return [
    ...sourceIds.filter((id) => !toggled.has(id)),
    ...toggledIds.filter((id) => !sourceIds.includes(id)),
  ];
}

function moveItemsByDelta(
  draft: CompositionDraft,
  ids: readonly string[],
  delta: Point,
): CompositionDraft {
  return ids.reduce((nextDraft, id) => {
    const item = findItem(draft, id);
    return item
      ? moveItem(nextDraft, id, { x: item.x + delta.x, y: item.y + delta.y })
      : nextDraft;
  }, draft);
}

function removeItems(draft: CompositionDraft, ids: readonly string[]): CompositionDraft {
  return ids.reduce(
    (nextDraft, id) => findItem(nextDraft, id) ? removeItem(nextDraft, id) : nextDraft,
    draft,
  );
}

function resizeItemsToBounds(
  draft: CompositionDraft,
  ids: readonly string[],
  sourceBounds: CompositionFrameBounds,
  nextBounds: CompositionFrameBounds,
  scaleX: number,
  scaleY: number,
  proportional: boolean,
): CompositionDraft {
  return ids.reduce((nextDraft, id) => {
    const item = findItem(draft, id);
    if (!item) return nextDraft;
    const sourceCenter = itemCenter(item);
    const targetCenter = {
      x: nextBounds.x + (sourceCenter.x - sourceBounds.x) * scaleX,
      y: nextBounds.y + (sourceCenter.y - sourceBounds.y) * scaleY,
    };
    let resized = moveItem(nextDraft, id, {
      x: targetCenter.x / COMPOSITION_CANVAS.width,
      y: targetCenter.y / COMPOSITION_CANVAS.height,
    });
    const area = draft.areas.find((candidate) => candidate.id === id);
    if (area) {
      const geometry = areaGeometry(area, COMPOSITION_CANVAS);
      const bounds = areaNodeBounds(area, geometry);
      resized = proportional
        ? resizeArea(resized, id, area.area * scaleX * scaleY)
        : resizeFreeArea(
            resized,
            id,
            (bounds.width * scaleX) / COMPOSITION_CANVAS.width,
            (bounds.height * scaleY) / COMPOSITION_CANVAS.height,
      );
    }
    const image = draft.images.find((candidate) => candidate.id === id);
    if (image) {
      resized = resizeCompositionImage(
        resized,
        id,
        image.width * scaleX,
        image.height * scaleY,
      );
    }
    const direction = draft.directionLine?.id === id ? draft.directionLine : null;
    if (direction && scaleX !== scaleY) {
      const radians = (direction.rotation * Math.PI) / 180;
      resized = rotateDirectionLine(
        resized,
        id,
        (Math.atan2(Math.sin(radians) * scaleY, Math.cos(radians) * scaleX) * 180) /
          Math.PI,
      );
    }
    return resized;
  }, draft);
}

function groupResizeSignature(
  ids: readonly string[],
  bounds: CompositionFrameBounds,
): string {
  return JSON.stringify([ids, bounds.x, bounds.y, bounds.width, bounds.height]);
}

function rectangleFromPoints(start: Point, end: Point): CompositionFrameBounds {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function boundsForItems(
  draft: CompositionDraft,
  ids: readonly string[],
): CompositionFrameBounds | null {
  const bounds = ids
    .map((id) => boundsForItem(draft, id))
    .filter((item): item is CompositionFrameBounds => Boolean(item));
  if (bounds.length === 0) return null;
  const minimumX = Math.min(...bounds.map((item) => item.x));
  const minimumY = Math.min(...bounds.map((item) => item.y));
  const maximumX = Math.max(...bounds.map((item) => item.x + item.width));
  const maximumY = Math.max(...bounds.map((item) => item.y + item.height));
  return {
    x: minimumX,
    y: minimumY,
    width: Math.max(1, maximumX - minimumX),
    height: Math.max(1, maximumY - minimumY),
  };
}

function boundsForItem(
  draft: CompositionDraft,
  id: string,
): CompositionFrameBounds | null {
  const area = draft.areas.find((item) => item.id === id);
  if (area) return boundsForArea(area);
  const image = draft.images.find((item) => item.id === id);
  if (image) return compositionImageBoundsForCanvas(image);
  const focus = draft.focusPoints.find((item) => item.id === id);
  if (focus) {
    const center = itemCenter(focus);
    return { x: center.x - 20, y: center.y - 20, width: 40, height: 40 };
  }
  if (draft.directionLine?.id === id) {
    const center = itemCenter(draft.directionLine);
    return { x: center.x - 12, y: center.y - 12, width: 24, height: 24 };
  }
  return null;
}

function boundsForArea(area: CompositionArea): CompositionFrameBounds {
  const geometry = areaGeometry(area, COMPOSITION_CANVAS);
  if (geometry.type === "circle") {
    return {
      x: geometry.cx - geometry.radius,
      y: geometry.cy - geometry.radius,
      width: geometry.radius * 2,
      height: geometry.radius * 2,
    };
  }
  if (geometry.type === "ellipse") {
    return {
      x: geometry.cx - geometry.radiusX,
      y: geometry.cy - geometry.radiusY,
      width: geometry.radiusX * 2,
      height: geometry.radiusY * 2,
    };
  }
  const minimumX = Math.min(...geometry.points.map((point) => point.x));
  const minimumY = Math.min(...geometry.points.map((point) => point.y));
  const maximumX = Math.max(...geometry.points.map((point) => point.x));
  const maximumY = Math.max(...geometry.points.map((point) => point.y));
  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX,
    height: maximumY - minimumY,
  };
}

function itemsIntersectingBounds(
  draft: CompositionDraft,
  bounds: CompositionFrameBounds,
): string[] {
  if (bounds.width < 2 && bounds.height < 2) return [];
  const areaIds = draft.areas
    .filter((area) => rectanglesIntersect(boundsForArea(area), bounds))
    .map((area) => area.id);
  const imageIds = draft.images
    .filter((image) => rectanglesIntersect(compositionImageBoundsForCanvas(image), bounds))
    .map((image) => image.id);
  const focusIds = draft.focusPoints
    .filter((focus) => {
      const focusBounds = boundsForItem(draft, focus.id);
      return focusBounds ? rectanglesIntersect(focusBounds, bounds) : false;
    })
    .map((focus) => focus.id);
  const directionIds = draft.directionLine && infiniteLineIntersectsBounds(draft.directionLine, bounds)
    ? [draft.directionLine.id]
    : [];
  return [...imageIds, ...areaIds, ...directionIds, ...focusIds];
}

function rectanglesIntersect(
  first: CompositionFrameBounds,
  second: CompositionFrameBounds,
): boolean {
  return !(
    first.x + first.width < second.x ||
    second.x + second.width < first.x ||
    first.y + first.height < second.y ||
    second.y + second.height < first.y
  );
}

function infiniteLineIntersectsBounds(
  direction: DirectionLine,
  bounds: CompositionFrameBounds,
): boolean {
  const center = itemCenter(direction);
  const radians = (direction.rotation * Math.PI) / 180;
  const normal = { x: -Math.sin(radians), y: Math.cos(radians) };
  const distances = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x, y: bounds.y + bounds.height },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
  ].map((point) =>
    (point.x - center.x) * normal.x + (point.y - center.y) * normal.y,
  );
  return Math.min(...distances) <= 0 && Math.max(...distances) >= 0;
}

function findItem(draft: CompositionDraft, id: string): CompositionItem | null {
  return (
    draft.areas.find((item) => item.id === id) ??
    draft.images.find((item) => item.id === id) ??
    draft.focusPoints.find((item) => item.id === id) ??
    (draft.directionLine?.id === id ? draft.directionLine : null)
  );
}

function compositionImageBoundsForCanvas(image: CompositionImage): CompositionFrameBounds {
  const width = image.width * COMPOSITION_CANVAS.width;
  const height = image.height * COMPOSITION_CANVAS.height;
  const radians = (image.rotation * Math.PI) / 180;
  const rotatedWidth = Math.abs(width * Math.cos(radians))
    + Math.abs(height * Math.sin(radians));
  const rotatedHeight = Math.abs(width * Math.sin(radians))
    + Math.abs(height * Math.cos(radians));
  const center = itemCenter(image);
  return {
    x: center.x - rotatedWidth / 2,
    y: center.y - rotatedHeight / 2,
    width: rotatedWidth,
    height: rotatedHeight,
  };
}

function itemCenter(item: Point): Point {
  return {
    x: item.x * COMPOSITION_CANVAS.width,
    y: item.y * COMPOSITION_CANVAS.height,
  };
}

function canvasPoint(
  event: ReactPointerEvent<SVGSVGElement>,
  svg: SVGSVGElement,
): Point {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x: 0, y: 0 };
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

function capturePointer(element: SVGSVGElement, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Synthetic Storybook pointer events may not create a capturable browser pointer.
  }
}

function pointAt(center: Point, degrees: number, distanceFromCenter: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: center.x + Math.cos(radians) * distanceFromCenter,
    y: center.y + Math.sin(radians) * distanceFromCenter,
  };
}

function rotateVector(vector: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: vector.x * cosine - vector.y * sine,
    y: vector.x * sine + vector.y * cosine,
  };
}

function compositionPlacementOptions(tool: CompositionPlacementTool): CanvasPlacementTool {
  if (tool === "focus") return { shape: "point", width: 16, height: 16, clickOnly: true };
  if (tool === "direction") return { shape: "line", width: 160, height: 8 };
  if (tool === "image") return { shape: "rectangle", width: 320, height: 180 };
  const added = tool === "text"
    ? addTextRegion(createDraft())
    : addArea(createDraft(), { primitive: tool, aspect: tool === "quadrilateral" ? "free" : "square" });
  const area = added.draft.areas[0]!;
  const bounds = areaNodeBounds(area, areaGeometry(area, COMPOSITION_CANVAS));
  return {
    shape: tool === "circle" ? "ellipse" : tool === "triangle" ? "triangle" : "rectangle",
    width: bounds.width,
    height: bounds.height,
  };
}
