import { useLayoutEffect, useRef } from "react";
import type { ReactElement } from "react";

type Entry = { dependencies: readonly unknown[]; element: ReactElement };

export function sameCanvasDependencies(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

// Dependencies describe one node, never a whole draft. Keep speculative renders
// separate from the committed cache; viewport-only renders reuse their own map.
export function useCanvasNodeCache(ids: readonly string[], shared: readonly unknown[]) {
  const committed = useRef(new Map<string, Entry>());
  const nodes = new Map(committed.current);
  useLayoutEffect(() => {
    const live = new Set(ids);
    for (const id of nodes.keys()) if (!live.has(id)) nodes.delete(id);
    committed.current = nodes;
  });
  return (id: string, scale: number, inputs: readonly unknown[], render: () => ReactElement): ReactElement => {
    const dependencies = [...shared, scale, ...inputs];
    const previous = nodes.get(id);
    if (previous && sameCanvasDependencies(previous.dependencies, dependencies)) return previous.element;
    const element = render();
    nodes.set(id, { dependencies, element });
    return element;
  };
}

// Cached JSX calls stable dispatchers, not callbacks captured with an old draft.
// Publish handlers only after commit, including new callbacks from the caller.
export function useCanvasNodeActions<T extends { [K in keyof T]: (...args: never[]) => unknown }>(actions: T): T {
  const current = useRef(actions);
  useLayoutEffect(() => { current.current = actions; });
  const stable = useRef<T | null>(null);
  if (!stable.current) {
    stable.current = Object.fromEntries(Object.keys(actions).map((key) => [key,
      (...args: never[]) => current.current[key as keyof T](...args),
    ])) as T;
  }
  return stable.current;
}
