import { renameCanvasState, reorderCanvasStates, removeCanvasState } from "../canvas-states.ts";
import type { UiSketchDraft, UiSketchStateTab } from "./types.ts";

export function uiSketchStateTabs(draft: UiSketchDraft): UiSketchStateTab[] {
  return draft.stateTabs?.map((tab) => ({ ...tab }))
    ?? ["start", ...draft.stages.map((stage) => stage.id)].map((id, index) => ({
      id, number: index + 1,
    }));
}

export function renameUiSketchState(draft: UiSketchDraft, id: string, name: string): UiSketchDraft {
  return { ...draft, stateTabs: renameCanvasState(uiSketchStateTabs(draft), id, name) };
}

export function reorderUiSketchStates(draft: UiSketchDraft, ids: readonly string[]): UiSketchDraft {
  return { ...draft, stateTabs: reorderCanvasStates(uiSketchStateTabs(draft), ids) };
}

export function deleteUiSketchState(draft: UiSketchDraft, id: string): UiSketchDraft {
  return {
    ...draft,
    stateTabs: removeCanvasState(uiSketchStateTabs(draft), id),
    stages: draft.stages.filter((stage) => stage.id !== id),
  };
}
