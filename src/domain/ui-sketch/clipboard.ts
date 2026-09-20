import { UI_SKETCH_START_STAGE_ID, uiSketchDraftForStage, updateUiSketchStageDraft } from "./draft.ts";
import { uiSketchSelectionWithGroups } from "./groups.ts";
import { uiSketchLayerOrder } from "./layers.ts";
import type { UiSketchDraft, UiSketchNodeOrigin } from "./types.ts";

export type UiSketchClipboard = Pick<UiSketchDraft, "rectangles" | "texts" | "images" | "groups"> & {
  layerOrder: string[];
};

export function copyUiSketchItems(
  draft: UiSketchDraft,
  itemIds: readonly string[],
): UiSketchClipboard {
  const selected = new Set(uiSketchSelectionWithGroups(draft, itemIds));
  return structuredClone({
    rectangles: draft.rectangles.filter((item) => selected.has(item.id)),
    texts: draft.texts.filter((item) => selected.has(item.id)),
    images: draft.images.filter((item) => selected.has(item.id)),
    groups: draft.groups.filter((group) => group.itemIds.every((id) => selected.has(id))),
    layerOrder: uiSketchLayerOrder(draft).filter((id) => selected.has(id)),
  });
}

export function pasteUiSketchItems(
  input: UiSketchDraft,
  clipboard: UiSketchClipboard,
  offset: { x: number; y: number },
  stageId = UI_SKETCH_START_STAGE_ID,
): { draft: UiSketchDraft; ids: string[] } {
  if (clipboard.layerOrder.length === 0) return { draft: input, ids: [] };
  const draft = uiSketchDraftForStage(input, stageId);
  const usedIds = new Set([
    ...draft.rectangles, ...draft.texts, ...draft.images, ...draft.groups,
    ...clipboard.rectangles, ...clipboard.texts, ...clipboard.images, ...clipboard.groups,
  ].map((item) => item.id));
  const copiedIds = new Map<string, string>();
  function nextId(prefix: string): string {
    let index = 1;
    while (usedIds.has(`${prefix}-${index}`)) index += 1;
    const id = `${prefix}-${index}`;
    usedIds.add(id);
    return id;
  }
  function copyItems<T extends { id: string; x: number; y: number; origin: UiSketchNodeOrigin }>(
    items: T[],
    prefix: string,
  ): T[] {
    return items.map((item) => {
      const id = nextId(prefix);
      copiedIds.set(item.id, id);
      return {
        ...structuredClone(item),
        id,
        origin: "user",
        x: item.x + offset.x,
        y: item.y + offset.y,
      };
    });
  }
  draft.rectangles.push(...copyItems(clipboard.rectangles, "rectangle"));
  draft.texts.push(...copyItems(clipboard.texts, "text"));
  draft.images.push(...copyItems(clipboard.images, "image"));
  draft.groups.push(...clipboard.groups.map((group) => ({
    id: nextId("group"),
    itemIds: group.itemIds.map((id) => copiedIds.get(id)!),
  })));
  const ids = clipboard.layerOrder.map((id) => copiedIds.get(id)!);
  draft.layerOrder = [...uiSketchLayerOrder(input), ...ids];
  return { draft: updateUiSketchStageDraft(input, stageId, draft), ids };
}
