import { renameCanvasState, reorderCanvasStates, removeCanvasState } from "../canvas-states.ts";
import { validateDraft } from "./draft.ts";
import { compositionLayerOrder } from "./layers.ts";
import type { CompositionDraft, CompositionLayout, CompositionState } from "./types.ts";

function captureLayout(draft: CompositionDraft): CompositionLayout {
  return {
    frame: { width: draft.frame.width, height: draft.frame.height, bounds: {
      x: draft.frame.bounds.x, y: draft.frame.bounds.y,
      width: draft.frame.bounds.width, height: draft.frame.bounds.height,
    } },
    layerOrder: compositionLayerOrder(draft),
    focusPoints: draft.focusPoints.map(({ id, x, y }) => ({ id, x, y })),
    directionLine: draft.directionLine ? (({ id, x, y, rotation }) => ({ id, x, y, rotation }))(draft.directionLine) : null,
    areas: draft.areas.map(({ id, x, y, area, aspect, rotation, width, height }) => ({ id, x, y, area, aspect, rotation, width, height })),
    images: draft.images.map(({ id, x, y, width, height, rotation }) => ({ id, x, y, width, height, rotation })),
  };
}

function applyLayout(draft: CompositionDraft, layout: CompositionLayout): CompositionDraft {
  const points = new Map(layout.focusPoints.map((node) => [node.id, node]));
  const areas = new Map(layout.areas.map((node) => [node.id, node]));
  const images = new Map(layout.images.map((node) => [node.id, node]));
  return {
    ...draft,
    frame: structuredClone(layout.frame),
    layerOrder: [...layout.layerOrder],
    focusPoints: draft.focusPoints.map((node) => ({ ...node, ...points.get(node.id) })),
    directionLine: draft.directionLine ? { ...draft.directionLine, ...layout.directionLine } : null,
    areas: draft.areas.map((node) => {
      const saved = areas.get(node.id);
      if (!saved) return { ...node };
      const { x, y, area, aspect, rotation, width, height, ...content } = node;
      return { ...content, ...saved };
    }),
    images: draft.images.map((node) => ({ ...node, ...images.get(node.id) })),
  };
}

export function compositionStates(draft: CompositionDraft): readonly CompositionState[] {
  return draft.states ?? [{ id: "state-1", number: 1, layout: captureLayout(draft) }];
}

/** Top-level geometry is the active layout; all node content lives only at the top level. */
export function normalizeCompositionStates(draft: CompositionDraft): CompositionDraft {
  if (!draft.states) return draft;
  const { states, activeStateId, ...content } = draft;
  if (!states.some((state) => state.id === activeStateId)) throw new Error("Unknown active composition state.");
  if (new Set(states.map(({ id }) => id)).size !== states.length
    || new Set(states.map(({ number }) => number)).size !== states.length) {
    throw new Error("Composition state ids and numbers must be unique.");
  }
  draft.states = states.map((state) => {
    if (state.name !== undefined && !state.name.trim()) throw new Error("Composition state name must not be blank.");
    for (const nodes of [state.layout.focusPoints, state.layout.areas, state.layout.images]) {
      if (new Set(nodes.map(({ id }) => id)).size !== nodes.length) throw new Error("Duplicate composition state node id.");
    }
    // Validate inactive frames and geometry too; synchronize additions/deletions from shared nodes.
    const resolved = validateDraft(applyLayout(content, state.layout));
    return { ...state, ...(state.name !== undefined ? { name: state.name.trim() } : {}),
      layout: captureLayout(state.id === activeStateId ? content : resolved) };
  });
  return draft;
}

export function selectCompositionState(input: CompositionDraft, id: string): CompositionDraft {
  const draft = validateDraft(input);
  const states = compositionStates(draft);
  const state = states.find((entry) => entry.id === id);
  if (!state) throw new Error(`Unknown composition state: ${id}.`);
  if ((draft.activeStateId ?? "state-1") === id) return draft;
  return validateDraft({ ...applyLayout(draft, state.layout), states, activeStateId: id });
}

export function createCompositionState(input: CompositionDraft, sourceId: string, id: string): CompositionDraft {
  const draft = validateDraft(input);
  const states = [...compositionStates(draft)];
  const source = states.findIndex((state) => state.id === sourceId);
  if (source < 0 || states.some((state) => state.id === id)) throw new Error("Invalid composition state source or new id.");
  const state = { id, number: Math.max(...states.map((entry) => entry.number)) + 1,
    layout: structuredClone(states[source].layout) };
  states.splice(source + 1, 0, state);
  return validateDraft({ ...applyLayout(draft, state.layout), states, activeStateId: id });
}

export function renameCompositionState(input: CompositionDraft, id: string, name: string): CompositionDraft {
  const draft = validateDraft(input);
  return { ...draft, activeStateId: draft.activeStateId ?? "state-1",
    states: renameCanvasState(compositionStates(draft), id, name) };
}

export function reorderCompositionStates(input: CompositionDraft, ids: readonly string[]): CompositionDraft {
  const draft = validateDraft(input);
  return { ...draft, activeStateId: draft.activeStateId ?? "state-1",
    states: reorderCanvasStates(compositionStates(draft), ids) };
}

export function deleteCompositionState(input: CompositionDraft, id: string): CompositionDraft {
  const draft = validateDraft(input);
  const states = removeCanvasState(compositionStates(draft), id);
  const index = compositionStates(draft).findIndex((state) => state.id === id);
  const next = draft.activeStateId === id
    ? selectCompositionState(draft, states[Math.max(0, index - 1)].id) : draft;
  return { ...next, states };
}
