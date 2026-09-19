import { uiSketchLayerOrder } from "./layers.ts";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import uiSketchDraftSchema from "../../../schemas/ui-sketch-draft.schema.json" with {
  type: "json",
};
import { normalizeHuman2AiCanvasNodeMetadata } from "../canvas-node-metadata.ts";
import { canonicalJson, fingerprintText } from "../fingerprint.ts";

import type {
  UiSketchDraft,
  UiSketchImage,
  UiSketchRectangle,
  UiSketchStage,
  UiSketchText,
} from "./types.ts";

import { uiSketchStateTabs } from "./states.ts";

export const UI_SKETCH_START_STAGE_ID = "start";
export const UI_SKETCH_END_STAGE_ID = "end";

export const EMPTY_UI_SKETCH_DRAFT: UiSketchDraft = {
  version: 1,
  kind: "ui-layout-draft",
  frame: { x: 0, y: 0, width: 960, height: 560 },
  overallNote: "",
  rectangles: [],
  texts: [],
  images: [],
  groups: [],
  stages: [],
};

const ajv = new Ajv2020({ allErrors: true });
const validateSchema = ajv.compile<UiSketchDraft>(uiSketchDraftSchema);

export function createUiSketchDraft(): UiSketchDraft {
  return cloneUiSketchDraft(EMPTY_UI_SKETCH_DRAFT);
}

export function uiSketchDraftFingerprint(input: unknown): string {
  return fingerprintText(canonicalJson(validateUiSketchDraft(input)));
}

export function cloneUiSketchDraft(draft: UiSketchDraft): UiSketchDraft {
  return {
    ...draft,
    ...(draft.layerOrder ? { layerOrder: [...draft.layerOrder] } : {}),
    frame: { ...draft.frame },
    ...(draft.stateTabs ? { stateTabs: uiSketchStateTabs(draft) } : {}),
    groups: draft.groups.map((group) => ({ ...group, itemIds: [...group.itemIds] })),
    rectangles: draft.rectangles.map((rectangle) => ({ ...rectangle })),
    texts: draft.texts.map((text) => ({ ...text })),
    images: draft.images.map((image) => ({
      ...image,
      crop: image.crop ? { ...image.crop } : null,
    })),
    stages: draft.stages.map((stage) => ({
      ...stage,
      rectangles: stage.rectangles.map((rectangle) => ({ ...rectangle })),
      texts: stage.texts.map((text) => ({ ...text })),
      images: stage.images.map((image) => ({ ...image })),
    })),
  };
}

export function uiSketchDraftForStage(
  draft: UiSketchDraft,
  stageId: string,
): UiSketchDraft {
  const cloned = cloneUiSketchDraft(draft);
  if (stageId === UI_SKETCH_START_STAGE_ID) return cloned;
  const stage = resolveUiSketchStage(cloned, stageId);
  if (stageId === UI_SKETCH_END_STAGE_ID && !stage) return cloned;
  if (!stage) throw new Error(`Unknown UI sketch stage id: ${stageId}.`);
  const rectangleStates = new Map(stage.rectangles.map((state) => [state.id, state]));
  const textStates = new Map(stage.texts.map((state) => [state.id, state]));
  const imageStates = new Map(stage.images.map((state) => [state.id, state]));
  return {
    ...cloned,
    rectangles: cloned.rectangles.map((rectangle) => ({
      ...rectangle,
      ...rectangleStates.get(rectangle.id),
    })),
    texts: cloned.texts.map((text) => ({
      ...text,
      ...textStates.get(text.id),
    })),
    images: cloned.images.map((image) => ({
      ...image,
      ...imageStates.get(image.id),
    })),
  };
}

export function insertUiSketchStage(
  draft: UiSketchDraft,
  sourceStageId: string,
  stageId: string,
): UiSketchDraft {
  if (
    stageId === UI_SKETCH_START_STAGE_ID
    || draft.stages.some((stage) => stage.id === stageId)
  ) {
    throw new Error(`Duplicate UI sketch stage id: ${stageId}.`);
  }
  const tabs = uiSketchStateTabs(draft);
  if (!tabs.some((tab) => tab.id === sourceStageId)) {
    throw new Error(`Unknown UI sketch stage id: ${sourceStageId}.`);
  }
  const source = uiSketchDraftForStage(draft, sourceStageId);
  const stage: UiSketchStage = {
    id: stageId,
    rectangles: source.rectangles.map(rectangleStageState),
    texts: source.texts.map(textStageState),
    images: source.images.map(imageStageState),
  };
  const insertionIndex = sourceStageId === UI_SKETCH_START_STAGE_ID
    ? 0
    : draft.stages.findIndex((candidate) => candidate.id === sourceStageId) + 1;
  if (insertionIndex === 0 && sourceStageId !== UI_SKETCH_START_STAGE_ID) {
    throw new Error(`Unknown UI sketch stage id: ${sourceStageId}.`);
  }
  const stages = draft.stages.map(cloneStage);
  stages.splice(insertionIndex, 0, stage);
  tabs.splice(tabs.findIndex((tab) => tab.id === sourceStageId) + 1, 0, {
    id: stageId, number: Math.max(...tabs.map((tab) => tab.number)) + 1,
  });
  return { ...cloneUiSketchDraft(draft), stages, stateTabs: tabs };
}

export function updateUiSketchStageDraft(
  draft: UiSketchDraft,
  stageId: string,
  nextStageDraft: UiSketchDraft,
): UiSketchDraft {
  const targetStage = stageId === UI_SKETCH_START_STAGE_ID
    ? null
    : resolveUiSketchStage(draft, stageId);
  if (
    stageId !== UI_SKETCH_START_STAGE_ID
    && stageId !== UI_SKETCH_END_STAGE_ID
    && !targetStage
  ) {
    throw new Error(`Unknown UI sketch stage id: ${stageId}.`);
  }
  const targetStageId = targetStage?.id ?? stageId;
  const previousRectangles = new Map(draft.rectangles.map((item) => [item.id, item]));
  const previousTexts = new Map(draft.texts.map((item) => [item.id, item]));
  const previousImages = new Map(draft.images.map((item) => [item.id, item]));
  const nextRectangles = new Map(nextStageDraft.rectangles.map((item) => [item.id, item]));
  const nextTexts = new Map(nextStageDraft.texts.map((item) => [item.id, item]));
  const nextImages = new Map(nextStageDraft.images.map((item) => [item.id, item]));
  const rectangles = nextStageDraft.rectangles.map((next) => {
    const previous = previousRectangles.get(next.id);
    if (!previous || stageId === UI_SKETCH_START_STAGE_ID) return { ...next };
    return {
      ...previous,
      note: next.note,
      annotation: next.annotation,
      semanticType: next.semanticType,
      weight: next.weight,
    };
  });
  const texts = nextStageDraft.texts.map((next) => {
    const previous = previousTexts.get(next.id);
    if (!previous || stageId === UI_SKETCH_START_STAGE_ID) return { ...next };
    return {
      ...previous,
      text: next.text,
      note: next.note,
      annotation: next.annotation,
      semanticType: next.semanticType,
      weight: next.weight,
    };
  });
  const images = nextStageDraft.images.map((next) => {
    const previous = previousImages.get(next.id);
    if (!previous || stageId === UI_SKETCH_START_STAGE_ID) return { ...next };
    return {
      ...previous,
      assetId: next.assetId,
      crop: next.crop ? { ...next.crop } : null,
      note: next.note,
      annotation: next.annotation,
      semanticType: next.semanticType,
      weight: next.weight,
    };
  });
  const stages = draft.stages.map((stage) => ({
    ...stage,
    rectangles: rectangles.map((rectangle) => {
      if (stage.id === targetStageId) {
        return rectangleStageState(nextRectangles.get(rectangle.id) ?? rectangle);
      }
      return {
        ...(stage.rectangles.find((state) => state.id === rectangle.id)
          ?? rectangleStageState(nextRectangles.get(rectangle.id) ?? rectangle)),
      };
    }),
    texts: texts.map((text) => {
      if (stage.id === targetStageId) {
        return textStageState(nextTexts.get(text.id) ?? text);
      }
      return {
        ...(stage.texts.find((state) => state.id === text.id)
          ?? textStageState(nextTexts.get(text.id) ?? text)),
      };
    }),
    images: images.map((image) => {
      if (stage.id === targetStageId) {
        return imageStageState(nextImages.get(image.id) ?? image);
      }
      return {
        ...(stage.images.find((state) => state.id === image.id)
          ?? imageStageState(nextImages.get(image.id) ?? image)),
      };
    }),
  }));
  if (stageId === UI_SKETCH_END_STAGE_ID && !targetStage) {
    stages.push({
      id: UI_SKETCH_END_STAGE_ID,
      rectangles: rectangles.map((rectangle) => (
        rectangleStageState(nextRectangles.get(rectangle.id) ?? rectangle)
      )),
      texts: texts.map((text) => textStageState(nextTexts.get(text.id) ?? text)),
      images: images.map((image) => imageStageState(nextImages.get(image.id) ?? image)),
    });
  }
  return {
    ...draft,
    ...(nextStageDraft.layerOrder ? { layerOrder: uiSketchLayerOrder(nextStageDraft) } : {}),
    frame: { ...nextStageDraft.frame },
    overallNote: nextStageDraft.overallNote,
    groups: nextStageDraft.groups.map((group) => ({ ...group, itemIds: [...group.itemIds] })),
    rectangles,
    texts,
    images,
    stages,
    ...(draft.stateTabs && stageId === UI_SKETCH_END_STAGE_ID && !targetStage
      ? { stateTabs: [...uiSketchStateTabs(draft), {
          id: UI_SKETCH_END_STAGE_ID,
          number: Math.max(...uiSketchStateTabs(draft).map((tab) => tab.number)) + 1,
        }] }
      : {}),
  };
}

export function updateUiSketchImageCrop(
  draft: UiSketchDraft,
  id: string,
  crop: UiSketchImage["crop"],
  aspectRatio: number,
): UiSketchDraft {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    throw new Error("Image aspect ratio must be greater than zero.");
  }
  if (crop) validateImageCrop(crop);
  const next = cloneUiSketchDraft(draft);
  const image = next.images.find((candidate) => candidate.id === id);
  if (!image) throw new Error(`Unknown UI sketch image: ${id}.`);
  image.crop = crop ? { ...crop } : null;
  const height = image.width / aspectRatio;
  image.y += (image.height - height) / 2;
  image.height = height;
  next.stages.forEach((stage) => {
    const imageState = stage.images.find((candidate) => candidate.id === id);
    if (!imageState) return;
    const stageHeight = imageState.width / aspectRatio;
    imageState.y += (imageState.height - stageHeight) / 2;
    imageState.height = stageHeight;
  });
  return next;
}

function resolveUiSketchStage(
  draft: UiSketchDraft,
  stageId: string,
): UiSketchStage | undefined {
  return draft.stages.find((candidate) => candidate.id === stageId)
    ?? (stageId === UI_SKETCH_END_STAGE_ID ? draft.stages[0] : undefined);
}

export function validateUiSketchDraft(input: unknown): UiSketchDraft {
  const normalizedInput = normalizeItemMetadata(input);
  if (!validateSchema(normalizedInput)) {
    throw new Error(formatValidationErrors(validateSchema.errors));
  }
  const draft = cloneUiSketchDraft(normalizedInput as UiSketchDraft);
  const ids = new Set<string>();
  for (const item of [...draft.rectangles, ...draft.texts, ...draft.images]) {
    if (ids.has(item.id)) throw new Error(`Duplicate UI sketch item id: ${item.id}.`);
    ids.add(item.id);
  }
  if (draft.layerOrder) draft.layerOrder = uiSketchLayerOrder(draft);
  draft.images.forEach((image) => {
    if (image.crop) validateImageCrop(image.crop);
  });
  const groupedIds = new Set<string>();
  const groupIds = new Set<string>();
  for (const group of draft.groups) {
    if (groupIds.has(group.id) || ids.has(group.id)) {
      throw new Error(`Duplicate UI sketch group id: ${group.id}.`);
    }
    groupIds.add(group.id);
    for (const id of group.itemIds) {
      if (!ids.has(id)) throw new Error(`Unknown UI sketch group member: ${id}.`);
      if (groupedIds.has(id)) throw new Error(`UI sketch item belongs to multiple groups: ${id}.`);
      groupedIds.add(id);
    }
  }
  const stageIds = new Set<string>();
  for (const stage of draft.stages) {
    if (stage.id === UI_SKETCH_START_STAGE_ID || stageIds.has(stage.id)) {
      throw new Error(`Duplicate UI sketch stage id: ${stage.id}.`);
    }
    stageIds.add(stage.id);
    assertStageItemIds(
      stage,
      new Set(draft.rectangles.map((item) => item.id)),
      new Set(draft.texts.map((item) => item.id)),
      new Set(draft.images.map((item) => item.id)),
    );
  }
  if (draft.stateTabs) {
    const tabIds = new Set(draft.stateTabs.map((tab) => tab.id));
    if (
      tabIds.size !== draft.stateTabs.length
      || [...tabIds].some((id) => id !== UI_SKETCH_START_STAGE_ID && !stageIds.has(id))
      || [...stageIds].some((id) => !tabIds.has(id))
    ) throw new Error("UI sketch state tabs must reference every snapshot exactly once.");
  }
  return draft;
}

function normalizeItemMetadata(input: unknown): unknown {
  if (
    !input
    || typeof input !== "object"
  ) {
    return input;
  }
  const rectangles = "rectangles" in input && Array.isArray(input.rectangles)
    ? input.rectangles
    : null;
  const texts = "texts" in input && Array.isArray(input.texts)
    ? input.texts
    : null;
  const images = "images" in input && Array.isArray(input.images)
    ? input.images
    : [];
  const stages = "stages" in input && Array.isArray(input.stages)
    ? input.stages
    : [];
  return {
    ...input,
    ...(!("groups" in input) ? { groups: [] } : {}),
    ...(rectangles
      ? {
          rectangles: rectangles.map((rectangle: unknown) => (
            normalizeUiSketchItem(rectangle)
          )),
        }
      : {}),
    ...(texts
      ? {
          texts: texts.map((text: unknown) => (
            normalizeUiSketchItem(text)
          )),
        }
      : {}),
    images: images.map((image: unknown) => normalizeUiSketchImage(image)),
    stages: stages.map(normalizeStage),
  };
}

function normalizeUiSketchItem(input: unknown): unknown {
  const normalized = normalizeHuman2AiCanvasNodeMetadata(input);
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    return normalized;
  }
  return {
    ...normalized,
    ...(!("weight" in normalized) ? { weight: "auto" } : {}),
    ...(!("visible" in normalized) ? { visible: true } : {}),
  };
}

function normalizeUiSketchImage(input: unknown): unknown {
  const normalized = normalizeUiSketchItem(input);
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    return normalized;
  }
  return {
    assetId: null,
    crop: null,
    ...normalized,
  };
}

function normalizeStage(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  return {
    ...input,
    ...("rectangles" in input && Array.isArray(input.rectangles)
      ? { rectangles: input.rectangles.map(normalizeStageItem) }
      : {}),
    ...("texts" in input && Array.isArray(input.texts)
      ? { texts: input.texts.map(normalizeStageItem) }
      : {}),
    ...("images" in input && Array.isArray(input.images)
      ? { images: input.images.map(normalizeStageItem) }
      : { images: [] }),
  };
}

function normalizeStageItem(input: unknown): unknown {
  return input && typeof input === "object" && !("visible" in input)
    ? { ...input, visible: true }
    : input;
}

function rectangleStageState(rectangle: UiSketchRectangle) {
  const { id, x, y, width, height, visible } = rectangle;
  return { id, x, y, width, height, visible };
}

function textStageState(text: UiSketchText) {
  const { id, x, y, fontSize, visible } = text;
  return { id, x, y, fontSize, visible };
}

function imageStageState(image: UiSketchImage) {
  const { id, x, y, width, height, visible } = image;
  return { id, x, y, width, height, visible };
}

function cloneStage(stage: UiSketchStage): UiSketchStage {
  return {
    ...stage,
    rectangles: stage.rectangles.map((state) => ({ ...state })),
    texts: stage.texts.map((state) => ({ ...state })),
    images: stage.images.map((state) => ({ ...state })),
  };
}

function assertStageItemIds(
  stage: UiSketchStage,
  rectangleIds: Set<string>,
  textIds: Set<string>,
  imageIds: Set<string>,
): void {
  const stageRectangleIds = stage.rectangles.map((item) => item.id);
  const stageTextIds = stage.texts.map((item) => item.id);
  const stageImageIds = stage.images.map((item) => item.id);
  if (
    !sameIds(stageRectangleIds, rectangleIds)
    || !sameIds(stageTextIds, textIds)
    || !sameIds(stageImageIds, imageIds)
  ) {
    throw new Error(`UI sketch stage ${stage.id} must contain each draft item exactly once.`);
  }
}

function validateImageCrop(crop: { x: number; y: number; width: number; height: number }): void {
  if (crop.x + crop.width > 1 + 1e-9 || crop.y + crop.height > 1 + 1e-9) {
    throw new Error("Image crop must stay inside the source image.");
  }
}

function sameIds(ids: string[], expected: Set<string>): boolean {
  return ids.length === expected.size
    && new Set(ids).size === ids.length
    && ids.every((id) => expected.has(id));
}

function formatValidationErrors(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map((error) => {
      if (error.keyword === "additionalProperties") {
        return `${error.instancePath || "draft"} contains unknown field: ${String(error.params.additionalProperty)}`;
      }
      return `${error.instancePath || "draft"} ${error.message ?? "is invalid"}`;
    })
    .join("; ");
}
