import { copyCompositionItems, createDraft, validateDraft } from "./draft.ts";
import type { CompositionClipboardItem } from "./types.ts";

/** Validate clipboard nodes with the existing composition schema and invariants. */
export function parseCompositionClipboard(input: unknown): CompositionClipboardItem[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  try {
    const draft = createDraft();
    const ids: string[] = [];
    for (const entry of input) {
      if (!entry?.item || typeof entry.item.id !== "string") return null;
      if (entry.kind === "focus") draft.focusPoints.push(entry.item);
      else if (entry.kind === "area") draft.areas.push(entry.item);
      else if (entry.kind === "image") draft.images.push(entry.item);
      else if (entry.kind === "direction" && !draft.directionLine) draft.directionLine = entry.item;
      else return null;
      ids.push(entry.item.id);
    }
    return copyCompositionItems(validateDraft(draft), ids);
  } catch {
    return null;
  }
}
