export interface CanvasStateTab {
  id: string;
  number: number;
  name?: string;
}

export function renameCanvasState<T extends CanvasStateTab>(states: readonly T[], id: string, name: string): T[] {
  if (!states.some((state) => state.id === id)) throw new Error(`Unknown canvas state: ${id}.`);
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) throw new Error("Canvas state name must contain 1 to 100 characters.");
  return states.map((state) => state.id === id ? { ...state, name: trimmed } : state);
}

export function reorderCanvasStates<T extends CanvasStateTab>(states: readonly T[], ids: readonly string[]): T[] {
  const byId = new Map(states.map((state) => [state.id, state]));
  if (ids.length !== states.length || new Set(ids).size !== states.length || ids.some((id) => !byId.has(id))) {
    throw new Error("Canvas state order must contain each state exactly once.");
  }
  return ids.map((id) => byId.get(id)!);
}

export function removeCanvasState<T extends CanvasStateTab>(states: readonly T[], id: string): T[] {
  if (!states.some((state) => state.id === id)) throw new Error(`Unknown canvas state: ${id}.`);
  if (states.length === 1) throw new Error("A canvas must retain at least one state.");
  return states.filter((state) => state.id !== id);
}
