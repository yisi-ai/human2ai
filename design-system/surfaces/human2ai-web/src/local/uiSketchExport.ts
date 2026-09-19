import { renderUiSketchSvg } from "../../../../../src/domain/ui-sketch/render.ts";
export { renderUiSketchSvg } from "../../../../../src/domain/ui-sketch/render.ts";
import {
  uiSketchDraftForStage,
  uiSketchStateTabs,
  uiSketchTextBounds,
  type UiSketchBounds,
  type UiSketchDraft,
  type UiSketchImage,
  type UiSketchRectangle,
  type UiSketchText,
  type UiSketchVisualWeight,
} from "./uiSketchDraft.ts";

export type SketchCopyResult = "copied" | "downloaded";

export type UiSketchPromptKey =
  | "stateHeading"
  | "stateName"
  | "staticTitle"
  | "motionTitle"
  | "canvasSize"
  | "layoutHeading"
  | "canvasOrigin"
  | "referenceValues"
  | "perceptibleElementGuidance"
  | "flexibleImplementation"
  | "motionStateGuidance"
  | "globalNoteHeading"
  | "elementsHeading"
  | "regionNumber"
  | "textNumber"
  | "imageNumber"
  | "note"
  | "visualWeight"
  | "displayText"
  | "referencePosition"
  | "referenceSize"
  | "referenceFontSize"
  | "startState"
  | "endState"
  | "visible"
  | "hidden"
  | "changeVisible"
  | "changeHidden"
  | "motionClosing"
  | "weightAuto"
  | "weightHigh"
  | "weightMedium"
  | "weightLow"
  | "weightDecorative";

export type UiSketchPromptTranslator = (
  key: UiSketchPromptKey,
  values?: Record<string, string | number>,
) => string;

export function buildUiSketchPrompt(
  state: UiSketchDraft,
  translate: UiSketchPromptTranslator,
  stylePrompt?: string,
  measureText: (text: UiSketchText) => UiSketchBounds = uiSketchTextBounds,
): string {
  const elements = [
    ...state.images.flatMap((image, index) => (
      isVisibleInFrame(state, image, measureText) ? [singleImageLines(state, image, index, translate)] : []
    )),
    ...state.rectangles.flatMap((rectangle, index) => (
      isVisibleInFrame(state, rectangle, measureText) ? [singleRectangleLines(state, rectangle, index, translate)] : []
    )),
    ...state.texts.flatMap((text, index) => (
      isVisibleInFrame(state, text, measureText) ? [singleTextLines(state, text, index, translate)] : []
    )),
  ];

  return [
    translate("staticTitle"),
    "",
    translate("canvasSize", {
      width: Math.round(state.frame.width),
      height: Math.round(state.frame.height),
    }),
    "",
    ...layoutGuidance(false, translate),
    ...overallRequirementLines(state.overallNote, translate),
    ...(stylePrompt?.trim() ? ["", stylePrompt.trim()] : []),
    ...(elements.length ? ["", translate("elementsHeading")] : []),
    ...elements.flatMap((element) => ["", ...element]),
  ].join("\n").trimEnd();
}

export function buildAllUiSketchStagesPrompt(
  state: UiSketchDraft,
  translate: UiSketchPromptTranslator,
  stylePrompt?: string,
  measureText: (text: UiSketchText) => UiSketchBounds = uiSketchTextBounds,
): string {
  const tabs = uiSketchStateTabs(state);
  if (tabs.length === 1) return buildUiSketchPrompt(uiSketchDraftForStage(state, tabs[0].id), translate, stylePrompt, measureText);
  return tabs.slice(1).map((tab, index) => {
    const previous = tabs[index];
    const stateLabel = (item: typeof tab) => item.name ?? translate("stateName", { number: item.number });
    const pairTranslate: UiSketchPromptTranslator = (key, values) => (
      key === "startState" || key === "endState"
        ? translate("stateHeading", { name: stateLabel(key === "startState" ? previous : tab) })
        : translate(key, values)
    );
    return buildUiSketchTransitionPrompt(state, previous.id, tab.id, pairTranslate, stylePrompt, measureText);
  }).join("\n\n");
}

function buildUiSketchTransitionPrompt(
  state: UiSketchDraft,
  startId: string,
  endId: string,
  translate: UiSketchPromptTranslator,
  stylePrompt: string | undefined,
  measureText: (text: UiSketchText) => UiSketchBounds,
): string {
  const start = uiSketchDraftForStage(state, startId);
  const end = uiSketchDraftForStage(state, endId);
  const endRectangles = new Map(end.rectangles.map((rectangle) => [rectangle.id, rectangle]));
  const endTexts = new Map(end.texts.map((text) => [text.id, text]));
  const endImages = new Map(end.images.map((image) => [image.id, image]));
  const elements = [
    ...start.images.flatMap((image, index) => {
      const finalImage = endImages.get(image.id);
      return finalImage && (isVisibleInFrame(start, image, measureText) || isVisibleInFrame(end, finalImage, measureText))
        ? [motionImageLines(start, end, image, finalImage, index, translate)]
        : [];
    }),
    ...start.rectangles.flatMap((rectangle, index) => {
      const finalRectangle = endRectangles.get(rectangle.id);
      return finalRectangle && (isVisibleInFrame(start, rectangle, measureText) || isVisibleInFrame(end, finalRectangle, measureText))
        ? [motionRectangleLines(start, end, rectangle, finalRectangle, index, translate)]
        : [];
    }),
    ...start.texts.flatMap((text, index) => {
      const finalText = endTexts.get(text.id);
      return finalText && (isVisibleInFrame(start, text, measureText) || isVisibleInFrame(end, finalText, measureText))
        ? [motionTextLines(start, end, text, finalText, index, translate)]
        : [];
    }),
  ];

  return [
    translate("motionTitle"),
    "",
    translate("canvasSize", {
      width: Math.round(state.frame.width),
      height: Math.round(state.frame.height),
    }),
    "",
    ...layoutGuidance(elements.length > 0, translate),
    ...overallRequirementLines(state.overallNote, translate),
    ...(stylePrompt?.trim() ? ["", stylePrompt.trim()] : []),
    ...(elements.length ? ["", translate("elementsHeading")] : []),
    ...elements.flatMap((element) => ["", ...element]),
    ...(elements.length ? ["", translate("motionClosing")] : []),
  ].join("\n").trimEnd();
}

function isVisibleInFrame(
  state: UiSketchDraft,
  item: UiSketchRectangle | UiSketchImage | UiSketchText,
  measureText: (text: UiSketchText) => UiSketchBounds,
): boolean {
  if (!item.visible) return false;
  const bounds = "text" in item ? measureText(item) : item;
  const frame = state.frame;
  return bounds.x < frame.x + frame.width
    && bounds.x + bounds.width > frame.x
    && bounds.y < frame.y + frame.height
    && bounds.y + bounds.height > frame.y;
}

function layoutGuidance(
  motion: boolean,
  translate: UiSketchPromptTranslator,
): string[] {
  return [
    translate("layoutHeading"),
    translate("canvasOrigin"),
    translate("referenceValues"),
    translate("perceptibleElementGuidance"),
    translate("flexibleImplementation"),
    ...(motion ? [translate("motionStateGuidance")] : []),
  ];
}

function overallRequirementLines(
  overallNote: string,
  translate: UiSketchPromptTranslator,
): string[] {
  const note = overallNote.trim();
  return note ? ["", translate("globalNoteHeading"), note] : [];
}

function singleRectangleLines(
  state: UiSketchDraft,
  rectangle: UiSketchRectangle,
  index: number,
  translate: UiSketchPromptTranslator,
): string[] {
  const geometry = rectangleGeometry(state, rectangle);
  const note = rectangle.note.trim();
  return [
    translate("regionNumber", { index: index + 1 }),
    ...(note ? [translate("note", { note })] : []),
    translate("visualWeight", { weight: visualWeightLabel(rectangle.weight, translate) }),
    `- ${translate("referencePosition", geometry)}`,
    `- ${translate("referenceSize", geometry)}`,
  ];
}

function singleTextLines(
  state: UiSketchDraft,
  text: UiSketchText,
  index: number,
  translate: UiSketchPromptTranslator,
): string[] {
  const geometry = textGeometry(state, text);
  const note = text.note.trim();
  return [
    translate("textNumber", { index: index + 1 }),
    translate("displayText", { text: JSON.stringify(text.text) }),
    ...(note ? [translate("note", { note })] : []),
    translate("visualWeight", { weight: visualWeightLabel(text.weight, translate) }),
    `- ${translate("referencePosition", geometry)}`,
    `- ${translate("referenceFontSize", {
      fontSize: Math.max(1, Math.round(text.fontSize)),
    })}`,
  ];
}

function singleImageLines(
  state: UiSketchDraft,
  image: UiSketchImage,
  index: number,
  translate: UiSketchPromptTranslator,
): string[] {
  const geometry = rectangleGeometry(state, image);
  const note = image.note.trim();
  return [
    translate("imageNumber", { index: index + 1 }),
    ...(note ? [translate("note", { note })] : []),
    translate("visualWeight", { weight: visualWeightLabel(image.weight, translate) }),
    `- ${translate("referencePosition", geometry)}`,
    `- ${translate("referenceSize", geometry)}`,
  ];
}

function motionRectangleLines(
  startState: UiSketchDraft,
  endState: UiSketchDraft,
  start: UiSketchRectangle,
  end: UiSketchRectangle,
  index: number,
  translate: UiSketchPromptTranslator,
): string[] {
  const startGeometry = rectangleGeometry(startState, start);
  const endGeometry = rectangleGeometry(endState, end);
  const note = start.note.trim();
  const endLines = changedRectangleStateLines(
    startGeometry,
    endGeometry,
    start.visible,
    end.visible,
    translate,
  );
  return [
    translate("regionNumber", { index: index + 1 }),
    ...(note ? [translate("note", { note })] : []),
    translate("visualWeight", { weight: visualWeightLabel(start.weight, translate) }),
    translate("startState"),
    `  - ${translate(start.visible ? "visible" : "hidden")}`,
    `  - ${translate("referencePosition", startGeometry)}`,
    `  - ${translate("referenceSize", startGeometry)}`,
    ...(endLines.length
      ? [translate("endState"), ...endLines.map((line) => `  - ${line}`)]
      : []),
  ];
}

function motionTextLines(
  startState: UiSketchDraft,
  endState: UiSketchDraft,
  start: UiSketchText,
  end: UiSketchText,
  index: number,
  translate: UiSketchPromptTranslator,
): string[] {
  const startGeometry = textGeometry(startState, start);
  const endGeometry = textGeometry(endState, end);
  const note = start.note.trim();
  const endLines = changedTextStateLines(startGeometry, endGeometry, start, end, translate);
  return [
    translate("textNumber", { index: index + 1 }),
    translate("displayText", { text: JSON.stringify(start.text) }),
    ...(note ? [translate("note", { note })] : []),
    translate("visualWeight", { weight: visualWeightLabel(start.weight, translate) }),
    translate("startState"),
    `  - ${translate(start.visible ? "visible" : "hidden")}`,
    `  - ${translate("referencePosition", startGeometry)}`,
    `  - ${translate("referenceFontSize", {
      fontSize: Math.max(1, Math.round(start.fontSize)),
    })}`,
    ...(endLines.length
      ? [translate("endState"), ...endLines.map((line) => `  - ${line}`)]
      : []),
  ];
}

function motionImageLines(
  startState: UiSketchDraft,
  endState: UiSketchDraft,
  start: UiSketchImage,
  end: UiSketchImage,
  index: number,
  translate: UiSketchPromptTranslator,
): string[] {
  const startGeometry = rectangleGeometry(startState, start);
  const endGeometry = rectangleGeometry(endState, end);
  const note = start.note.trim();
  const endLines = changedRectangleStateLines(
    startGeometry,
    endGeometry,
    start.visible,
    end.visible,
    translate,
  );
  return [
    translate("imageNumber", { index: index + 1 }),
    ...(note ? [translate("note", { note })] : []),
    translate("visualWeight", { weight: visualWeightLabel(start.weight, translate) }),
    translate("startState"),
    `  - ${translate(start.visible ? "visible" : "hidden")}`,
    `  - ${translate("referencePosition", startGeometry)}`,
    `  - ${translate("referenceSize", startGeometry)}`,
    ...(endLines.length
      ? [translate("endState"), ...endLines.map((line) => `  - ${line}`)]
      : []),
  ];
}

interface ExportGeometry {
  [key: string]: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

function changedRectangleStateLines(
  start: ExportGeometry,
  end: ExportGeometry,
  startVisible: boolean,
  endVisible: boolean,
  translate: UiSketchPromptTranslator,
): string[] {
  return [
    ...(startVisible !== endVisible
      ? [translate(endVisible ? "changeVisible" : "changeHidden")]
      : []),
    ...(start.x !== end.x || start.y !== end.y
      ? [translate("referencePosition", end)]
      : []),
    ...(start.width !== end.width || start.height !== end.height
      ? [translate("referenceSize", end)]
      : []),
  ];
}

function changedTextStateLines(
  startGeometry: ExportGeometry,
  endGeometry: ExportGeometry,
  start: UiSketchText,
  end: UiSketchText,
  translate: UiSketchPromptTranslator,
): string[] {
  return [
    ...(start.visible !== end.visible
      ? [translate(end.visible ? "changeVisible" : "changeHidden")]
      : []),
    ...(startGeometry.x !== endGeometry.x || startGeometry.y !== endGeometry.y
      ? [translate("referencePosition", endGeometry)]
      : []),
    ...(Math.round(start.fontSize) !== Math.round(end.fontSize)
      ? [translate("referenceFontSize", {
          fontSize: Math.max(1, Math.round(end.fontSize)),
        })]
      : []),
  ];
}

function rectangleGeometry(
  state: UiSketchDraft,
  rectangle: UiSketchRectangle | UiSketchImage,
): ExportGeometry {
  return {
    x: Math.round(rectangle.x - state.frame.x),
    y: Math.round(rectangle.y - state.frame.y),
    width: Math.max(1, Math.round(rectangle.width)),
    height: Math.max(1, Math.round(rectangle.height)),
  };
}

function textGeometry(state: UiSketchDraft, text: UiSketchText): ExportGeometry {
  const bounds = uiSketchTextBounds(text);
  return {
    x: Math.round(text.x - state.frame.x),
    y: Math.round(text.y - state.frame.y),
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
  };
}

function visualWeightLabel(
  weight: UiSketchVisualWeight,
  translate: UiSketchPromptTranslator,
): string {
  return {
    auto: translate("weightAuto"),
    high: translate("weightHigh"),
    medium: translate("weightMedium"),
    low: translate("weightLow"),
    decorative: translate("weightDecorative"),
  }[weight];
}

export { uiSketchTextBounds };

export async function copyUiSketchPng(
  state: UiSketchDraft,
  resolveImageSource?: (assetId: string) => string | undefined,
): Promise<SketchCopyResult> {
  const png = await renderUiSketchPng(state, resolveImageSource);
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return "copied";
  }
  downloadBlob(png, "ui-sketch.png");
  return "downloaded";
}

export async function renderUiSketchPng(
  state: UiSketchDraft,
  resolveImageSource?: (assetId: string) => string | undefined,
): Promise<Blob> {
  const svg = renderUiSketchSvg(state, resolveImageSource);
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(state.frame.width));
    canvas.height = Math.max(1, Math.round(state.frame.height));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器未能创建草图画布。");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await canvasBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("浏览器未能渲染 UI 界面。"));
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("浏览器未能生成 UI 界面预览图。"));
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
