import { Ajv2020 } from "ajv/dist/2020.js";
import planSchema from "../../../schemas/ui-layout-standardization-plan.schema.json" with { type: "json" };
import { cloneUiSketchDraft, uiSketchDraftFingerprint, validateUiSketchDraft } from "./draft.ts";
import { uiSketchTextBounds } from "./geometry.ts";
import type { UiSketchBounds, UiSketchDraft, UiSketchStage } from "./types.ts";

interface Alignment {
  stageId: string;
  axis: "x" | "y";
  edge: "start" | "center" | "end";
  anchorId: string;
  itemIds: string[];
}

interface StandardizationPlan {
  sourceFingerprint: string;
  alignments: Alignment[];
}

export const UI_LAYOUT_ALIGNMENT_TOLERANCE = 3;
const validatePlan = new Ajv2020({ allErrors: true }).compile<StandardizationPlan>(planSchema);

/** Derive integer pixel geometry; align only relationships selected from user intent. */
export function standardizeUiSketchDraft(input: unknown, planInput?: unknown) {
  const source = validateUiSketchDraft(input);
  const sourceFingerprint = uiSketchDraftFingerprint(source);
  const plan = planInput ?? { sourceFingerprint, alignments: [] };
  if (!validatePlan(plan)) throw new Error(`Invalid UI layout standardization plan: ${JSON.stringify(validatePlan.errors)}`);
  if (plan.sourceFingerprint !== sourceFingerprint) {
    throw new Error("UI layout standardization plan is stale. Read the latest capture and rebuild the plan.");
  }
  const draft = cloneUiSketchDraft(source);
  roundBounds(draft.frame);
  for (const [, stage] of stages(draft)) {
    for (const item of items(stage)) {
      item.x = draft.frame.x + Math.round(item.x - source.frame.x);
      item.y = draft.frame.y + Math.round(item.y - source.frame.y);
      if ("width" in item) {
        item.width = Math.max(1, Math.round(item.width));
        item.height = Math.max(1, Math.round(item.height));
      } else {
        item.fontSize = Math.max(1, Math.round(item.fontSize));
      }
    }
  }
  const rounded = cloneUiSketchDraft(draft);
  for (const alignment of plan.alignments) {
    const stage = stageById(draft, alignment.stageId);
    const anchorIds = members(draft, alignment.anchorId);
    const anchor = alignmentPosition(draft, stage, anchorIds, alignment);
    for (const id of alignment.itemIds) {
      const targetIds = members(draft, id);
      if (targetIds.some((member) => anchorIds.includes(member))) {
        throw new Error("An alignment target cannot belong to its anchor group.");
      }
      const difference = anchor - alignmentPosition(draft, stage, targetIds, alignment);
      if (Math.abs(difference) > UI_LAYOUT_ALIGNMENT_TOLERANCE) {
        throw new Error(`UI layout alignment exceeds ${UI_LAYOUT_ALIGNMENT_TOLERANCE}px: ${id}.`);
      }
      const delta = Math.round(difference);
      for (const item of items(stage).filter((item) => targetIds.includes(item.id))) {
        item[alignment.axis] += delta;
      }
    }
  }
  for (const alignment of plan.alignments) {
    const stage = stageById(draft, alignment.stageId);
    const anchor = alignmentPosition(draft, stage, members(draft, alignment.anchorId), alignment);
    for (const id of alignment.itemIds) {
      const position = alignmentPosition(draft, stage, members(draft, id), alignment);
      if (Math.abs(position - anchor) > 0.5) {
        throw new Error("UI layout alignments conflict. Use a consistent anchor for each relationship.");
      }
    }
  }
  for (const [stageId, stage] of stages(draft)) {
    const originalItems = new Map(items(stageById(rounded, stageId)).map((item) => [item.id, item]));
    for (const item of items(stage)) {
      const original = originalItems.get(item.id)!;
      if (Math.abs(item.x - original.x) > UI_LAYOUT_ALIGNMENT_TOLERANCE
        || Math.abs(item.y - original.y) > UI_LAYOUT_ALIGNMENT_TOLERANCE) {
        throw new Error(`Cumulative UI layout alignment exceeds ${UI_LAYOUT_ALIGNMENT_TOLERANCE}px: ${item.id}.`);
      }
    }
  }
  const changes: Array<{ stageId: string; id: string; before: object; after: object }> = [];
  if (JSON.stringify(source.frame) !== JSON.stringify(draft.frame)) {
    changes.push({ stageId: "all", id: "frame", before: source.frame, after: draft.frame });
  }
  for (const [stageId, stage] of stages(draft)) {
    const originalItems = new Map(items(stageById(source, stageId)).map((item) => [item.id, item]));
    for (const item of items(stage)) {
      const before = geometry(originalItems.get(item.id)!);
      const after = geometry(item);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changes.push({ stageId, id: item.id, before, after });
      }
    }
  }
  return {
    version: 1,
    kind: "ui-layout-standardization-result",
    sourceFingerprint,
    fingerprint: uiSketchDraftFingerprint(draft),
    alignmentTolerance: UI_LAYOUT_ALIGNMENT_TOLERANCE,
    changes,
    draft: validateUiSketchDraft(draft),
  };
}

function stages(draft: UiSketchDraft): Array<[string, UiSketchDraft | UiSketchStage]> {
  return [["start", draft], ...draft.stages.map((stage): [string, UiSketchStage] => [stage.id, stage])];
}

function stageById(draft: UiSketchDraft, id: string) {
  const stage = stages(draft).find(([stageId]) => stageId === id)?.[1];
  if (!stage) throw new Error(`Unknown UI sketch stage id: ${id}.`);
  return stage;
}

function items(stage: UiSketchDraft | UiSketchStage) {
  return [...stage.rectangles, ...stage.texts, ...stage.images];
}

function members(draft: UiSketchDraft, id: string): string[] {
  const group = draft.groups.find((group) => group.id === id || group.itemIds.includes(id));
  if (group) return group.itemIds;
  if (!items(draft).some((item) => item.id === id)) throw new Error(`Unknown UI sketch item or group: ${id}.`);
  return [id];
}

function alignmentPosition(
  draft: UiSketchDraft,
  stage: UiSketchDraft | UiSketchStage,
  ids: string[],
  { axis, edge }: Alignment,
): number {
  const bounds = items(stage).filter((item) => ids.includes(item.id)).map((item) => {
    if ("width" in item) return item;
    const measured = uiSketchTextBounds({ ...draft.texts.find((text) => text.id === item.id)!, ...item });
    return { ...measured, width: Math.ceil(measured.width), height: Math.ceil(measured.height) };
  });
  const size = axis === "x" ? "width" : "height";
  const start = Math.min(...bounds.map((item) => item[axis]));
  const end = Math.max(...bounds.map((item) => item[axis] + item[size]));
  return edge === "start" ? start : edge === "end" ? end : (start + end) / 2;
}

function geometry(item: ReturnType<typeof items>[number]) {
  return "width" in item
    ? { x: item.x, y: item.y, width: item.width, height: item.height }
    : { x: item.x, y: item.y, fontSize: item.fontSize };
}

function roundBounds(bounds: UiSketchBounds): void {
  bounds.x = Math.round(bounds.x);
  bounds.y = Math.round(bounds.y);
  bounds.width = Math.max(1, Math.round(bounds.width));
  bounds.height = Math.max(1, Math.round(bounds.height));
}
