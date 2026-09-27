import type { ReactElement } from "react";

// Create a fresh cache for each canvas render so callbacks always see that
// render's draft and selection. Reuse nodes only while its viewport moves.
export function createViewportNodeCache() {
  const nodes = new Map<string, { scale: number; element: ReactElement }>();
  return (id: string, scale: number, render: () => ReactElement): ReactElement => {
    const previous = nodes.get(id);
    if (previous?.scale === scale) return previous.element;
    const element = render();
    nodes.set(id, { scale, element });
    return element;
  };
}
