import { compositionLayerOrder } from "./layers.ts";
import { normalizeCompositionStates } from "./states.ts";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import compositionDraftSchema from "../../../schemas/composition-draft.schema.json" with {
  type: "json",
};
import {
  createHuman2AiCanvasNodeMetadata,
  normalizeHuman2AiCanvasNodeMetadata,
} from "../canvas-node-metadata.ts";
import {
  calculateVisibleAreaMetrics,
  freeDimensionsFromArea,
  areaGeometry,
  isConvexTextOutline,
  polygonArea,
} from "./geometry.ts";
import {
  COMPOSITION_CANVAS,
  changeCompositionFrameSize,
  compositionSymmetryRotations,
  createCompositionFrame,
  isCompositionFrameRatioSupported,
  moveCompositionFrame,
  resizeCompositionFrame,
  resizeCompositionFrameToBounds,
} from "./frame.ts";
import type {
  AddCompositionImageOptions,
  AddAreaOptions,
  AreaAspect,
  CompositionArea,
  CompositionAreaMetadataPatch,
  CompositionClipboardItem,
  CompositionDraft,
  CompositionFrame,
  CompositionFrameBounds,
  CompositionFrameCorner,
  CompositionFrameSize,
  CompositionImage,
  CompositionNodeMetadata,
  CompositionNodeMetadataPatch,
  PasteCompositionItemsResult,
  CompositionProcessingSemantic,
  CompositionVisualWeight,
  Point,
  Primitive,
  VisibleAreaMetrics,
} from "./types.ts";

export const MAX_FOCUS_POINTS = 3;
export const PRIMITIVES: readonly Primitive[] = ["circle", "triangle", "quadrilateral"];
export const ASPECTS: readonly AreaAspect[] = ["square", "free", "landscape", "portrait"];
export const COMPOSITION_TEXT_REGION_SEMANTIC_TYPE = "text-region";
export const COMPOSITION_PROCESSING_SEMANTICS: readonly CompositionProcessingSemantic[] = [
  "scene-composition",
  "editorial-layout",
];
export const COMPOSITION_VISUAL_WEIGHTS: readonly CompositionVisualWeight[] = [
  "auto",
  "high",
  "medium",
  "low",
  "decorative",
];

type DraftInput = Omit<CompositionDraft, "directionLine" | "frame"> &
  Partial<Pick<CompositionDraft, "directionLine">> & {
    frame: CompositionFrameSize & { bounds?: CompositionFrameBounds };
  };

const ajv = new Ajv2020({ allErrors: true });
const validateSchema = ajv.compile<DraftInput>(compositionDraftSchema);

export function createDraft(
  frame: CompositionFrameSize = { width: 1600, height: 900 },
): CompositionDraft {
  return validateDraft({
    version: 1,
    kind: "composition-draft",
    processingSemantic: null,
    frame: createCompositionFrame(frame),
    overallNote: "",
    focusPoints: [],
    directionLine: null,
    areas: [],
    images: [],
    plans: [{ id: "plan-1", type: "thirds", axes: "both", visible: true }],
  });
}

export function validateDraft(input: unknown): CompositionDraft {
  const normalizedInput = normalizeCompositionItemMetadata(normalizeLegacyCompositionPlanning(input));
  if (!validateSchema(normalizedInput)) {
    throw new Error(formatValidationErrors(validateSchema.errors));
  }

  const validatedInput = normalizedInput as DraftInput;
  validateFrame(validatedInput.frame);
  const legacyFrame = !validatedInput.frame.bounds;
  const draft = structuredClone(validatedInput) as unknown as CompositionDraft;
  draft.frame = legacyFrame
    ? createCompositionFrame(validatedInput.frame)
    : structuredClone(validatedInput.frame as CompositionFrame);
  if (legacyFrame) migrateLegacyDraftCoordinates(draft);
  if (draft.plans && new Set(draft.plans.map((plan) => plan.id)).size !== draft.plans.length) {
    throw new Error("Composition planning ids must be unique within a state.");
  }
  if (draft.plans) draft.plans = draft.plans.map((plan) => {
    const base = { id: plan.id, visible: plan.visible };
    if (plan.type === "triangle") return { ...base, type: plan.type, x: plan.x, y: plan.y, rotation: normalizeRotation(plan.rotation), width: plan.width, height: plan.height };
    if (plan.type === "radial") return plan.mode === "free"
      ? { ...base, type: plan.type, x: plan.x, y: plan.y, mode: plan.mode, angles: plan.angles.map(normalizeRotation) }
      : { ...base, type: plan.type, x: plan.x, y: plan.y, mode: plan.mode, rotation: normalizeRotation(plan.rotation), rayCount: plan.rayCount, spread: plan.spread };
    if (plan.type === "symmetry") return { ...base, type: plan.type, x: 0.5, y: 0.5, rotation: normalizeCompositionSymmetryRotation(plan.rotation, draft.frame) };
    if (plan.type === "golden-spiral") {
      const transform = { x: plan.x, y: plan.y, rotation: normalizeRotation(plan.rotation) };
      return { ...base, type: plan.type, ...transform, scale: plan.scale, mirrored: plan.mirrored };
    }
    return { ...base, type: plan.type, axes: plan.axes };
  });
  const ids = new Set<string>();
  for (const item of [
    ...draft.focusPoints,
    ...(draft.directionLine ? [draft.directionLine] : []),
    ...draft.areas,
    ...draft.images,
  ]) {
    if (ids.has(item.id)) throw new Error(`Duplicate draft item id: ${item.id}.`);
    ids.add(item.id);
  }

  draft.directionLine = draft.directionLine
    ? { ...draft.directionLine, rotation: normalizeRotation(draft.directionLine.rotation) }
    : null;
  draft.areas.forEach((area) => {
    if (area.corners) {
      if (!isConvexTextOutline(area.corners)) throw new Error("Text region corners must form a convex quadrilateral.");
      const xs = area.corners.map((point) => point.x), ys = area.corners.map((point) => point.y);
      if (Math.min(...xs) > 1e-8 || Math.min(...ys) > 1e-8
        || Math.max(...xs) < 1 - 1e-8 || Math.max(...ys) < 1 - 1e-8) {
        throw new Error("Text region corners must span their normalized bounding box.");
      }
      area.area = area.width! * area.height! * polygonArea(area.corners);
    }
    if (area.primitive === "circle" && area.aspect !== "free") area.rotation = 0;
    if (
      area.primitive === "quadrilateral" &&
      (area.aspect === "landscape" || area.aspect === "portrait")
    ) {
      Object.assign(
        area,
        freeDimensionsFromArea(
          area.area,
          COMPOSITION_CANVAS,
          area.aspect === "landscape" ? 1.6 : 0.625,
          area.primitive,
        ),
      );
      area.aspect = "free";
    }
  });
  if (draft.layerOrder) draft.layerOrder = compositionLayerOrder(draft);
  draft.images.forEach((image) => {
    image.rotation = normalizeRotation(image.rotation);
    if (image.crop) validateImageCrop(image.crop);
  });
  return normalizeCompositionStates(draft);
}

export function addFocus(
  input: CompositionDraft,
  point: Point,
): { draft: CompositionDraft; id: string } {
  const draft = validateDraft(input);
  if (draft.focusPoints.length >= MAX_FOCUS_POINTS) {
    throw new Error(`A draft may contain at most ${MAX_FOCUS_POINTS} focus points.`);
  }
  const focus = {
    id: nextId("focus", [...draft.focusPoints, ...draft.areas]),
    x: point.x,
    y: point.y,
    ...createCompositionNodeMetadata(),
  };
  draft.focusPoints.push(focus);
  return { draft, id: focus.id };
}

export function addArea(
  input: CompositionDraft,
  options: AddAreaOptions,
): { draft: CompositionDraft; id: string } {
  const draft = validateDraft(input);
  if (!PRIMITIVES.includes(options.primitive)) {
    throw new Error(`Unsupported primitive: ${options.primitive}.`);
  }
  const initialArea = Number(options.area) > 0 ? Number(options.area) : 0.08;
  const aspect = options.aspect && ASPECTS.includes(options.aspect) ? options.aspect : "square";
  let area: CompositionArea = {
    id: nextId("area", [...draft.focusPoints, ...draft.areas]),
    primitive: options.primitive,
    x: Number.isFinite(options.x) ? options.x! : 0.5,
    y: Number.isFinite(options.y) ? options.y! : 0.5,
    area: initialArea,
    aspect,
    visualWeight: "auto",
    rotation: options.primitive === "circle" ? 0 : normalizeRotation(Number(options.rotation) || 0),
    ...createCompositionNodeMetadata(),
  };
  if (aspect === "free") {
    Object.assign(
      area,
      freeDimensionsFromArea(initialArea, COMPOSITION_CANVAS, 1.6, options.primitive),
    );
  }
  draft.areas.push(area);
  return { draft, id: area.id };
}

export function addTextRegion(
  input: CompositionDraft,
  options: Omit<AddAreaOptions, "primitive" | "aspect"> = {},
): { draft: CompositionDraft; id: string } {
  const added = addArea(input, {
    ...options,
    primitive: "quadrilateral",
    aspect: "free",
  });
  const marked = updateItemMetadata(added.draft, added.id, {
    semanticType: COMPOSITION_TEXT_REGION_SEMANTIC_TYPE,
  });
  return {
    draft: updateAreaMetadata(marked, added.id, { displayText: "" }),
    id: added.id,
  };
}

export function addCompositionImage(
  input: CompositionDraft,
  options: AddCompositionImageOptions = {},
): { draft: CompositionDraft; id: string } {
  const draft = validateDraft(input);
  const image: CompositionImage = {
    id: nextId("image", [...draft.focusPoints, ...draft.areas, ...draft.images]),
    x: Number.isFinite(options.x)
      ? options.x!
      : draft.frame.bounds.x + draft.frame.bounds.width / 2,
    y: Number.isFinite(options.y)
      ? options.y!
      : draft.frame.bounds.y + draft.frame.bounds.height / 2,
    width: Number.isFinite(options.width) && options.width! > 0
      ? options.width!
      : 320 / COMPOSITION_CANVAS.width,
    height: Number.isFinite(options.height) && options.height! > 0
      ? options.height!
      : 180 / COMPOSITION_CANVAS.height,
    rotation: normalizeRotation(Number(options.rotation) || 0),
    visualWeight: "auto",
    assetId: null,
    crop: null,
    ...createCompositionNodeMetadata(),
  };
  draft.images.push(image);
  return { draft, id: image.id };
}

export function isCompositionTextRegion(
  area: Pick<CompositionArea, "semanticType">,
): boolean {
  return area.semanticType === COMPOSITION_TEXT_REGION_SEMANTIC_TYPE;
}

export function addDirectionLine(
  input: CompositionDraft,
): { draft: CompositionDraft; id: "direction-1" } {
  const draft = validateDraft(input);
  if (draft.directionLine) {
    throw new Error("A draft may contain at most one direction line.");
  }
  draft.directionLine = {
    id: "direction-1",
    x: 0.5,
    y: 0.5,
    rotation: 0,
    ...createCompositionNodeMetadata(),
  };
  return { draft, id: draft.directionLine.id };
}

export function copyCompositionItems(
  input: CompositionDraft,
  ids: readonly string[],
): CompositionClipboardItem[] {
  const draft = validateDraft(input);
  return [...new Set(ids)].flatMap((id): CompositionClipboardItem[] => {
    const focus = draft.focusPoints.find((item) => item.id === id);
    if (focus) return [{ kind: "focus", item: structuredClone(focus) }];
    const area = draft.areas.find((item) => item.id === id);
    if (area) return [{ kind: "area", item: structuredClone(area) }];
    const image = draft.images.find((item) => item.id === id);
    if (image) return [{ kind: "image", item: structuredClone(image) }];
    if (draft.directionLine?.id === id) {
      return [{ kind: "direction", item: structuredClone(draft.directionLine) }];
    }
    return [];
  });
}

export function pasteCompositionItems(
  input: CompositionDraft,
  clipboard: readonly CompositionClipboardItem[],
  offset: Point,
): PasteCompositionItemsResult {
  const draft = validateDraft(input);
  const ids: string[] = [];

  for (const entry of clipboard) {
    if (entry.kind === "focus") {
      if (draft.focusPoints.length >= MAX_FOCUS_POINTS) continue;
      const item = {
        ...structuredClone(entry.item),
        id: nextId("focus", [...draft.focusPoints, ...draft.areas]),
        x: entry.item.x + offset.x,
        y: entry.item.y + offset.y,
      };
      draft.focusPoints.push(item);
      ids.push(item.id);
      continue;
    }
    if (entry.kind === "area") {
      const item = {
        ...structuredClone(entry.item),
        id: nextId("area", [...draft.focusPoints, ...draft.areas]),
        x: entry.item.x + offset.x,
        y: entry.item.y + offset.y,
      };
      draft.areas.push(item);
      ids.push(item.id);
      continue;
    }
    if (entry.kind === "image") {
      const item = {
        ...structuredClone(entry.item),
        id: nextId("image", [...draft.focusPoints, ...draft.areas, ...draft.images]),
        x: entry.item.x + offset.x,
        y: entry.item.y + offset.y,
      };
      draft.images.push(item);
      ids.push(item.id);
      continue;
    }
    if (!draft.directionLine) {
      draft.directionLine = {
        ...structuredClone(entry.item),
        id: "direction-1",
        x: entry.item.x + offset.x,
        y: entry.item.y + offset.y,
      };
      ids.push(draft.directionLine.id);
    }
  }

  return { draft: validateDraft(draft), ids };
}

export function moveItem(input: CompositionDraft, id: string, point: Point): CompositionDraft {
  const draft = validateDraft(input);
  const focus = draft.focusPoints.find((item) => item.id === id);
  if (focus) {
    focus.x = point.x;
    focus.y = point.y;
    return draft;
  }
  if (draft.directionLine?.id === id) {
    draft.directionLine.x = point.x;
    draft.directionLine.y = point.y;
    return draft;
  }

  const item = draft.areas.find((candidate) => candidate.id === id)
    ?? draft.images.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown draft item: ${id}.`);
  item.x = point.x;
  item.y = point.y;
  return draft;
}

export function moveTextRegionCorner(
  input: CompositionDraft,
  id: string,
  index: number,
  point: Point,
): CompositionDraft {
  const draft = validateDraft(input);
  const area = findArea(draft, id);
  if (!isCompositionTextRegion(area) || !Number.isInteger(index) || index < 0 || index > 3) return input;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return input;
  const geometry = areaGeometry({ ...area, x: 0, y: 0, rotation: 0 }, COMPOSITION_CANVAS);
  if (geometry.type !== "polygon") return input;
  const angle = (area.rotation ?? 0) * Math.PI / 180;
  const dx = (point.x - area.x) * COMPOSITION_CANVAS.width;
  const dy = (point.y - area.y) * COMPOSITION_CANVAS.height;
  geometry.points[index] = {
    x: dx * Math.cos(angle) + dy * Math.sin(angle),
    y: -dx * Math.sin(angle) + dy * Math.cos(angle),
  };
  const xs = geometry.points.map((point) => point.x);
  const ys = geometry.points.map((point) => point.y);
  const left = Math.min(...xs), top = Math.min(...ys);
  const width = Math.max(...xs) - left, height = Math.max(...ys) - top;
  if (width < 8 || height < 8) return input;
  const corners = geometry.points.map((point) => ({
    x: (point.x - left) / width, y: (point.y - top) / height,
  })) as NonNullable<CompositionArea["corners"]>;
  if (!isConvexTextOutline(corners)) return input;
  const offsetX = left + width / 2, offsetY = top + height / 2;
  area.x += (offsetX * Math.cos(angle) - offsetY * Math.sin(angle)) / COMPOSITION_CANVAS.width;
  area.y += (offsetX * Math.sin(angle) + offsetY * Math.cos(angle)) / COMPOSITION_CANVAS.height;
  area.width = width / COMPOSITION_CANVAS.width;
  area.height = height / COMPOSITION_CANVAS.height;
  area.aspect = "free";
  area.corners = corners;
  area.area = area.width * area.height * polygonArea(corners);
  return draft;
}

export function resizeArea(
  input: CompositionDraft,
  id: string,
  nextArea: number,
): CompositionDraft {
  const draft = validateDraft(input);
  const area = findArea(draft, id);
  if (!Number.isFinite(nextArea) || nextArea <= 0) return draft;
  if (area.aspect === "free") {
    const scale = Math.sqrt(nextArea / (area.corners ? area.area : area.width! * area.height!));
    area.width! *= scale;
    area.height! *= scale;
  }
  area.area = nextArea;
  return draft;
}

export function resizeFreeArea(
  input: CompositionDraft,
  id: string,
  width: number,
  height: number,
): CompositionDraft {
  const draft = validateDraft(input);
  const area = draft.areas.find((item) => item.id === id);
  if (!area) throw new Error(`Unknown free area: ${id}.`);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return draft;
  }
  area.width = width;
  area.height = height;
  area.aspect = "free";
  const areaFactor = area.corners ? polygonArea(area.corners)
    : area.primitive === "circle" ? Math.PI / 4 : area.primitive === "triangle" ? 0.5 : 1;
  area.area = width * height * areaFactor;
  return draft;
}

export function rotateArea(
  input: CompositionDraft,
  id: string,
  rotation: number,
): CompositionDraft {
  const draft = validateDraft(input);
  const area = findArea(draft, id);
  if (area.primitive === "circle" && area.aspect !== "free") return draft;
  area.rotation = normalizeRotation(rotation);
  return draft;
}

export function resizeCompositionImage(
  input: CompositionDraft,
  id: string,
  width: number,
  height: number,
): CompositionDraft {
  const draft = validateDraft(input);
  const image = findImage(draft, id);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return draft;
  }
  image.width = width;
  image.height = height;
  return draft;
}

export function rotateCompositionImage(
  input: CompositionDraft,
  id: string,
  rotation: number,
): CompositionDraft {
  const draft = validateDraft(input);
  findImage(draft, id).rotation = normalizeRotation(rotation);
  return draft;
}

export function rotateDirectionLine(
  input: CompositionDraft,
  id: string,
  rotation: number,
): CompositionDraft {
  const draft = validateDraft(input);
  if (draft.directionLine?.id !== id) {
    throw new Error(`Unknown draft direction line: ${id}.`);
  }
  draft.directionLine.rotation = normalizeRotation(rotation);
  return draft;
}

export function setAreaAspect(
  input: CompositionDraft,
  id: string,
  aspect: AreaAspect,
): CompositionDraft {
  const draft = validateDraft(input);
  if (!ASPECTS.includes(aspect)) throw new Error(`Unsupported aspect: ${aspect}.`);
  const area = findArea(draft, id);
  area.aspect = aspect;
  if (aspect === "free" && (!area.width || !area.height)) {
    Object.assign(
      area,
      freeDimensionsFromArea(area.area, COMPOSITION_CANVAS, 1.6, area.primitive),
    );
  } else if (aspect !== "free") {
    delete area.corners;
    delete area.width;
    delete area.height;
  }
  return draft;
}

export function removeItem(input: CompositionDraft, id: string): CompositionDraft {
  const draft = validateDraft(input);
  draft.focusPoints = draft.focusPoints.filter((item) => item.id !== id);
  draft.areas = draft.areas.filter((item) => item.id !== id);
  draft.images = draft.images.filter((item) => item.id !== id);
  if (draft.directionLine?.id === id) draft.directionLine = null;
  if (draft.layerOrder) draft.layerOrder = compositionLayerOrder(draft);
  return draft;
}

export function updateItemMetadata(
  input: CompositionDraft,
  id: string,
  patch: CompositionNodeMetadataPatch,
): CompositionDraft {
  const draft = validateDraft(input);
  const item = draft.focusPoints.find((candidate) => candidate.id === id)
    ?? draft.areas.find((candidate) => candidate.id === id)
    ?? draft.images.find((candidate) => candidate.id === id)
    ?? (draft.directionLine?.id === id ? draft.directionLine : null);
  if (!item) throw new Error(`Unknown draft item: ${id}.`);
  Object.assign(item, patch);
  return draft;
}

export function updateAreaMetadata(
  input: CompositionDraft,
  id: string,
  patch: CompositionAreaMetadataPatch,
): CompositionDraft {
  const draft = validateDraft(input);
  const area = findArea(draft, id);
  if (
    patch.visualWeight !== undefined
    && !COMPOSITION_VISUAL_WEIGHTS.includes(patch.visualWeight)
  ) {
    throw new Error(`Unsupported visual weight: ${patch.visualWeight}.`);
  }
  if (patch.displayText !== undefined && !isCompositionTextRegion(area)) {
    throw new Error(`Display text is only supported by text regions: ${id}.`);
  }
  if (patch.visualWeight !== undefined) area.visualWeight = patch.visualWeight;
  if (patch.displayText !== undefined) area.displayText = patch.displayText;
  if (patch.isLightSource !== undefined) area.isLightSource = patch.isLightSource;
  return validateDraft(draft);
}

export function updateCompositionImage(
  input: CompositionDraft,
  id: string,
  patch: Partial<Pick<CompositionImage, "assetId" | "crop" | "visualWeight">>,
): CompositionDraft {
  const draft = validateDraft(input);
  const image = findImage(draft, id);
  if (
    patch.visualWeight !== undefined
    && !COMPOSITION_VISUAL_WEIGHTS.includes(patch.visualWeight)
  ) {
    throw new Error(`Unsupported visual weight: ${patch.visualWeight}.`);
  }
  if (patch.assetId !== undefined && patch.assetId !== null && !patch.assetId.trim()) {
    throw new Error("Image asset id cannot be empty.");
  }
  if (patch.crop) validateImageCrop(patch.crop);
  Object.assign(image, patch);
  return draft;
}

export function setProcessingSemantic(
  input: CompositionDraft,
  processingSemantic: CompositionProcessingSemantic,
): CompositionDraft {
  const draft = validateDraft(input);
  if (!COMPOSITION_PROCESSING_SEMANTICS.includes(processingSemantic)) {
    throw new Error(`Unsupported processing semantic: ${processingSemantic}.`);
  }
  draft.processingSemantic = processingSemantic;
  return draft;
}

export function changeFrame(
  input: CompositionDraft,
  frame: CompositionFrameSize,
): CompositionDraft {
  const draft = validateDraft(input);
  validateFrame(frame);
  draft.frame = changeCompositionFrameSize(draft.frame, frame);
  if (draft.plans) draft.plans = draft.plans.map((plan) => {
    if (plan.type !== "symmetry") return plan;
    // Corner-aligned axes follow the new ratio; the original eight directions stay fixed.
    if (Math.abs(plan.rotation / 45 - Math.round(plan.rotation / 45)) < 1e-8) return plan;
    const angle = plan.rotation * Math.PI / 180;
    const rotation = Math.atan2(Math.sin(angle) * frame.height / input.frame.height,
      Math.cos(angle) * frame.width / input.frame.width) * 180 / Math.PI;
    return { ...plan, rotation: normalizeCompositionSymmetryRotation(rotation, draft.frame) };
  });
  return draft;
}

export function moveFrame(input: CompositionDraft, point: Point): CompositionDraft {
  const draft = validateDraft(input);
  draft.frame = moveCompositionFrame(draft.frame, point);
  return draft;
}

export function resizeFrame(
  input: CompositionDraft,
  scale: number,
  corner: CompositionFrameCorner = "bottom-right",
): CompositionDraft {
  const draft = validateDraft(input);
  if (!Number.isFinite(scale) || scale <= 0) return draft;
  draft.frame = resizeCompositionFrame(draft.frame, scale, corner);
  return draft;
}

export function resizeFrameToBounds(
  input: CompositionDraft,
  bounds: CompositionFrameBounds,
): CompositionDraft {
  const draft = validateDraft(input);
  draft.frame = resizeCompositionFrameToBounds(draft.frame, bounds);
  return draft;
}

export function visibleAreaMetrics(input: CompositionDraft): VisibleAreaMetrics {
  return calculateVisibleAreaMetrics(validateDraft(input));
}

function validateFrame(frame: unknown): asserts frame is CompositionFrame {
  if (!frame || typeof frame !== "object" || Array.isArray(frame)) {
    throw new Error("draft.frame must be an object.");
  }
  const values = frame as Record<string, unknown>;
  const unknownFields = Object.keys(values).filter(
    (key) => key !== "width" && key !== "height" && key !== "bounds",
  );
  if (unknownFields.length > 0) {
    throw new Error(`draft.frame contains unknown fields: ${unknownFields.join(", ")}.`);
  }
  for (const key of ["width", "height"] as const) {
    if (
      !Number.isInteger(values[key]) ||
      (values[key] as number) < 256 ||
      (values[key] as number) > 4096
    ) {
      throw new Error(`draft.frame.${key} must be an integer from 256 to 4096.`);
    }
  }
  const ratio = (values.width as number) / (values.height as number);
  if (!isCompositionFrameRatioSupported(values.width as number, values.height as number)) {
    throw new Error("Draft aspect ratio must be between 1:2 and 2:1.");
  }
  if (values.bounds !== undefined) validateFrameBounds(values.bounds, ratio);
}

function normalizeLegacyCompositionPlanning(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const source = input as Record<string, unknown>;
  const frame = source.frame as CompositionFrame | undefined;
  const plans = Array.isArray(source.plans) ? source.plans.map((inputPlan) => {
    if (!inputPlan || typeof inputPlan !== "object" || Array.isArray(inputPlan)) return inputPlan;
    const { enabled: _enabled, note: _note, ...plan } = inputPlan;
    if (plan.type === "radial" && plan.mode === undefined) return { ...plan, mode: "uniform" };
    if (plan?.type !== "triangle" || !Array.isArray(plan.points) || plan.points.length !== 3
      || !plan.points.every((p: Point) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
      || !frame || !Number.isFinite(frame.width) || !Number.isFinite(frame.height) || frame.width <= 0 || frame.height <= 0) return plan;
    const [apex, left, right] = plan.points.map((p: Point) => ({ x: p.x * frame.width, y: p.y * frame.height }));
    const dx = right.x - left.x, dy = right.y - left.y;
    const width = Math.hypot(dx, dy);
    if (width === 0) return plan;
    const mid = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
    const height = ((mid.x - apex.x) * -dy + (mid.y - apex.y) * dx) / width;
    if (height === 0) return plan;
    const { points: _points, ...base } = plan;
    return { ...base, x: (mid.x + dy / width * height / 2) / frame.width,
      y: (mid.y - dx / width * height / 2) / frame.height,
      rotation: Math.atan2(dy, dx) * 180 / Math.PI + (height < 0 ? 180 : 0),
      width: width / frame.width, height: Math.abs(height) / frame.height };
  }) : undefined;
  const states = Array.isArray(source.states) ? source.states.map((state) => state && typeof state === "object"
    ? { ...state, layout: normalizeLegacyCompositionPlanning(state.layout) } : state) : undefined;
  return { ...source, ...(plans ? { plans } : {}), ...(states ? { states } : {}) };
}

function normalizeCompositionItemMetadata(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const focusPoints = "focusPoints" in input && Array.isArray(input.focusPoints)
    ? input.focusPoints.map(normalizeCompositionNodeMetadata)
    : undefined;
  const areas = "areas" in input && Array.isArray(input.areas)
    ? input.areas.map(normalizeCompositionAreaMetadata)
    : undefined;
  const images = "images" in input && Array.isArray(input.images)
    ? input.images.map(normalizeCompositionImageMetadata)
    : [];
  const directionLine = "directionLine" in input
    ? input.directionLine === null
      ? null
      : normalizeCompositionNodeMetadata(input.directionLine)
    : undefined;
  return {
    ...input,
    ...(!("processingSemantic" in input)
      ? { processingSemantic: null }
      : {}),
    ...(!("overallNote" in input) ? { overallNote: "" } : {}),
    ...(focusPoints ? { focusPoints } : {}),
    ...(areas ? { areas } : {}),
    images,
    ...(directionLine !== undefined ? { directionLine } : {}),
  };
}

function createCompositionNodeMetadata(): CompositionNodeMetadata {
  return {
    ...createHuman2AiCanvasNodeMetadata(),
    shotScale: "auto",
  };
}

function normalizeCompositionNodeMetadata(input: unknown): unknown {
  const normalized = normalizeHuman2AiCanvasNodeMetadata(input);
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    return normalized;
  }
  return { shotScale: "auto", ...normalized };
}

function normalizeCompositionAreaMetadata(input: unknown): unknown {
  const normalized = normalizeCompositionNodeMetadata(input);
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    return normalized;
  }
  const area: Record<string, unknown> = {
    visualWeight: "auto",
    ...normalized as Record<string, unknown>,
  };
  return area.semanticType === COMPOSITION_TEXT_REGION_SEMANTIC_TYPE
    && !("displayText" in area)
    ? { ...area, displayText: "" }
    : area;
}

function normalizeCompositionImageMetadata(input: unknown): unknown {
  const normalized = normalizeCompositionNodeMetadata(input);
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    return normalized;
  }
  return {
    visualWeight: "auto",
    assetId: null,
    crop: null,
    ...normalized as Record<string, unknown>,
  };
}

function validateFrameBounds(bounds: unknown, ratio: number): void {
  if (!bounds || typeof bounds !== "object" || Array.isArray(bounds)) {
    throw new Error("draft.frame.bounds must be an object.");
  }
  const values = bounds as Record<string, unknown>;
  const unknownFields = Object.keys(values).filter(
    (key) => !["x", "y", "width", "height"].includes(key),
  );
  if (unknownFields.length > 0) {
    throw new Error(`draft.frame.bounds contains unknown fields: ${unknownFields.join(", ")}.`);
  }
  for (const key of ["x", "y", "width", "height"] as const) {
    if (!Number.isFinite(values[key])) {
      throw new Error(`draft.frame.bounds.${key} must be a finite number.`);
    }
  }
  const width = values.width as number;
  const height = values.height as number;
  if (width <= 0 || height <= 0) {
    throw new Error("draft.frame.bounds width and height must be positive.");
  }
  const boundsRatio = (width * COMPOSITION_CANVAS.width) / (height * COMPOSITION_CANVAS.height);
  if (Math.abs(boundsRatio - ratio) > 0.002) {
    throw new Error("draft.frame.bounds must match the frame aspect ratio.");
  }
}

function migrateLegacyDraftCoordinates(draft: CompositionDraft): void {
  const bounds = draft.frame.bounds;
  const areaScale = bounds.width * bounds.height;
  const migratePoint = (point: Point): void => {
    point.x = bounds.x + point.x * bounds.width;
    point.y = bounds.y + point.y * bounds.height;
  };
  draft.focusPoints.forEach(migratePoint);
  if (draft.directionLine) migratePoint(draft.directionLine);
  draft.areas.forEach((area) => {
    migratePoint(area);
    area.area *= areaScale;
    if (area.width !== undefined) area.width *= bounds.width;
    if (area.height !== undefined) area.height *= bounds.height;
  });
  draft.images.forEach((image) => {
    migratePoint(image);
    image.width *= bounds.width;
    image.height *= bounds.height;
  });
}

function findArea(draft: CompositionDraft, id: string): CompositionArea {
  const area = draft.areas.find((item) => item.id === id);
  if (!area) throw new Error(`Unknown draft area: ${id}.`);
  return area;
}

function findImage(draft: CompositionDraft, id: string): CompositionImage {
  const image = draft.images.find((item) => item.id === id);
  if (!image) throw new Error(`Unknown draft image: ${id}.`);
  return image;
}

function nextId(prefix: "focus" | "area" | "image", items: Array<{ id: string }>): string {
  const used = new Set(items.map((item) => item.id));
  let index = 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function validateImageCrop(crop: { x: number; y: number; width: number; height: number }): void {
  if (crop.x + crop.width > 1 + 1e-9 || crop.y + crop.height > 1 + 1e-9) {
    throw new Error("Image crop must stay inside the source image.");
  }
}

export function normalizeCompositionSymmetryRotation(value: number, frame: CompositionFrameSize): number {
  const rotation = normalizeRotation(value);
  const distance = (angle: number) => Math.abs(((angle - rotation + 540) % 360) - 180);
  return compositionSymmetryRotations(frame).reduce((closest, angle) => distance(angle) < distance(closest) ? angle : closest);
}

function normalizeRotation(value: number): number {
  return ((value % 360) + 360) % 360;
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
