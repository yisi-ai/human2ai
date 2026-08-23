import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import compositionDraftSchema from "../../../schemas/composition-draft.schema.json" with {
  type: "json",
};
import {
  calculateVisibleAreaMetrics,
  clampAreaCenter,
  freeDimensionsFromArea,
} from "./geometry.ts";
import type {
  AddAreaOptions,
  AreaAspect,
  CompositionArea,
  CompositionDraft,
  CompositionFrame,
  Point,
  Primitive,
  VisibleAreaMetrics,
} from "./types.ts";

export const MAX_FOCUS_POINTS = 3;
export const PRIMITIVES: readonly Primitive[] = ["circle", "triangle", "quadrilateral"];
export const ASPECTS: readonly AreaAspect[] = ["square", "free", "landscape", "portrait"];

type DraftInput = Omit<CompositionDraft, "directionLine"> &
  Partial<Pick<CompositionDraft, "directionLine">>;

const ajv = new Ajv2020({ allErrors: true });
const validateSchema = ajv.compile<DraftInput>(compositionDraftSchema);

export function createDraft(frame: CompositionFrame = { width: 1200, height: 800 }): CompositionDraft {
  return validateDraft({
    version: 1,
    kind: "composition-draft",
    frame,
    focusPoints: [],
    directionLine: null,
    areas: [],
  });
}

export function validateDraft(input: unknown): CompositionDraft {
  if (!validateSchema(input)) {
    throw new Error(formatValidationErrors(validateSchema.errors));
  }

  const validatedInput = input as DraftInput;
  validateFrame(validatedInput.frame);
  const draft = structuredClone(validatedInput) as CompositionDraft;
  const ids = new Set<string>();
  for (const item of [
    ...draft.focusPoints,
    ...(draft.directionLine ? [draft.directionLine] : []),
    ...draft.areas,
  ]) {
    if (ids.has(item.id)) throw new Error(`Duplicate draft item id: ${item.id}.`);
    ids.add(item.id);
  }

  draft.directionLine = draft.directionLine
    ? { ...draft.directionLine, rotation: normalizeRotation(draft.directionLine.rotation) }
    : null;
  draft.areas.forEach((area) => {
    if (area.primitive === "circle") area.rotation = 0;
    if (
      area.primitive === "quadrilateral" &&
      (area.aspect === "landscape" || area.aspect === "portrait")
    ) {
      Object.assign(
        area,
        freeDimensionsFromArea(area.area, draft.frame, area.aspect === "landscape" ? 1.6 : 0.625),
      );
      area.aspect = "free";
    }
  });
  return draft;
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
    x: clamp(point.x, 0, 1),
    y: clamp(point.y, 0, 1),
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
    rotation: options.primitive === "circle" ? 0 : normalizeRotation(Number(options.rotation) || 0),
  };
  if (options.primitive === "quadrilateral" && aspect === "free") {
    Object.assign(area, freeDimensionsFromArea(initialArea, draft.frame));
  }
  area = clampAreaCenter(area, draft.frame);
  draft.areas.push(area);
  return { draft, id: area.id };
}

export function addDirectionLine(
  input: CompositionDraft,
): { draft: CompositionDraft; id: "direction-1" } {
  const draft = validateDraft(input);
  if (draft.directionLine) {
    throw new Error("A draft may contain at most one direction line.");
  }
  draft.directionLine = { id: "direction-1", x: 0.5, y: 0.5, rotation: 0 };
  return { draft, id: draft.directionLine.id };
}

export function moveItem(input: CompositionDraft, id: string, point: Point): CompositionDraft {
  const draft = validateDraft(input);
  const focus = draft.focusPoints.find((item) => item.id === id);
  if (focus) {
    focus.x = clamp(point.x, 0, 1);
    focus.y = clamp(point.y, 0, 1);
    return draft;
  }
  if (draft.directionLine?.id === id) {
    draft.directionLine.x = clamp(point.x, 0, 1);
    draft.directionLine.y = clamp(point.y, 0, 1);
    return draft;
  }

  const area = draft.areas.find((item) => item.id === id);
  if (!area) throw new Error(`Unknown draft item: ${id}.`);
  area.x = point.x;
  area.y = point.y;
  Object.assign(area, clampAreaCenter(area, draft.frame));
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
    const scale = Math.sqrt(nextArea / (area.width! * area.height!));
    area.width! *= scale;
    area.height! *= scale;
  }
  area.area = nextArea;
  Object.assign(area, clampAreaCenter(area, draft.frame));
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
  if (!area || area.primitive !== "quadrilateral" || area.aspect !== "free") {
    throw new Error(`Unknown free quadrilateral: ${id}.`);
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return draft;
  }
  area.width = width;
  area.height = height;
  area.area = width * height;
  Object.assign(area, clampAreaCenter(area, draft.frame));
  return draft;
}

export function rotateArea(
  input: CompositionDraft,
  id: string,
  rotation: number,
): CompositionDraft {
  const draft = validateDraft(input);
  const area = findArea(draft, id);
  if (area.primitive === "circle") return draft;
  area.rotation = normalizeRotation(rotation);
  Object.assign(area, clampAreaCenter(area, draft.frame));
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
    Object.assign(area, freeDimensionsFromArea(area.area, draft.frame));
  } else if (aspect !== "free") {
    delete area.width;
    delete area.height;
  }
  Object.assign(area, clampAreaCenter(area, draft.frame));
  return draft;
}

export function removeItem(input: CompositionDraft, id: string): CompositionDraft {
  const draft = validateDraft(input);
  draft.focusPoints = draft.focusPoints.filter((item) => item.id !== id);
  draft.areas = draft.areas.filter((item) => item.id !== id);
  if (draft.directionLine?.id === id) draft.directionLine = null;
  return draft;
}

export function changeFrame(
  input: CompositionDraft,
  frame: CompositionFrame,
): CompositionDraft {
  const draft = validateDraft(input);
  validateFrame(frame);
  draft.frame = structuredClone(frame);
  draft.areas = draft.areas.map((area) => clampAreaCenter(area, draft.frame));
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
  const unknownFields = Object.keys(values).filter((key) => key !== "width" && key !== "height");
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
  if (ratio < 0.5 || ratio > 2) {
    throw new Error("Draft aspect ratio must be between 1:2 and 2:1.");
  }
}

function findArea(draft: CompositionDraft, id: string): CompositionArea {
  const area = draft.areas.find((item) => item.id === id);
  if (!area) throw new Error(`Unknown draft area: ${id}.`);
  return area;
}

function nextId(prefix: "focus" | "area", items: Array<{ id: string }>): string {
  const used = new Set(items.map((item) => item.id));
  let index = 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function normalizeRotation(value: number): number {
  return ((value % 360) + 360) % 360;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
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
