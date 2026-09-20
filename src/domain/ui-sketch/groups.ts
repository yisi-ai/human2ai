import type { UiSketchDraft, UiSketchGroup } from "./types.ts";

export function uiSketchSelectionWithGroups(
  draft: UiSketchDraft,
  itemIds: readonly string[],
): string[] {
  const selected = new Set(itemIds);
  for (const group of draft.groups) {
    if (group.itemIds.some((id) => selected.has(id))) {
      group.itemIds.forEach((id) => selected.add(id));
    }
  }
  return [...selected];
}

export function groupUiSketchItems(
  draft: UiSketchDraft,
  itemIds: readonly string[],
  groupId: string,
): UiSketchDraft {
  const members = uiSketchSelectionWithGroups(draft, itemIds);
  const known = new Set([...draft.rectangles, ...draft.texts, ...draft.images].map((item) => item.id));
  if (members.length < 2 || members.some((id) => !known.has(id))) {
    throw new Error("A UI sketch group requires at least two existing items.");
  }
  if (!groupId || known.has(groupId) || draft.groups.some((group) => group.id === groupId)) {
    throw new Error(`Duplicate or empty UI sketch group id: ${groupId}.`);
  }
  return {
    ...draft,
    groups: [
      ...ungroupUiSketchItems(draft, members).groups,
      { id: groupId, itemIds: members },
    ],
  };
}

export function ungroupUiSketchItems(
  draft: UiSketchDraft,
  itemIds: readonly string[],
): UiSketchDraft {
  const selected = new Set(itemIds);
  return {
    ...draft,
    groups: draft.groups.filter((group) => !group.itemIds.some((id) => selected.has(id))),
  };
}

export function retainUiSketchGroups(
  groups: readonly UiSketchGroup[],
  remainingIds: readonly string[],
): UiSketchGroup[] {
  const remaining = new Set(remainingIds);
  return groups
    .map((group) => ({ ...group, itemIds: group.itemIds.filter((id) => remaining.has(id)) }))
    .filter((group) => group.itemIds.length >= 2);
}
