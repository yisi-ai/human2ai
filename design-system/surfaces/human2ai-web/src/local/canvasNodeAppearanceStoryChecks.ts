export function captureCanvasNodeAppearance(canvas: HTMLElement, selector: string): () => void {
  const nodes = [...canvas.querySelectorAll<SVGElement>(selector)];
  if (nodes.length < 2) throw new Error("Color regression requires multiple nodes");
  const colors = new Map(nodes.map((node) => [node, getComputedStyle(node).color]));
  return () => {
    for (const node of canvas.querySelectorAll<SVGElement>(selector)) {
      if (colors.get(node) !== getComputedStyle(node).color) {
        throw new Error("Deleting a node must retain surviving node elements and marker colors");
      }
      // Hover/focus/selection intentionally replaces the shape border with the operation outline.
      if (node.matches(':hover, :focus-visible, [data-selected="true"]')) continue;
      const shape = node.querySelector(".human2ai-canvas-shape");
      if (!shape) throw new Error("Color regression requires a shape");
      const style = getComputedStyle(shape);
      if (shape.hasAttribute("data-inner-stroke") &&
        (["none", "transparent", "rgba(0, 0, 0, 0)"].includes(style.stroke)
        || style.strokeWidth !== "6px" || style.vectorEffect !== "non-scaling-stroke" || style.clipPath === "none")) {
        throw new Error("Overlapping shapes need a clipped, screen-stable inner border");
      }
    }
  };
}

// Development React's actualStartTime changes when the component executes.
// Read both alternates because the DOM's Fiber pointer can reference either.
// This is browser-only evidence, not a DOM-mutation proxy for React execution.
export function captureCanvasNodeExecutions(canvas: HTMLElement): () => void {
  // Production React strips these counters; production Stories still run the
  // functional/appearance checks above. Render-scope checks run in development.
  if (process.env.NODE_ENV !== "development") return () => {};
  type Fiber = { type?: { name?: string }; return?: Fiber; alternate?: Fiber; actualStartTime?: number };
  const started = (node: Element): number => {
    const key = Object.keys(node).find((key) => key.startsWith("__reactFiber$"));
    let fiber = key ? (node as unknown as Record<string, Fiber>)[key] : undefined;
    while (fiber && fiber.type?.name !== "CanvasNode") fiber = fiber.return;
    if (!fiber || fiber.actualStartTime === undefined) throw new Error("Render scope requires development React profiling");
    return Math.max(fiber.actualStartTime, fiber.alternate?.actualStartTime ?? -1);
  };
  const before = new Map([...canvas.querySelectorAll('[data-canvas-node]')].map((node) => [node, started(node)]));
  return () => {
    for (const [node, time] of before) {
      if (node.isConnected && started(node) > time) {
        throw new Error(`Unrelated node rendered during deletion: ${node.getAttribute("data-canvas-node")}`);
      }
    }
  };
}
