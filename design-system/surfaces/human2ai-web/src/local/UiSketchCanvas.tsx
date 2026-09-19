"use client";

import {
  BorderOutlined,
  CopyOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FontSizeOutlined,
  MinusOutlined,
  PictureOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { CompositeButton } from "@human2ai/ui/yisiui/composite-button";
import { ConfirmAction } from "@human2ai/ui/yisiui/confirm-action";
import {
  TextMarkEditor,
  TextMarkEditorField,
  TextMarkEditorTextArea,
} from "@human2ai/ui/yisiui/text-mark-editor";
import { Dropdown, Input, Popover, Select, Switch, Tooltip } from "antd";
import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";

import { useCanvasContextMenu, DEFAULT_CANVAS_LAYER_LABELS, type CanvasLayerLabels } from "./useCanvasContextMenu";
import { CANVAS_LAYER_ACTIONS, sortCanvasLayers } from "../../../../../src/domain/canvas-layer-order.ts";
import { reorderUiSketchLayers } from "./uiSketchDraft";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import { CanvasFrame, type CanvasFrameMoveChange } from "./CanvasFrame";
import { CanvasImage } from "./CanvasImage";
import {
  CanvasImageEditorFields,
  type CanvasImageEditorLabels,
} from "./CanvasImageEditorFields";
import {
  CanvasNode,
  type CanvasNodeBounds,
  type CanvasNodeResizeChange,
  type CanvasNodeSelectEvent,
} from "./CanvasNode";
import { CanvasScene } from "./CanvasScene";
import { CanvasShape } from "./CanvasShape";
import { CanvasText, type CanvasTextBounds } from "./CanvasText";
import { InfiniteCanvasViewport } from "./InfiniteCanvasViewport";
import { useCanvasImagePaste } from "./useCanvasImagePaste";
import {
  buildAllUiSketchStagesPrompt,
  buildUiSketchPrompt,
  copyUiSketchPng,
  type SketchCopyResult,
  type UiSketchPromptTranslator,
  uiSketchTextBounds,
} from "./uiSketchExport";
import {
  cloneUiSketchDraft,
  groupUiSketchItems,
  ungroupUiSketchItems,
  uiSketchSelectionWithGroups,
  retainUiSketchGroups,
  EMPTY_UI_SKETCH_DRAFT,
  UI_SKETCH_START_STAGE_ID,
  uiSketchDraftForStage,
  uiSketchStateTabs,
  updateUiSketchImageCrop,
  updateUiSketchStageDraft,
  type UiSketchBounds,
  type UiSketchRectangle,
  type UiSketchDraft,
  type UiSketchImage,
  type UiSketchNodeOrigin,
  type UiSketchText,
  type UiSketchVisualWeight,
} from "./uiSketchDraft";

import { CanvasPlacement, type CanvasPlacementResult, type CanvasPlacementTool } from "./CanvasPlacement";

import "./UiSketchCanvas.css";
import "./Human2AiCanvasNodeEditor.css";

const FRAME_KEY = "frame:ui";
const MINIMUM_FRAME_WIDTH = 10;
const MINIMUM_FRAME_HEIGHT = 10;
const MINIMUM_TEXT_FONT_SIZE = 8;
const DEFAULT_TEXT_FONT_SIZE = 14;
const NOTICE_DURATION_MS = 2_000;

type UiSketchItemKind = "rectangle" | "text" | "image";
type UiSketchItemKey = `${UiSketchItemKind}:${string}`;
type UiSketchLayerKey = typeof FRAME_KEY | UiSketchItemKey;

const PLACEMENT_TOOLS: Record<UiSketchItemKind, CanvasPlacementTool> = {
  rectangle: { shape: "rectangle", width: 280, height: 108 },
  image: { shape: "rectangle", width: 320, height: 180 },
  text: { shape: "rectangle", width: 84, height: 20, clickOnly: true },
};

type PointerInteraction =
  | {
      type: "move-items";
      pointerId: number;
      keys: UiSketchItemKey[];
      scene: SVGSVGElement;
      previewElements: SVGGraphicsElement[];
      delta: Point;
      animationFrame: number | null;
      start: Point;
      startClient: Point;
      moved: boolean;
    }
  | {
      type: "marquee";
      pointerId: number;
      start: Point;
      startClient: Point;
      moved: boolean;
      sourceSelectedKeys: UiSketchItemKey[];
      additive: boolean;
    };

interface Point {
  x: number;
  y: number;
}

interface TextMeasurement {
  text: string;
  fontSize: number;
  width: number;
  height: number;
}

type TextMeasurements = Record<string, TextMeasurement>;

interface TextResizeSource {
  signature: string;
  fontSize: number;
}

type UiSketchEditorDraft =
  | { kind: "rectangle"; item: UiSketchRectangle }
  | { kind: "text"; item: UiSketchText }
  | { kind: "image"; item: UiSketchImage };

export interface UiSketchCanvasLabels extends CanvasLayerLabels {
  canvas: string;
  canvasViewport: string;
  scene: string;
  region: string;
  addRegion: string;
  text: string;
  addText: string;
  image: string;
  addImage: string;
  newText: string;
  overallNote: string;
  clearCanvas: string;
  clearCanvasConfirmTitle: string;
  clearCanvasConfirmDescription: string;
  clearCanvasCancel: string;
  groupItems: string;
  ungroupItems: string;
  copyGroup: string;
  copyPrompt: string;
  copySketch: string;
  copyAllStages: string;
  overallNoteTitle: string;
  overallNotePlaceholder: string;
  overallNoteAriaLabel: string;
  fitFrame: string;
  interactionHelp: string;
  sideActions: string;
  collapseSideActions: string;
  expandSideActions: string;
  frameAction: string;
  frameRange: string;
  missingRegionNote: string;
  editRegionNote: string;
  editText: string;
  nodeDescription: string;
  originUser: string;
  originAgent: string;
  originImport: string;
  note: string;
  textContent: string;
  regionPlaceholder: string;
  textPlaceholder: string;
  textNotePlaceholder: string;
  imageNotePlaceholder: string;
  shapeKind: string;
  emptyText: string;
  visualWeight: string;
  visibility: string;
  visible: string;
  hidden: string;
  weightAuto: string;
  weightHigh: string;
  weightMedium: string;
  weightLow: string;
  weightDecorative: string;
  fontSize: string;
  decreaseFontSize: string;
  increaseFontSize: string;
  cancel: string;
  deleteRegion: string;
  deleteText: string;
  deleteNode: string;
  confirmDeleteRegion: string;
  confirmDeleteText: string;
  confirmDeleteNode: string;
  cancelDelete: string;
  promptUnsupported: string;
  promptCopied: string;
  promptCopyFailed: string;
  sketchCopied: string;
  sketchDownloaded: string;
  sketchCopyFailed: string;
  selectedItemsPrefix: string;
  selectedItemsSuffix: string;
  noSelection: string;
}

const DEFAULT_LABELS: UiSketchCanvasLabels = {
  ...DEFAULT_CANVAS_LAYER_LABELS,
  canvas: "UI 界面画布",
  canvasViewport: "UI 界面无限画布",
  scene: "UI 界面场景",
  region: "区域",
  addRegion: "添加区域",
  text: "文字",
  addText: "添加文字",
  image: "图片",
  addImage: "添加图片",
  newText: "文字",
  overallNote: "全局备注",
  clearCanvas: "清空画布",
  clearCanvasConfirmTitle: "确认清空画布？",
  clearCanvasConfirmDescription: "将移除全部区域、文字和图片。",
  clearCanvasCancel: "取消",
  groupItems: "建组",
  ungroupItems: "解组",
  copyGroup: "复制",
  copyPrompt: "复制提示词",
  copySketch: "复制预览图",
  copyAllStages: "动效",
  overallNoteTitle: "对整个界面的要求",
  overallNotePlaceholder: "例如：整体保持安静，突出当前任务和主要操作",
  overallNoteAriaLabel: "UI 界面的全局备注",
  fitFrame: "适应界面范围",
  interactionHelp: "选择节点工具后，单击放置；形状和图片可拖动确定尺寸；Esc 取消。滚轮缩放；按住右键，或空格键加左键拖动画布。",
  sideActions: "UI 界面操作",
  collapseSideActions: "收起 UI 界面操作",
  expandSideActions: "展开 UI 界面操作",
  frameAction: "移动或调整界面范围",
  frameRange: "界面范围",
  missingRegionNote: "未填写备注",
  editRegionNote: "编辑区域信息",
  editText: "编辑文字",
  nodeDescription: "节点说明",
  originUser: "user",
  originAgent: "agent",
  originImport: "import",
  note: "备注",
  textContent: "显示文字",
  regionPlaceholder: "这个区域表达什么布局内容",
  textPlaceholder: "输入文字",
  textNotePlaceholder: "这段文字表达什么",
  imageNotePlaceholder: "说明这个图片节点表达什么",
  shapeKind: "形状",
  emptyText: "---文字未输入---",
  visualWeight: "视觉权重",
  visibility: "显示状态",
  visible: "显示",
  hidden: "隐藏",
  weightAuto: "自动",
  weightHigh: "高",
  weightMedium: "中",
  weightLow: "低",
  weightDecorative: "装饰",
  fontSize: "字号",
  decreaseFontSize: "减小字号",
  increaseFontSize: "增大字号",
  cancel: "取消",
  deleteRegion: "删除区域",
  deleteText: "删除文字",
  deleteNode: "删除节点",
  confirmDeleteRegion: "确认删除这个区域？",
  confirmDeleteText: "确认删除这段文字？",
  confirmDeleteNode: "确认删除这个节点？",
  cancelDelete: "保留",
  promptUnsupported: "当前浏览器不支持复制提示词。",
  promptCopied: "复制成功",
  promptCopyFailed: "复制提示词失败。",
  sketchCopied: "复制成功",
  sketchDownloaded: "浏览器不支持复制图片，预览图已下载",
  sketchCopyFailed: "复制预览图失败。",
  selectedItemsPrefix: "已选择 ",
  selectedItemsSuffix: " 个元素",
  noSelection: "未选择元素",
};

export interface UiSketchCanvasProps {
  interactionResetKey?: number;
  draft: UiSketchDraft;
  activeStageId?: string;
  onDraftChange?: (draft: UiSketchDraft) => void;
  writePrompt?: (content: string) => Promise<void>;
  writeSketch?: (draft: UiSketchDraft) => Promise<SketchCopyResult | void>;
  translatePrompt: UiSketchPromptTranslator;
  resolveStylePrompt?: () => Promise<string | undefined>;
  toolHost?: HTMLElement | null;
  clearActionHost?: HTMLElement | null;
  showCanvasTools?: boolean;
  canvasSideActionPanelDefaultCollapsed?: boolean;
  interfaceFrameLocked?: boolean;
  labels?: Partial<UiSketchCanvasLabels>;
  imageEditorLabels?: Partial<CanvasImageEditorLabels>;
  resolveImageSource?: (assetId: string) => string | undefined;
  onImageUpload?: (file: File) => Promise<string>;
  onReadImageFile?: (src: string) => Promise<File>;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

type Notice = { type: "success" | "warning" | "error"; message: string } | null;

export function UiSketchCanvas({
  interactionResetKey,
  draft,
  activeStageId = UI_SKETCH_START_STAGE_ID,
  onDraftChange,
  writePrompt,
  writeSketch,
  translatePrompt,
  resolveStylePrompt,
  toolHost = null,
  clearActionHost = null,
  showCanvasTools = true,
  canvasSideActionPanelDefaultCollapsed = false,
  interfaceFrameLocked = false,
  labels: labelOverrides,
  imageEditorLabels: imageEditorLabelOverrides,
  resolveImageSource,
  onImageUpload,
  onReadImageFile,
  className,
  style,
  "aria-label": ariaLabel,
}: UiSketchCanvasProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const imageEditorLabels = {
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
    ...imageEditorLabelOverrides,
  } satisfies CanvasImageEditorLabels;
  const fontSizeLabelId = useId();
  const state = useMemo(
    () => uiSketchDraftForStage(draft, activeStageId),
    [activeStageId, draft],
  );
  const [placementTool, setPlacementTool] = useState<UiSketchItemKind | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<UiSketchLayerKey[]>([]);
  const [editingKey, setEditingKey] = useState<UiSketchItemKey | null>(null);
  const [editorDraft, setEditorDraft] = useState<UiSketchEditorDraft | null>(null);
  const [overallNoteOpen, setOverallNoteOpen] = useState(false);
  const [marqueeBounds, setMarqueeBounds] = useState<UiSketchBounds | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [copyingPrompt, setCopyingPrompt] = useState(false);
  const [copyingSketch, setCopyingSketch] = useState(false);
  const [openCopyMenu, setOpenCopyMenu] = useState<"prompt" | "sketch" | null>(null);
  const { contextMenuOpen, contextMenuPoint, contextMenuPopupRef, openContextMenuAt, closeContextMenu, dismissContextMenu } = useCanvasContextMenu();
  const [textMeasurements, setTextMeasurements] = useState<TextMeasurements>({});
  const [controlsHost, setControlsHost] = useState<SVGGElement | null>(null);
  const interactionRef = useRef<PointerInteraction | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const textResizeSourceRef = useRef<TextResizeSource | null>(null);
  const suppressClickRef = useRef(false);
  const suppressItemSelectionRef = useRef(false);
  const stateTabs = uiSketchStateTabs(draft);
  const motionSketchEnabled = stateTabs.length > 1;
  const visualWeightOptions: Array<{
    value: UiSketchVisualWeight;
    label: string;
  }> = [
    { value: "auto", label: labels.weightAuto },
    { value: "high", label: labels.weightHigh },
    { value: "medium", label: labels.weightMedium },
    { value: "low", label: labels.weightLow },
    { value: "decorative", label: labels.weightDecorative },
  ];
  const selectedItemKeys = selectedKeys.filter(isItemKey);
  const selectedItemKeySet = new Set(selectedItemKeys);
  const multiSelectionBounds = selectedItemKeys.length > 1
    ? boundsForItems(state, selectedItemKeys, textMeasurements)
    : null;
  const editingItem = editingKey ? itemForKey(state, editingKey) : null;
  const latestImageUpdateRef = useRef({ updateImage, interactionResetKey });
  useLayoutEffect(() => { latestImageUpdateRef.current = { updateImage, interactionResetKey }; });
  const imagePaste = useCanvasImagePaste({
    disabled: !onDraftChange || Boolean(editingKey) || overallNoteOpen,
    resetKey: `${interactionResetKey}:${activeStageId}`,
    labels: imageEditorLabels,
    onUpload: onImageUpload,
    onImageReady: ({ assetId, x, y, width, height }) => {
      addImage({ x: x - width / 2, y: y - height / 2, width, height }, assetId);
      setPlacementTool(null);
    },
  });
  const selectedIds = selectedItemKeys.map(keyId);
  const selectedGroups = state.groups.filter((group) => (
    group.itemIds.some((id) => selectedIds.includes(id))
  ));
  const canGroup = selectedIds.length >= 2 && !state.groups.some((group) => (
    group.itemIds.length === selectedIds.length && group.itemIds.every((id) => selectedIds.includes(id))
  ));

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!motionSketchEnabled) setOpenCopyMenu(null);
  }, [motionSketchEnabled]);

  useLayoutEffect(() => {
    if (interactionResetKey === undefined) return;
    const interaction = interactionRef.current;
    if (interaction?.type === "move-items") clearMovePreview(interaction);
    interactionRef.current = null;
    setSelectedKeys([]);
    setEditingKey(null);
    setEditorDraft(null);
    setPlacementTool(null);
    setOverallNoteOpen(false);
    setMarqueeBounds(null);
    dismissContextMenu();
  }, [interactionResetKey]);

  useLayoutEffect(() => {
    setPlacementTool(null);
    dismissContextMenu();
  }, [activeStageId]);

  useLayoutEffect(() => () => {
    const interaction = interactionRef.current;
    if (interaction?.type === "move-items") {
      clearMovePreview(interaction);
      interactionRef.current = null;
    }
  }, [activeStageId]);

  function updateDraft(
    update: UiSketchDraft | ((current: UiSketchDraft) => UiSketchDraft),
  ): void {
    if (!onDraftChange) return;
    const nextStageDraft = typeof update === "function" ? update(state) : update;
    onDraftChange(updateUiSketchStageDraft(draft, activeStageId, nextStageDraft));
  }

  function armPlacement(tool: UiSketchItemKind): void {
    closeEditor();
    setOverallNoteOpen(false);
    setPlacementTool((current) => current === tool ? null : tool);
  }

  function placeNode({ bounds }: CanvasPlacementResult): void {
    if (placementTool === "rectangle") addRectangle(bounds);
    if (placementTool === "image") addImage(bounds);
    if (placementTool === "text") addText(bounds);
    setPlacementTool(null);
    suppressClickRef.current = true;
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
  }

  function addRectangle(bounds: UiSketchBounds): void {
    updateDraft((current) => {
      const rectangle: UiSketchRectangle = {
        id: createId("rectangle"),
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        note: "",
        annotation: "",
        semanticType: "",
        origin: "user",
        visible: true,
        weight: "auto",
      };
      setSelectedKeys([itemKey("rectangle", rectangle.id)]);
      return { ...current, rectangles: [...current.rectangles, rectangle] };
    });
  }

  function addText(bounds: UiSketchBounds): void {
    updateDraft((current) => {
      const text: UiSketchText = {
        id: createId("text"),
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        text: labels.newText,
        fontSize: DEFAULT_TEXT_FONT_SIZE,
        note: "",
        annotation: "",
        semanticType: "",
        origin: "user",
        visible: true,
        weight: "auto",
      };
      setSelectedKeys([itemKey("text", text.id)]);
      setEditingKey(itemKey("text", text.id));
      setEditorDraft({ kind: "text", item: text });
      return { ...current, texts: [...current.texts, text] };
    });
  }

  function addImage(bounds: UiSketchBounds, assetId: string | null = null): void {
    updateDraft((current) => {
      const image: UiSketchImage = {
        id: createId("image"),
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        note: "",
        annotation: "",
        semanticType: "",
        origin: "user",
        visible: true,
        weight: "auto",
        assetId,
        crop: null,
      };
      setSelectedKeys([itemKey("image", image.id)]);
      return { ...current, images: [...current.images, image] };
    });
  }

  function selectItem(key: UiSketchItemKey, event: CanvasNodeSelectEvent): void {
    if (suppressItemSelectionRef.current) {
      suppressItemSelectionRef.current = false;
      return;
    }
    setSelectedKeys(
      event.shiftKey
        ? toggleKeys(selectedItemKeys, selectionWithGroups(state, [key]))
        : selectionWithGroups(state, [key]),
    );
  }

  function openContextMenu(request: { clientX: number; clientY: number; target: EventTarget | null }): void {
    if (!(request.target instanceof Element)) return;
    const node = request.target.closest<SVGGElement>("[data-ui-sketch-item]");
    const key = node?.dataset.uiSketchItem;
    if (key && isItemKey(key) && !selectedItemKeySet.has(key)) {
      setSelectedKeys(selectionWithGroups(state, [key]));
    } else if (request.target.closest("[data-canvas-frame]")) {
      setSelectedKeys([FRAME_KEY]);
    }
    openContextMenuAt(request, node ?? workspaceRef.current?.querySelector<SVGSVGElement>("[data-ui-sketch-scene]") ?? null);
  }

  function nudgeItem(key: UiSketchItemKey, delta: Point): void {
    const keys = selectedItemKeys.length > 1 && selectedItemKeySet.has(key)
      ? selectedItemKeys
      : selectionWithGroups(state, [key]);
    updateDraft((current) => (
      moveItemsByDelta(current, keys, delta)
    ));
  }

  function deleteItem(key: UiSketchItemKey): void {
    const keys = selectedItemKeys.length > 1 && selectedItemKeySet.has(key)
      ? selectedItemKeys
      : selectionWithGroups(state, [key]);
    deleteItems(keys);
  }

  function deleteItems(keys: UiSketchItemKey[]): void {
    updateDraft((current) => removeItems(current, keys));
    setSelectedKeys([]);
    setEditingKey(null);
    setEditorDraft(null);
  }

  function updateFrame(change: CanvasNodeResizeChange): void {
    updateDraft((current) => ({
      ...current,
      frame: {
        x: Math.round(change.sourcePosition.x + change.bounds.x),
        y: Math.round(change.sourcePosition.y + change.bounds.y),
        width: Math.max(MINIMUM_FRAME_WIDTH, Math.round(change.bounds.width)),
        height: Math.max(MINIMUM_FRAME_HEIGHT, Math.round(change.bounds.height)),
      },
    }));
  }

  function moveFrame(change: CanvasFrameMoveChange): void {
    updateDraft((current) => ({
      ...current,
      frame: {
        ...current.frame,
        x: Math.round(change.bounds.x),
        y: Math.round(change.bounds.y),
      },
    }));
  }

  function clearCanvas(): void {
    setPlacementTool(null);
    updateDraft((current) => ({
      ...current,
      rectangles: [],
      texts: [],
      images: [],
      groups: [],
    }));
    setSelectedKeys([]);
    setEditingKey(null);
    setEditorDraft(null);
    setTextMeasurements({});
  }

  function updateRectangle(id: string, patch: Partial<UiSketchRectangle>): void {
    updateDraft((current) => ({
      ...current,
      rectangles: current.rectangles.map((rectangle) => (
        rectangle.id === id ? { ...rectangle, ...patch } : rectangle
      )),
    }));
  }

  function updateText(id: string, patch: Partial<UiSketchText>): void {
    updateDraft((current) => ({
      ...current,
      texts: current.texts.map((text) => (
        text.id === id ? { ...text, ...patch } : text
      )),
    }));
  }

  function updateImage(id: string, patch: Partial<UiSketchImage>): void {
    updateDraft((current) => ({
      ...current,
      images: current.images.map((image) => (
        image.id === id ? { ...image, ...patch } : image
      )),
    }));
  }

  function openEditor(key: UiSketchItemKey): void {
    const item = itemForKey(state, key);
    if (!item) return;
    setEditingKey(key);
    if (item.kind === "rectangle") {
      setEditorDraft({ kind: "rectangle", item: { ...item.item } });
    } else if (item.kind === "text") {
      setEditorDraft({ kind: "text", item: { ...item.item } });
    } else {
      setEditorDraft({
        kind: "image",
        item: { ...item.item, crop: item.item.crop ? { ...item.item.crop } : null },
      });
    }
  }

  function closeEditor(): void {
    setEditingKey(null);
    setEditorDraft(null);
  }

  function updateEditorMetadata(
    patch: Partial<Pick<
      UiSketchRectangle,
      "note" | "visible" | "weight"
    >>,
  ): void {
    if (!editorDraft) return;
    setEditorDraft((current) => {
      if (!current) return null;
      if (current.kind === "rectangle") {
        return { ...current, item: { ...current.item, ...patch } };
      }
      if (current.kind === "text") {
        return { ...current, item: { ...current.item, ...patch } };
      }
      return { ...current, item: { ...current.item, ...patch } };
    });
    if (editorDraft.kind === "rectangle") updateRectangle(editorDraft.item.id, patch);
    else if (editorDraft.kind === "text") updateText(editorDraft.item.id, patch);
    else updateImage(editorDraft.item.id, patch);
  }

  function updateEditorText(
    patch: Partial<Pick<UiSketchText, "text" | "fontSize">>,
  ): void {
    if (editorDraft?.kind !== "text") return;
    setEditorDraft((current) => (
      current?.kind === "text"
        ? { ...current, item: { ...current.item, ...patch } }
        : current
    ));
    updateText(editorDraft.item.id, patch);
  }

  function resizeRectangle(id: string, change: CanvasNodeResizeChange): void {
    updateRectangle(id, {
      x: Math.round(change.sourcePosition.x + change.bounds.x),
      y: Math.round(change.sourcePosition.y + change.bounds.y),
      width: Math.max(8, Math.round(change.bounds.width)),
      height: Math.max(8, Math.round(change.bounds.height)),
    });
  }

  function resizeImage(id: string, change: CanvasNodeResizeChange): void {
    updateImage(id, {
      x: change.sourcePosition.x + change.bounds.x,
      y: change.sourcePosition.y + change.bounds.y,
      width: Math.max(8, change.bounds.width),
      height: Math.max(8, change.bounds.height),
    });
  }

  function resizeText(
    id: string,
    source: UiSketchText,
    change: CanvasNodeResizeChange,
  ): void {
    const signature = textResizeSignature(id, source.text, change);
    if (textResizeSourceRef.current?.signature !== signature) {
      textResizeSourceRef.current = {
        signature,
        fontSize: source.fontSize,
      };
    }
    const scale = change.bounds.width / Math.max(1, change.sourceBounds.width);
    updateText(id, {
      x: Math.round(change.sourcePosition.x + change.bounds.x),
      y: Math.round(change.sourcePosition.y + change.bounds.y),
      fontSize: Math.max(
        MINIMUM_TEXT_FONT_SIZE,
        Math.round(textResizeSourceRef.current.fontSize * scale),
      ),
    });
  }

  function recordTextMeasurement(
    source: UiSketchText,
    bounds: CanvasTextBounds,
  ): void {
    setTextMeasurements((current) => {
      const previous = current[source.id];
      if (
        previous
        && previous.text === source.text
        && previous.fontSize === source.fontSize
        && Math.abs(previous.width - bounds.width) < 0.01
        && Math.abs(previous.height - bounds.height) < 0.01
      ) {
        return current;
      }
      return {
        ...current,
        [source.id]: {
          text: source.text,
          fontSize: source.fontSize,
          width: bounds.width,
          height: bounds.height,
        },
      };
    });
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>): void {
    if (!(event.target instanceof Element) || event.button !== 0) return;
    if (
      event.target.closest("[data-resize-handle]")
      || event.target.closest("[data-canvas-frame]")
    ) {
      return;
    }
    suppressClickRef.current = false;
    suppressItemSelectionRef.current = false;
    const point = worldPoint(event, event.currentTarget);
    const itemElement = event.target.closest<SVGGElement>("[data-ui-sketch-item]");
    const key = itemElement?.dataset.uiSketchItem;

    if (key && isItemKey(key) && itemForKey(state, key)) {
      if (!onDraftChange) return;
      const moveKeys = selectedItemKeySet.has(key)
        ? selectedItemKeys
        : selectionWithGroups(state, [key]);
      interactionRef.current = {
        type: "move-items",
        pointerId: event.pointerId,
        keys: moveKeys,
        scene: event.currentTarget,
        previewElements: Array.from(event.currentTarget.querySelectorAll<SVGGraphicsElement>(
          "[data-ui-sketch-preview], [data-ui-sketch-multi-selection]",
        )).filter((element) => (
          moveKeys.includes(element.dataset.uiSketchPreview as UiSketchItemKey)
          || (moveKeys.length > 1 && element.hasAttribute("data-ui-sketch-multi-selection"))
        )),
        delta: { x: 0, y: 0 },
        animationFrame: null,
        start: point,
        startClient: { x: event.clientX, y: event.clientY },
        moved: false,
      };
    } else {
      interactionRef.current = {
        type: "marquee",
        pointerId: event.pointerId,
        start: point,
        startClient: { x: event.clientX, y: event.clientY },
        moved: false,
        sourceSelectedKeys: selectedItemKeys,
        additive: event.shiftKey,
      };
      closeEditor();
    }
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>): void {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const point = worldPoint(event, event.currentTarget);
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
      event.currentTarget.setAttribute("data-canvas-dragging", "node");
      capturePointer(event.currentTarget, event.pointerId);
    }
    event.preventDefault();
    suppressClickRef.current = true;
    suppressItemSelectionRef.current = true;
    interaction.delta = {
      x: Math.round(point.x - interaction.start.x),
      y: Math.round(point.y - interaction.start.y),
    };
    if (interaction.animationFrame === null) {
      interaction.animationFrame = requestAnimationFrame(() => {
        interaction.animationFrame = null;
        const transform = `translate(${interaction.delta.x} ${interaction.delta.y})`;
        interaction.previewElements.forEach((element) => element.setAttribute("transform", transform));
      });
    }
  }

  function finishPointerInteraction(event: ReactPointerEvent<SVGSVGElement>): void {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    if (interaction.type === "marquee") {
      const hitKeys = interaction.moved
        ? selectionWithGroups(state, itemsIntersectingBounds(
            state,
            rectangleFromPoints(
              interaction.start,
              worldPoint(event, event.currentTarget),
            ),
            textMeasurements,
          ))
        : [];
      setSelectedKeys(
        hitKeys.length === 0
          ? []
          : interaction.additive
            ? toggleKeys(interaction.sourceSelectedKeys, hitKeys)
            : hitKeys,
      );
      setMarqueeBounds(null);
    } else {
      clearMovePreview(interaction);
      if (interaction.moved) {
        const point = worldPoint(event, event.currentTarget);
        const delta = {
          x: Math.round(point.x - interaction.start.x),
          y: Math.round(point.y - interaction.start.y),
        };
        if (delta.x !== 0 || delta.y !== 0) {
          updateDraft((current) => moveItemsByDelta(current, interaction.keys, delta));
        }
      }
    }
    interactionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressItemSelectionRef.current = false;
    }, 0);
  }

  function cancelPointerInteraction(event: ReactPointerEvent<SVGSVGElement>): void {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    if (interaction.type === "move-items") clearMovePreview(interaction);
    interactionRef.current = null;
    setMarqueeBounds(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function copyPrompt(content: string): Promise<void> {
    if (writePrompt) await writePrompt(content);
    else {
      if (!navigator.clipboard?.writeText) {
        throw new Error(labels.promptUnsupported);
      }
      await navigator.clipboard.writeText(content);
    }
    setNotice({ type: "success", message: labels.promptCopied });
  }

  async function copySketch(stageId: string): Promise<void> {
    const stageDraft = uiSketchDraftForStage(draft, stageId);
    const result = writeSketch
      ? await writeSketch(cloneUiSketchDraft(stageDraft))
      : await copyUiSketchPng(stageDraft, resolveImageSource);
    setNotice(
      result === "downloaded"
        ? { type: "warning", message: labels.sketchDownloaded }
        : { type: "success", message: labels.sketchCopied },
    );
  }

  async function copyPromptFromSidebar(stageId: string): Promise<void> {
    setCopyingPrompt(true);
    try {
      const stylePrompt = await resolveStylePrompt?.();
      const measureText = (text: UiSketchText) => textBounds(text, textMeasurements);
      await copyPrompt(
        stageId === "all"
          ? buildAllUiSketchStagesPrompt(draft, translatePrompt, stylePrompt, measureText)
          : buildUiSketchPrompt(uiSketchDraftForStage(draft, stageId), translatePrompt, stylePrompt, measureText),
      );
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : labels.promptCopyFailed,
      });
    } finally {
      setCopyingPrompt(false);
    }
  }

  async function copySketchFromSidebar(stageId: string): Promise<void> {
    setCopyingSketch(true);
    try {
      await copySketch(stageId);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : labels.sketchCopyFailed,
      });
    } finally {
      setCopyingSketch(false);
    }
  }

  const overallNoteEditor = (
    <label className="human2ai-ui-sketch-canvas__overall-editor">
      <span>{labels.overallNoteTitle}</span>
      <Input.TextArea
        name="overallNote"
        autoFocus
        autoSize={{ minRows: 4, maxRows: 8 }}
        value={state.overallNote}
        placeholder={labels.overallNotePlaceholder}
        aria-label={labels.overallNoteAriaLabel}
        onChange={(event) => updateDraft((current) => ({
          ...current,
          overallNote: event.target.value,
        }))}
      />
    </label>
  );

  const stageMenuItems = stateTabs.map((tab) => ({
    key: tab.id,
    label: tab.name ?? translatePrompt("stateName", { number: tab.number }),
  }));

  const toolButtons = (
    <div
      className="human2ai-ui-sketch-canvas__tool-groups"
      role="group"
      aria-label={labels.sideActions}
      data-ui-sketch-tool-groups
    >
      <div
        className="human2ai-ui-sketch-canvas__tool-group"
        data-ui-sketch-tool-group="elements"
      >
        <CompositeButton
          icon={<BorderOutlined aria-hidden="true" />}
          label={labels.region}
          collapsedLabel={labels.addRegion}
          aria-current={placementTool === "rectangle" ? true : undefined}
          textColor={placementTool === "rectangle" ? "color.action.primary" : "color.text.primary"}
          disabled={!onDraftChange}
          onClick={() => armPlacement("rectangle")}
        />
        <CompositeButton
          icon={<FontSizeOutlined aria-hidden="true" />}
          label={labels.text}
          collapsedLabel={labels.addText}
          aria-current={placementTool === "text" ? true : undefined}
          textColor={placementTool === "text" ? "color.action.primary" : "color.text.primary"}
          disabled={!onDraftChange}
          onClick={() => armPlacement("text")}
        />
        <CompositeButton
          icon={<PictureOutlined aria-hidden="true" />}
          label={labels.image}
          collapsedLabel={labels.addImage}
          aria-current={placementTool === "image" ? true : undefined}
          textColor={placementTool === "image" ? "color.action.primary" : "color.text.primary"}
          disabled={!onDraftChange}
          onClick={() => armPlacement("image")}
        />
      </div>

      <div
        className="human2ai-ui-sketch-canvas__tool-group"
        data-ui-sketch-tool-group="overall-note"
      >
        <Popover
          content={overallNoteEditor}
          trigger="click"
          placement="leftTop"
          open={overallNoteOpen}
          onOpenChange={setOverallNoteOpen}
        >
          <span className="human2ai-ui-sketch-canvas__side-action">
            <CompositeButton
              icon={<FileTextOutlined aria-hidden="true" />}
              label={labels.overallNote}
            />
          </span>
        </Popover>
      </div>

      <div
        className="human2ai-ui-sketch-canvas__tool-group"
        data-ui-sketch-tool-group="copy"
      >
        <span className="human2ai-ui-sketch-canvas__tool-group-title">
          {labels.copyGroup}
        </span>
        {motionSketchEnabled ? (
          <Dropdown
            trigger={["click"]}
            open={openCopyMenu === "prompt"}
            destroyOnHidden
            onOpenChange={(open) => setOpenCopyMenu((current) => (
              open ? "prompt" : current === "prompt" ? null : current
            ))}
            menu={{
              items: [
                ...stageMenuItems,
                { type: "divider" },
                { key: "all", label: labels.copyAllStages },
              ],
              onClick: ({ key }) => {
                setOpenCopyMenu(null);
                void copyPromptFromSidebar(key);
              },
            }}
          >
            <span className="human2ai-ui-sketch-canvas__side-action">
              <CompositeButton
                icon={<CopyOutlined aria-hidden="true" />}
                label={labels.copyPrompt}
                loading={copyingPrompt}
              />
            </span>
          </Dropdown>
        ) : (
          <span className="human2ai-ui-sketch-canvas__side-action">
            <CompositeButton
              icon={<CopyOutlined aria-hidden="true" />}
              label={labels.copyPrompt}
              loading={copyingPrompt}
              onClick={() => void copyPromptFromSidebar(stateTabs[0].id)}
            />
          </span>
        )}
        {motionSketchEnabled ? (
          <Dropdown
            trigger={["click"]}
            open={openCopyMenu === "sketch"}
            destroyOnHidden
            onOpenChange={(open) => setOpenCopyMenu((current) => (
              open ? "sketch" : current === "sketch" ? null : current
            ))}
            menu={{
              items: stageMenuItems,
              onClick: ({ key }) => {
                setOpenCopyMenu(null);
                void copySketchFromSidebar(key);
              },
            }}
          >
            <span className="human2ai-ui-sketch-canvas__side-action">
              <CompositeButton
                icon={<PictureOutlined aria-hidden="true" />}
                label={labels.copySketch}
                loading={copyingSketch}
              />
            </span>
          </Dropdown>
        ) : (
          <span className="human2ai-ui-sketch-canvas__side-action">
            <CompositeButton
              icon={<PictureOutlined aria-hidden="true" />}
              label={labels.copySketch}
              loading={copyingSketch}
              onClick={() => void copySketchFromSidebar(stateTabs[0].id)}
            />
          </span>
        )}
      </div>
    </div>
  );

  const classes = ["human2ai-ui-sketch-canvas", className].filter(Boolean).join(" ");

  return (
    <main
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "ui-sketch-canvas",
        name: "UiSketchCanvas",
        category: "module",
        origin: "project",
        status: "candidate",
      })}
      className={classes}
      style={style}
      data-ui-sketch-canvas
      aria-label={ariaLabel ?? labels.canvas}
    >
      {imagePaste.feedback}
      {notice ? (
        <div
          className={`human2ai-ui-sketch-canvas__notice human2ai-ui-sketch-canvas__notice--${notice.type}`}
          role="status"
        >
          {notice.message}
        </div>
      ) : null}

      <div ref={workspaceRef} className="human2ai-ui-sketch-canvas__workspace">
        <Dropdown
          trigger={[]}
          autoFocus
          open={contextMenuOpen}
          popupRender={(menu) => <div ref={contextMenuPopupRef}>{menu}</div>}
          onOpenChange={(open) => { if (!open) closeContextMenu(); }}
          menu={{
            items: [
              ...CANVAS_LAYER_ACTIONS.map((action) => ({
                key: action,
                label: labels[action],
                disabled: !onDraftChange || reorderUiSketchLayers(state, selectedIds, action) === state,
              })),
              { type: "divider" },
              { key: "group", label: labels.groupItems, disabled: !onDraftChange || !canGroup },
              { key: "ungroup", label: labels.ungroupItems, disabled: !onDraftChange || selectedGroups.length === 0 },
            ],
            onClick: ({ key }) => {
              const layerAction = CANVAS_LAYER_ACTIONS.find((action) => action === key);
              if (layerAction) {
                updateDraft((current) => reorderUiSketchLayers(current, selectedIds, layerAction));
              } else if (key === "group" && canGroup) {
                updateDraft((current) => groupUiSketchItems(current, selectedIds, createId("group")));
              } else if (key === "ungroup" && selectedGroups.length > 0) {
                updateDraft((current) => ungroupUiSketchItems(current, selectedIds));
              }
              closeContextMenu();
            },
          }}
        >
          <span aria-hidden="true" style={{ position: "fixed", left: contextMenuPoint.x, top: contextMenuPoint.y, width: 1, height: 1, pointerEvents: "none" }} />
        </Dropdown>
        <InfiniteCanvasViewport
          onContextMenuRequest={openContextMenu}
          onCameraCenterChange={() => dismissContextMenu()}
          onZoomChange={() => dismissContextMenu()}
          defaultCameraCenter={{
            x: state.frame.x + state.frame.width / 2,
            y: state.frame.y + state.frame.height / 2,
          }}
          contentBounds={state.frame}
          backgroundPattern="dots"
          sideActionPanelWidth={180}
          sideActionPanelDefaultCollapsed={canvasSideActionPanelDefaultCollapsed}
          sideActions={showCanvasTools ? toolButtons : undefined}
          aria-label={labels.canvasViewport}
          labels={{
            fitAll: labels.fitFrame,
            interactionHelp: labels.interactionHelp,
            sideActions: labels.sideActions,
            collapseSideActions: labels.collapseSideActions,
            expandSideActions: labels.expandSideActions,
          }}
        >
          {(viewport) => {
            return (
              <CanvasScene
                ref={imagePaste.sceneRef}
                bounds={viewport.viewportBounds}
                className="human2ai-ui-sketch-canvas__scene"
                aria-label={labels.scene}
                data-ui-sketch-scene
                tabIndex={-1}
                onPointerDownCapture={(event) => event.currentTarget.focus()}
                onKeyDown={(event) => {
                  if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                    event.preventDefault();
                    openContextMenu({
                      target: event.target,
                      clientX: (event.target as Element).getBoundingClientRect().x,
                      clientY: (event.target as Element).getBoundingClientRect().y,
                    });
                  }
                  if (event.key === "Escape") closeContextMenu();
                }}
                onClickCapture={(event) => {
                  if (!suppressClickRef.current) return;
                  event.stopPropagation();
                  suppressClickRef.current = false;
                }}
                onClick={(event) => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }
                  if (
                    event.target instanceof Element
                    && (
                      event.target.closest("[data-ui-sketch-item]")
                      || event.target.closest("[data-canvas-frame]")
                      || event.target.closest("[data-resize-handle]")
                    )
                  ) {
                    return;
                  }
                  setSelectedKeys([]);
                  closeEditor();
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointerInteraction}
                onPointerCancel={cancelPointerInteraction}
                onLostPointerCapture={cancelPointerInteraction}
              >
                <rect
                  className="human2ai-ui-sketch-canvas__world-surface"
                  x={viewport.viewportBounds.x}
                  y={viewport.viewportBounds.y}
                  width={viewport.viewportBounds.width}
                  height={viewport.viewportBounds.height}
                  aria-hidden="true"
                />

                <CanvasFrame
                  controlsHost={state.layerOrder ? controlsHost : undefined}
                  id="ui-frame"
                  label={labels.frameAction}
                  bounds={state.frame}
                  selected={selectedKeys.includes(FRAME_KEY)}
                  resizeMode="free"
                  resizeCenter={{ x: 0, y: 0 }}
                  minimumWidth={MINIMUM_FRAME_WIDTH}
                  minimumHeight={MINIMUM_FRAME_HEIGHT}
                  screenScale={viewport.zoom}
                  resizeHitSize={32}
                  locked={interfaceFrameLocked}
                  onSelect={() => {
                    setSelectedKeys([FRAME_KEY]);
                    closeEditor();
                  }}
                  onMove={moveFrame}
                  onResize={updateFrame}
                  className="human2ai-ui-sketch-canvas__frame"
                />

                <g
                  className="human2ai-ui-sketch-canvas__frame-label"
                  transform={`translate(${state.frame.x} ${state.frame.y - 12})`}
                  aria-hidden="true"
                >
                  <text>
                    {labels.frameRange} · {Math.round(state.frame.width)} × {Math.round(state.frame.height)}
                  </text>
                </g>

                {sortCanvasLayers([
                  ...state.images.map((image) => {
                  const key = itemKey("image", image.id);
                  const selected = selectedItemKeySet.has(key);
                  const center = boundsCenter(image);
                  const src = image.assetId ? resolveImageSource?.(image.assetId) : undefined;
                  return (
                    <g key={image.id} data-ui-sketch-preview={key}>
                      <CanvasNode
                        controlsHost={state.layerOrder ? controlsHost : undefined}
                        id={image.id}
                        label={`${labels.image}：${image.note.trim() || labels.image}`}
                        x={center.x}
                        y={center.y}
                        selected={selected}
                        bounds={multiSelectionBounds && selected
                          ? undefined
                          : centeredBounds(image.width, image.height)}
                        resizeMode="proportional"
                        resizeCenter={{ x: 0, y: 0 }}
                        screenScale={viewport.zoom}
                        minimumWidth={8}
                        minimumHeight={8}
                        showRotationHandle={false}
                        onSelect={(_id, event) => selectItem(key, event)}
                        onNudge={(delta) => nudgeItem(key, delta)}
                        onResize={(change) => resizeImage(image.id, change)}
                        onDoubleClick={() => openEditor(key)}
                        onDelete={() => deleteItem(key)}
                        className="human2ai-ui-sketch-canvas__item human2ai-ui-sketch-canvas__image"
                        data-ui-sketch-item={key}
                        data-ui-sketch-kind="image"
                        data-ui-sketch-visible={image.visible}
                      >
                        <CanvasImage
                          src={src}
                          alt={image.note || labels.image}
                          width={image.width}
                          height={image.height}
                          fit="cover"
                          crop={image.crop}
                          status={src ? "ready" : "empty"}
                          emptyLabel={labels.image}
                        />
                      </CanvasNode>
                    </g>
                  );
                }),
                  ...state.rectangles.map((rectangle, index) => {
                  const key = itemKey("rectangle", rectangle.id);
                  const selected = selectedItemKeySet.has(key);
                  const center = boundsCenter(rectangle);
                  return (
                    <g key={rectangle.id} data-ui-sketch-preview={key}>
                      <CanvasNode
                        controlsHost={state.layerOrder ? controlsHost : undefined}
                        id={rectangle.id}
                        label={`${labels.region}：${rectangle.note.trim() || labels.missingRegionNote}`}
                        tooltip={rectangle.note.trim() || undefined}
                        x={center.x}
                        y={center.y}
                        selected={selected}
                        bounds={multiSelectionBounds && selected
                          ? undefined
                          : centeredBounds(rectangle.width, rectangle.height)}
                        resizeMode="free"
                        resizeCenter={{ x: 0, y: 0 }}
                        screenScale={viewport.zoom}
                        minimumWidth={8}
                        minimumHeight={8}
                        showRotationHandle={false}
                        onSelect={(_id, event) => selectItem(key, event)}
                        onNudge={(delta) => nudgeItem(key, delta)}
                        onResize={(change) => resizeRectangle(rectangle.id, change)}
                        onDoubleClick={() => openEditor(key)}
                        onDelete={() => deleteItem(key)}
                        className={[
                          "human2ai-ui-sketch-canvas__item",
                          "human2ai-ui-sketch-canvas__rectangle",
                          `human2ai-ui-sketch-canvas__rectangle--tone-${index % 6}`,
                        ].join(" ")}
                        data-ui-sketch-item={key}
                        data-ui-sketch-kind="rectangle"
                        data-ui-sketch-visible={rectangle.visible}
                      >
                        <CanvasShape
                          type="rectangle"
                          width={rectangle.width}
                          height={rectangle.height}
                          className="human2ai-ui-sketch-canvas__rectangle-surface"
                        />
                      </CanvasNode>
                    </g>
                  );
                }),
                  ...state.texts.map((text) => {
                  const key = itemKey("text", text.id);
                  const selected = selectedItemKeySet.has(key);
                  const bounds = textBounds(text, textMeasurements);
                  const center = boundsCenter(bounds);
                  const empty = text.text.length === 0;
                  const displayedText = empty ? labels.emptyText : text.text;
                  return (
                    <g key={text.id} data-ui-sketch-preview={key}>
                      <CanvasNode
                        controlsHost={state.layerOrder ? controlsHost : undefined}
                        id={text.id}
                        label={`${labels.text}：${displayedText}`}
                        x={center.x}
                        y={center.y}
                        selected={selected}
                        bounds={multiSelectionBounds && selected
                          ? undefined
                          : centeredBounds(bounds.width, bounds.height)}
                        resizeMode="font-size"
                        resizeCenter={{ x: 0, y: 0 }}
                        screenScale={viewport.zoom}
                        minimumWidth={8}
                        minimumHeight={8}
                        showRotationHandle={false}
                        onSelect={(_id, event) => selectItem(key, event)}
                        onNudge={(delta) => nudgeItem(key, delta)}
                        onResize={(change) => resizeText(text.id, text, change)}
                        onDoubleClick={() => openEditor(key)}
                        onDelete={() => deleteItem(key)}
                        className="human2ai-ui-sketch-canvas__item human2ai-ui-sketch-canvas__text"
                        data-ui-sketch-item={key}
                        data-ui-sketch-kind="text"
                        data-ui-sketch-visible={text.visible}
                      >
                        <g transform={`translate(${-bounds.width / 2} ${-bounds.height / 2})`}>
                          <CanvasText
                            text={displayedText}
                            fontSize={text.fontSize}
                            onBoundsChange={(measured) => {
                              recordTextMeasurement(text, measured);
                            }}
                            className={[
                              "human2ai-ui-sketch-canvas__text-content",
                              empty ? "human2ai-ui-sketch-canvas__text-content--empty" : null,
                            ].filter(Boolean).join(" ")}
                          />
                        </g>
                      </CanvasNode>
                    </g>
                  );
                }),
                ], state.layerOrder, (node) => String(node.key))}

                {multiSelectionBounds ? (
                  <rect
                    className="human2ai-ui-sketch-canvas__multi-selection"
                    x={multiSelectionBounds.x}
                    y={multiSelectionBounds.y}
                    width={multiSelectionBounds.width}
                    height={multiSelectionBounds.height}
                    aria-hidden="true"
                    data-ui-sketch-multi-selection
                  />
                ) : null}

                {marqueeBounds ? (
                  <rect
                    className="human2ai-ui-sketch-canvas__marquee"
                    x={marqueeBounds.x}
                    y={marqueeBounds.y}
                    width={marqueeBounds.width}
                    height={marqueeBounds.height}
                    aria-hidden="true"
                    data-ui-sketch-marquee
                  />
                ) : null}
                {state.layerOrder ? (
                  <rect data-canvas-layer-frame className="human2ai-canvas-shape human2ai-canvas-frame__border"
                    x={state.frame.x} y={state.frame.y} width={state.frame.width} height={state.frame.height}
                    aria-hidden="true" />
                ) : null}
                <g ref={setControlsHost} data-canvas-controls-layer />

                {placementTool && onDraftChange ? (
                  <CanvasPlacement
                    key={`${activeStageId}:${placementTool}`}
                    tool={PLACEMENT_TOOLS[placementTool]}
                    viewportBounds={viewport.viewportBounds}
                    onPlace={placeNode}
                    onCancel={() => setPlacementTool(null)}
                  />
                ) : null}
              </CanvasScene>
            );
          }}
        </InfiniteCanvasViewport>

        {editingKey && editingItem && editorDraft ? (
          <TextMarkEditor
            open
            title={editorDraft.kind === "rectangle"
              ? labels.editRegionNote
              : editorDraft.kind === "text"
                ? labels.editText
                : labels.image}
            selectedText={editingItem.kind === "rectangle"
              ? editingItem.item.note.trim() || labels.missingRegionNote
              : editingItem.kind === "text"
                ? editingItem.item.text || labels.emptyText
                : editingItem.item.note.trim() || labels.image}
            selectedTextLabel={editingItem.kind === "rectangle"
              ? labels.region
              : editingItem.kind === "text"
                ? labels.text
                : labels.image}
            saveLabel=""
            cancelLabel={labels.cancel}
            onCancel={closeEditor}
            onSave={() => undefined}
            deleteAction={{
              label: editorDraft.kind === "rectangle"
                ? labels.deleteRegion
                : editorDraft.kind === "text"
                  ? labels.deleteText
                  : labels.deleteNode,
              confirmTitle: editorDraft.kind === "rectangle"
                ? labels.confirmDeleteRegion
                : editorDraft.kind === "text"
                  ? labels.confirmDeleteText
                  : labels.confirmDeleteNode,
              confirmCancelLabel: labels.cancelDelete,
              onConfirm: () => deleteItems([editingKey]),
            }}
          >
            <span
              hidden
              data-ui-sketch-mark-editor
              data-human2ai-auto-save-node-editor
            />

            <div
              className={[
                "human2ai-ui-sketch-canvas__editor-layout",
                editorDraft.kind === "image"
                  ? "human2ai-ui-sketch-canvas__editor-layout--image"
                  : null,
              ].filter(Boolean).join(" ")}
              data-human2ai-image-editor-layout={
                editorDraft.kind === "image" ? "true" : undefined
              }
            >
              <div className="human2ai-ui-sketch-canvas__editor-primary-fields">
                <div className="human2ai-ui-sketch-canvas__editor-origin-row">
                  <span
                    className="human2ai-ui-sketch-canvas__editor-origin"
                    data-ui-sketch-origin={editorDraft.item.origin}
                  >
                    {nodeOriginLabel(editorDraft.item.origin, labels)}
                  </span>
                </div>

                {editorDraft.item.annotation.trim() ? (
                  <TextMarkEditorField label={labels.nodeDescription}>
                    <p
                      className="human2ai-ui-sketch-canvas__node-description"
                      data-ui-sketch-node-description
                    >
                      {editorDraft.item.annotation}
                    </p>
                  </TextMarkEditorField>
                ) : null}

                {editorDraft.kind === "text" ? (
                  <TextMarkEditorField label={labels.textContent}>
                    <Input
                      autoFocus
                      name="textContent"
                      value={editorDraft.item.text}
                      placeholder={labels.textPlaceholder}
                      aria-label={labels.textContent}
                      onChange={(event) => updateEditorText({ text: event.target.value })}
                    />
                  </TextMarkEditorField>
                ) : null}

                <TextMarkEditorField label={labels.note}>
                  <TextMarkEditorTextArea
                    autoFocus={editorDraft.kind !== "text"}
                    name="nodeNote"
                    value={editorDraft.item.note}
                    placeholder={editorDraft.kind === "rectangle"
                      ? labels.regionPlaceholder
                      : editorDraft.kind === "text"
                        ? labels.textNotePlaceholder
                        : labels.imageNotePlaceholder}
                    aria-label={labels.note}
                    onChange={(event) => updateEditorMetadata({ note: event.target.value })}
                  />
                </TextMarkEditorField>

                <div className="human2ai-ui-sketch-canvas__editor-properties">
                  <TextMarkEditorField label={labels.visualWeight}>
                    <Select
                      className="human2ai-ui-sketch-canvas__visual-weight-select"
                      value={editorDraft.item.weight}
                      options={visualWeightOptions}
                      aria-label={labels.visualWeight}
                      onChange={(weight: UiSketchVisualWeight) => updateEditorMetadata({ weight })}
                    />
                  </TextMarkEditorField>

                  <TextMarkEditorField label={labels.visibility}>
                    <Switch
                      checked={editorDraft.item.visible}
                      checkedChildren={labels.visible}
                      unCheckedChildren={labels.hidden}
                      aria-label={labels.visibility}
                      onChange={(visible) => updateEditorMetadata({ visible })}
                    />
                  </TextMarkEditorField>

                  {editorDraft.kind === "text" ? (
                    <div className="human2ai-ui-sketch-canvas__editor-field">
                      <span
                        id={fontSizeLabelId}
                        className="human2ai-ui-sketch-canvas__editor-field-label"
                      >
                        {labels.fontSize}
                      </span>
                      <div
                        className="human2ai-ui-sketch-canvas__font-size-control"
                        role="group"
                        aria-labelledby={fontSizeLabelId}
                      >
                        <BasicButton
                          mode="icon-only"
                          size="small"
                          icon={<MinusOutlined aria-hidden="true" />}
                          iconLabel={labels.decreaseFontSize}
                          disabled={editorDraft.item.fontSize <= MINIMUM_TEXT_FONT_SIZE}
                          onClick={() => updateEditorText({
                            fontSize: Math.max(
                              MINIMUM_TEXT_FONT_SIZE,
                              Math.round(editorDraft.item.fontSize) - 1,
                            ),
                          })}
                        />
                        <output aria-live="polite">
                          {Math.round(editorDraft.item.fontSize)}px
                        </output>
                        <BasicButton
                          mode="icon-only"
                          size="small"
                          icon={<PlusOutlined aria-hidden="true" />}
                          iconLabel={labels.increaseFontSize}
                          onClick={() => updateEditorText({
                            fontSize: Math.round(editorDraft.item.fontSize) + 1,
                          })}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {editorDraft.kind === "image" ? (
                <aside className="human2ai-ui-sketch-canvas__editor-side-fields">
                  <CanvasImageEditorFields
                    key={editorDraft.item.id}
                    src={
                      editorDraft.item.assetId
                        ? resolveImageSource?.(editorDraft.item.assetId)
                        : undefined
                    }
                    crop={editorDraft.item.crop}
                    aspectRatio={editorDraft.item.width / editorDraft.item.height}
                    labels={imageEditorLabels}
                    onReadFile={onReadImageFile}
                    disabled={!onDraftChange || !onImageUpload}
                    onUpload={async (file) => {
                      if (!onImageUpload) return;
                      const assetId = await onImageUpload(file);
                      const latest = latestImageUpdateRef.current;
                      if (latest.interactionResetKey !== interactionResetKey) return;
                      setEditorDraft((current) => current?.kind === "image" && current.item.id === editorDraft.item.id
                        ? { ...current, item: { ...current.item, assetId, crop: null } }
                        : current);
                      latest.updateImage(editorDraft.item.id, { assetId, crop: null });
                    }}
                    onCropChange={(crop, cropAspectRatio) => {
                      setEditorDraft((current) => current?.kind === "image"
                        ? {
                            ...current,
                            item: {
                              ...current.item,
                              crop,
                              y: current.item.y + (
                                current.item.height
                                - current.item.width / cropAspectRatio
                              ) / 2,
                              height: current.item.width / cropAspectRatio,
                            },
                          }
                        : current);
                      onDraftChange?.(updateUiSketchImageCrop(
                        draft,
                        editorDraft.item.id,
                        crop,
                        cropAspectRatio,
                      ));
                    }}
                  />
                </aside>
              ) : null}
            </div>
          </TextMarkEditor>
        ) : null}
      </div>

      <span className="human2ai-ui-sketch-canvas__selection-status" aria-live="polite">
        {selectedItemKeys.length
          ? `${labels.selectedItemsPrefix}${selectedItemKeys.length}${labels.selectedItemsSuffix}`
          : labels.noSelection}
      </span>

      {clearActionHost ? createPortal(
        <Tooltip title={labels.clearCanvas}>
          <span>
            <ConfirmAction
              type="text"
              size="small"
              icon={<DeleteOutlined aria-hidden="true" />}
              aria-label={labels.clearCanvas}
              title={labels.clearCanvasConfirmTitle}
              description={labels.clearCanvasConfirmDescription}
              confirmLabel={labels.clearCanvas}
              cancelLabel={labels.clearCanvasCancel}
              onConfirm={clearCanvas}
              data-ui-sketch-clear-canvas-action
            >
              {null}
            </ConfirmAction>
          </span>
        </Tooltip>,
        clearActionHost,
      ) : null}

      {toolHost ? createPortal(
        <div
          className="human2ai-ui-sketch-canvas__external-tools"
          data-ui-sketch-external-tools
        >
          {toolButtons}
        </div>,
        toolHost,
      ) : null}
    </main>
  );
}

function nodeOriginLabel(
  origin: UiSketchNodeOrigin,
  labels: UiSketchCanvasLabels,
): string {
  if (origin === "agent") return labels.originAgent;
  if (origin === "import") return labels.originImport;
  return labels.originUser;
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function itemKey(kind: UiSketchItemKind, id: string): UiSketchItemKey {
  return `${kind}:${id}`;
}

function isItemKey(value: string): value is UiSketchItemKey {
  return value.startsWith("rectangle:")
    || value.startsWith("text:")
    || value.startsWith("image:");
}

function keyId(key: UiSketchItemKey): string {
  return key.slice(key.indexOf(":") + 1);
}

function selectionWithGroups(state: UiSketchDraft, keys: readonly UiSketchItemKey[]): UiSketchItemKey[] {
  const ids = new Set(uiSketchSelectionWithGroups(state, keys.map(keyId)));
  return [
    ...state.rectangles.filter((item) => ids.has(item.id)).map((item) => itemKey("rectangle", item.id)),
    ...state.texts.filter((item) => ids.has(item.id)).map((item) => itemKey("text", item.id)),
    ...state.images.filter((item) => ids.has(item.id)).map((item) => itemKey("image", item.id)),
  ];
}

function itemForKey(state: UiSketchDraft, key: UiSketchItemKey) {
  const id = keyId(key);
  if (key.startsWith("rectangle:")) {
    const item = state.rectangles.find((rectangle) => rectangle.id === id);
    return item ? { kind: "rectangle" as const, item } : null;
  }
  if (key.startsWith("image:")) {
    const item = state.images.find((image) => image.id === id);
    return item ? { kind: "image" as const, item } : null;
  }
  const item = state.texts.find((text) => text.id === id);
  return item ? { kind: "text" as const, item } : null;
}

function itemBounds(
  state: UiSketchDraft,
  key: UiSketchItemKey,
  textMeasurements: TextMeasurements,
): UiSketchBounds | null {
  const found = itemForKey(state, key);
  if (!found) return null;
  return found.kind === "rectangle" || found.kind === "image"
    ? found.item
    : textBounds(found.item, textMeasurements);
}

function textBounds(
  text: UiSketchText,
  textMeasurements: TextMeasurements,
): UiSketchBounds {
  const estimated = uiSketchTextBounds(text);
  const measured = textMeasurements[text.id];
  if (
    !measured
    || measured.text !== text.text
    || measured.fontSize !== text.fontSize
  ) {
    return estimated;
  }
  return {
    ...estimated,
    width: measured.width,
    height: measured.height,
  };
}

function textResizeSignature(
  id: string,
  text: string,
  change: CanvasNodeResizeChange,
): string {
  const { sourceBounds, sourcePosition } = change;
  return [
    id,
    text,
    sourcePosition.x,
    sourcePosition.y,
    sourceBounds.x,
    sourceBounds.y,
    sourceBounds.width,
    sourceBounds.height,
  ].join(":");
}

function boundsCenter(bounds: UiSketchBounds): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function centeredBounds(width: number, height: number): CanvasNodeBounds {
  return { x: -width / 2, y: -height / 2, width, height };
}

function boundsForItems(
  state: UiSketchDraft,
  keys: readonly UiSketchItemKey[],
  textMeasurements: TextMeasurements,
): UiSketchBounds | null {
  const bounds = keys
    .map((key) => itemBounds(state, key, textMeasurements))
    .filter((value): value is UiSketchBounds => Boolean(value));
  if (!bounds.length) return null;
  const minimumX = Math.min(...bounds.map((value) => value.x));
  const minimumY = Math.min(...bounds.map((value) => value.y));
  const maximumX = Math.max(...bounds.map((value) => value.x + value.width));
  const maximumY = Math.max(...bounds.map((value) => value.y + value.height));
  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX,
    height: maximumY - minimumY,
  };
}

function clearMovePreview(interaction: Extract<PointerInteraction, { type: "move-items" }>): void {
  if (interaction.animationFrame !== null) cancelAnimationFrame(interaction.animationFrame);
  interaction.previewElements.forEach((element) => element.removeAttribute("transform"));
  interaction.scene.removeAttribute("data-canvas-dragging");
}

function moveItemsByDelta(
  state: UiSketchDraft,
  keys: readonly UiSketchItemKey[],
  requestedDelta: Point,
): UiSketchDraft {
  if (!keys.length) return state;
  const delta = { x: Math.round(requestedDelta.x), y: Math.round(requestedDelta.y) };
  const keySet = new Set(keys);
  return {
    ...state,
    rectangles: state.rectangles.map((rectangle) => (
      keySet.has(itemKey("rectangle", rectangle.id))
        ? { ...rectangle, x: rectangle.x + delta.x, y: rectangle.y + delta.y }
        : rectangle
    )),
    images: state.images.map((image) => (
      keySet.has(itemKey("image", image.id))
        ? { ...image, x: image.x + delta.x, y: image.y + delta.y }
        : image
    )),
    texts: state.texts.map((text) => (
      keySet.has(itemKey("text", text.id))
        ? { ...text, x: text.x + delta.x, y: text.y + delta.y }
        : text
    )),
  };
}

function removeItems(state: UiSketchDraft, keys: readonly UiSketchItemKey[]): UiSketchDraft {
  const keySet = new Set(keys);
  const removedIds = new Set(keys.map(keyId));
  return {
    ...state,
    groups: retainUiSketchGroups(state.groups, [...state.rectangles, ...state.texts, ...state.images]
      .filter((item) => !removedIds.has(item.id)).map((item) => item.id)),
    rectangles: state.rectangles.filter((rectangle) => (
      !keySet.has(itemKey("rectangle", rectangle.id))
    )),
    images: state.images.filter((image) => !keySet.has(itemKey("image", image.id))),
    texts: state.texts.filter((text) => !keySet.has(itemKey("text", text.id))),
  };
}

function itemsIntersectingBounds(
  state: UiSketchDraft,
  selection: UiSketchBounds,
  textMeasurements: TextMeasurements,
): UiSketchItemKey[] {
  const keys: UiSketchItemKey[] = [
    ...state.images.map((image) => itemKey("image", image.id)),
    ...state.rectangles.map((rectangle) => itemKey("rectangle", rectangle.id)),
    ...state.texts.map((text) => itemKey("text", text.id)),
  ];
  return keys.filter((key) => {
    const bounds = itemBounds(state, key, textMeasurements);
    return bounds ? boundsIntersect(bounds, selection) : false;
  });
}

function boundsIntersect(left: UiSketchBounds, right: UiSketchBounds): boolean {
  return left.x <= right.x + right.width
    && left.x + left.width >= right.x
    && left.y <= right.y + right.height
    && left.y + left.height >= right.y;
}

function rectangleFromPoints(start: Point, end: Point): UiSketchBounds {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function worldPoint(
  event: Pick<ReactPointerEvent<SVGSVGElement>, "clientX" | "clientY">,
  scene: SVGSVGElement,
): Point {
  const rect = scene.getBoundingClientRect();
  const viewBox = scene.viewBox.baseVal;
  return {
    x: viewBox.x + ((event.clientX - rect.left) / Math.max(1, rect.width)) * viewBox.width,
    y: viewBox.y + ((event.clientY - rect.top) / Math.max(1, rect.height)) * viewBox.height,
  };
}

function capturePointer(element: SVGSVGElement, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Synthetic Storybook pointer events may not create a capturable pointer.
  }
}

function toggleKeys(
  source: readonly UiSketchItemKey[],
  toggled: readonly UiSketchItemKey[],
): UiSketchItemKey[] {
  const result = new Set(source);
  toggled.forEach((key) => {
    if (result.has(key)) result.delete(key);
    else result.add(key);
  });
  return [...result];
}
