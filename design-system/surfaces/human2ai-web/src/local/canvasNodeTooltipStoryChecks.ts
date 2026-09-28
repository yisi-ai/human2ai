import { captureCanvasNodeExecutions } from "./canvasNodeAppearanceStoryChecks";

// Exercise the shared tooltip through each canvas's real zoom and node handlers.
export async function checkZoomedNodeTooltip(canvas: HTMLElement, node: SVGGElement): Promise<void> {
  const viewport = canvas.querySelector<HTMLElement>(".human2ai-infinite-canvas-viewport")!;
  const bounds = viewport.getBoundingClientRect();
  const nodeBounds = node.getBoundingClientRect();
  const x = (Math.max(bounds.left, nodeBounds.left) + Math.min(bounds.right, nodeBounds.right)) / 2;
  const y = (Math.max(bounds.top, nodeBounds.top) + Math.min(bounds.bottom, nodeBounds.bottom)) / 2;
  viewport.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -1800, clientX: x, clientY: y }));
  await frames(8);
  const enlarged = node.getBoundingClientRect();
  if (enlarged.width <= bounds.width && enlarged.height <= bounds.height) {
    throw new Error("Tooltip regression requires a node larger than the canvas viewport");
  }

  const before = layout(viewport);
  const checkExecutions = captureCanvasNodeExecutions(canvas);
  const mouse = (type: string, clientX: number, clientY: number) => node.dispatchEvent(
    new MouseEvent(type, { bubbles: true, clientX, clientY }),
  );
  try {
    mouse("mouseover", x, y);
    for (const [clientX, clientY] of [
      [x, y], [bounds.right - 10, bounds.bottom - 10],
      [bounds.left + 10, bounds.bottom - 10], [bounds.right - 10, bounds.top + 10],
    ]) {
      // A burst must retain its final pointer position without rebuilding nodes.
      for (let i = 0; i < 20; i++) mouse("mousemove", clientX - 19 + i, clientY);
      await frames(24, () => {
        if (JSON.stringify(layout(viewport)) !== JSON.stringify(before)) {
          throw new Error("Node tooltip changed page scroll size or canvas layout");
        }
      });
      const tooltip = visibleTooltip(node);
      const tip = tooltip.getBoundingClientRect();
      if (tip.left < -1 || tip.top < -1 || tip.right > innerWidth + 1 || tip.bottom > innerHeight + 1) {
        throw new Error("Zoomed node tooltip must stay inside the window");
      }
      const distance = Math.hypot(Math.max(tip.left - clientX, clientX - tip.right, 0), Math.max(tip.top - clientY, clientY - tip.bottom, 0));
      if (distance > 32) throw new Error("Tooltip must follow the final pointer position");
    }
    mouse("mouseout", x, y);
    await frames(2);
    node.focus({ preventScroll: true });
    await frames(24);
    visibleTooltip(node);
    node.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await frames(2);
    if (node.getAttribute("aria-describedby")) throw new Error("Escape must dismiss the node tooltip");
    node.blur();
    mouse("mouseover", x, y);
    mouse("mousemove", x + 10, y + 10);
    mouse("mouseout", x + 10, y + 10);
    await frames(3);
    if (node.getAttribute("aria-describedby")) throw new Error("A pending pointer frame must not reopen a dismissed tooltip");
    checkExecutions();
  } finally {
    mouse("mouseout", x, y);
    node.blur();
    viewport.querySelectorAll<HTMLButtonElement>(".human2ai-infinite-canvas-viewport__controls button")[2]?.click();
    await frames(8);
  }
}

function visibleTooltip(node: SVGGElement): HTMLElement {
  const tooltip = document.getElementById(node.getAttribute("aria-describedby") ?? "");
  if (!tooltip || tooltip.getAttribute("role") !== "tooltip") throw new Error("Node must describe its visible tooltip");
  return tooltip;
}

function layout(viewport: HTMLElement): number[] {
  const page = document.documentElement;
  const rect = viewport.getBoundingClientRect();
  return [page.clientWidth, page.clientHeight, page.scrollWidth, page.scrollHeight, rect.x, rect.y, rect.width, rect.height];
}

async function frames(count: number, check?: () => void): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    check?.();
  }
}
