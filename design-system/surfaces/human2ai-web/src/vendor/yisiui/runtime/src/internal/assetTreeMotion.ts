import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AssetSkeletonTreeNode } from "../patterns/AssetSkeletonTree";

export const treeInsertDuration = 180;
export const treeExitDuration = 300;
export const treeTypingDuration = 480;

export interface TreeEntry {
  node: AssetSkeletonTreeNode;
  phase: "idle" | "enter" | "rename" | "exit";
  revision: number;
}

function subscribeMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export function useTreeReducedMotion() {
  return useSyncExternalStore(subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true);
}

// Preserve node identities even when a caller reconstructs an equivalent payload.
export function sameTreeNode(a: AssetSkeletonTreeNode, b: AssetSkeletonTreeNode, ignorePosition = false): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof AssetSkeletonTreeNode>;
  return [...keys].every((key) => {
    if (ignorePosition && (key === "order" || key === "parentKey")) return true;
    if (key === "status") {
      return a.status?.label === b.status?.label && a.status?.tone === b.status?.tone &&
        a.status?.icon === b.status?.icon;
    }
    if (key === "extraClassNames") return a[key]?.join(" ") === b[key]?.join(" ");
    return Object.is(a[key], b[key]);
  });
}

export function groupTreeNodes(nodes: AssetSkeletonTreeNode[]) {
  const groups = new Map<string | null, AssetSkeletonTreeNode[]>();
  for (const node of nodes) {
    const siblings = groups.get(node.parentKey) ?? [];
    siblings.push(node);
    groups.set(node.parentKey, siblings);
  }
  for (const siblings of groups.values()) {
    siblings.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title) || a.key.localeCompare(b.key));
  }
  return groups;
}

function reconcileEntries(previous: TreeEntry[], nodes: AssetSkeletonTreeNode[], animate: boolean): TreeEntry[] {
  const old = new Map(previous.map((entry) => [entry.node.key, entry]));
  const next = new Map<string, TreeEntry>();
  for (const input of nodes) {
    const before = old.get(input.key);
    const node = before && sameTreeNode(before.node, input) ? before.node : input;
    const phase = !animate ? "idle" : !before || before.phase === "exit" ? "enter" :
      before.node.title !== node.title && before.phase !== "enter" ? "rename" : before.phase;
    const revision = !before ? 0 : before.phase !== phase || before.node.title !== node.title
      ? before.revision + 1 : before.revision;
    next.set(node.key, before && before.node === node && before.phase === phase ? before : { node, phase, revision });
  }

  const groups = new Map([...groupTreeNodes(nodes)].map(([parent, siblings]) =>
    [parent, siblings.map((node) => next.get(node.key)!)]));
  if (animate) {
    // Anchor departing siblings to their old neighbours, including when the caller
    // renumbers all remaining orders in the same update.
    for (let index = previous.length - 1; index >= 0; index--) {
      const before = previous[index];
      if (next.has(before.node.key)) continue;
      const exit: TreeEntry = before.phase === "exit" ? before :
        { ...before, phase: "exit", revision: before.revision + 1 };
      const siblings = groups.get(before.node.parentKey) ?? [];
      const following = previous.slice(index + 1).find((entry) =>
        entry.node.parentKey === before.node.parentKey && siblings.some((sibling) => sibling.node.key === entry.node.key));
      const position = following ? siblings.findIndex((entry) => entry.node.key === following.node.key) : siblings.length;
      siblings.splice(position, 0, exit);
      groups.set(before.node.parentKey, siblings);
    }
  }
  const result: TreeEntry[] = [];
  const visited = new Set<string>();
  function visit(parent: string | null) {
    for (const entry of groups.get(parent) ?? []) {
      if (visited.has(entry.node.key)) continue;
      visited.add(entry.node.key);
      result.push(entry);
      visit(entry.node.key);
    }
  }
  visit(null);
  return result;
}

export function useTreeEntries(nodes: AssetSkeletonTreeNode[], animate: boolean) {
  const [state, setState] = useState(() => ({ nodes, animate, entries: reconcileEntries([], nodes, false) }));
  const timers = useRef(new Map<string, { revision: number; timer: ReturnType<typeof setTimeout> }>());
  let entries = state.entries;
  if (state.nodes !== nodes || state.animate !== animate) {
    entries = reconcileEntries(state.entries, nodes, animate);
    setState({ nodes, animate, entries });
  }

  useEffect(() => {
    // One deadline per change, never a tree-wide render for each typed character.
    // Preserve deadlines across unrelated changes and full payload replacements.
    const changing = new Map(entries.filter((entry) => entry.phase !== "idle").map((entry) => [entry.node.key, entry]));
    for (const [key, pending] of timers.current) {
      if (changing.get(key)?.revision !== pending.revision) {
        clearTimeout(pending.timer);
        timers.current.delete(key);
      }
    }
    for (const [key, entry] of changing) {
      if (timers.current.has(key)) continue;
      const duration = entry.phase === "exit" ? treeExitDuration : treeTypingDuration +
        (entry.phase === "enter" ? treeInsertDuration : 0);
      const timer = setTimeout(() => {
        timers.current.delete(key);
        setState((current) => ({ ...current, entries: current.entries.flatMap((item) => {
          if (item.node.key !== key || item.revision !== entry.revision) return [item];
          return item.phase === "exit" ? [] : [{ ...item, phase: "idle" as const }];
        }) }));
      }, duration);
      timers.current.set(key, { revision: entry.revision, timer });
    }
  }, [entries]);

  useEffect(() => () => {
    for (const pending of timers.current.values()) clearTimeout(pending.timer);
    timers.current.clear();
  }, []);

  return entries;
}
