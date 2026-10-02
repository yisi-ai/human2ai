"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type SetStateAction } from "react";

export const WORKSPACE_TREE_COLLAPSED_KEYS = "human2ai.workspaceSidebar.collapsedKeys";

export function useWorkspaceTreeExpansion(containerKeys: string[]) {
  const [collapsedKeys, setCollapsedKeys] = useState<string[] | null>(null);
  useLayoutEffect(() => {
    let restored: string[] = [];
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(WORKSPACE_TREE_COLLAPSED_KEYS) ?? "[]");
      if (Array.isArray(stored) && stored.every(key => typeof key === "string")) restored = stored;
    } catch { /* Expansion still works when browser storage is unavailable. */ }
    setCollapsedKeys(restored);
  }, []);
  useEffect(() => {
    if (collapsedKeys === null) return;
    try { window.localStorage.setItem(WORKSPACE_TREE_COLLAPSED_KEYS, JSON.stringify(collapsedKeys)); }
    catch { /* Expansion still works when browser storage is unavailable. */ }
  }, [collapsedKeys]);
  const expandedKeys = useMemo(() => collapsedKeys === null ? null
    : containerKeys.filter(key => !collapsedKeys.includes(key)), [containerKeys, collapsedKeys]);
  const onExpandedKeysChange = useCallback((update: SetStateAction<string[]>) => {
    setCollapsedKeys(current => {
      if (current === null) return current;
      const expanded = containerKeys.filter(key => !current.includes(key));
      const next = typeof update === "function" ? update(expanded) : update;
      const collapsed = containerKeys.filter(key => !next.includes(key));
      return current.length === collapsed.length && current.every((key, index) => key === collapsed[index]) ? current : collapsed;
    });
  }, [containerKeys]);
  return { expandedKeys, onExpandedKeysChange };
}
