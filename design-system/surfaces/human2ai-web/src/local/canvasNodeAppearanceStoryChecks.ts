import { canvasNodeExecutionCounts } from "./canvasNodeRenderTrace";

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

// React's actualStartTime also advances during bailouts. Count actual function
// entries instead; this opt-in diagnostic is compiled out of production nodes.
export function captureCanvasNodeExecutions(canvas: HTMLElement, allowedIds: readonly string[] = []): () => void {
  if (process.env.NODE_ENV !== "development") return () => {};
  const counts = canvasNodeExecutionCounts();
  const ids = [...canvas.querySelectorAll('[data-canvas-node]')].map(node => node.getAttribute("data-canvas-node")!);
  if (!ids.length) throw new Error("Render scope requires mounted canvas nodes");
  const before = new Map(ids.filter(id => !allowedIds.includes(id)).map(id => [id, counts.get(id) ?? 0]));
  return () => {
    for (const [id, count] of before) {
      if ((counts.get(id) ?? 0) !== count) {
        throw new Error(`Unrelated node rendered: ${id}`);
      }
    }
  };
}
