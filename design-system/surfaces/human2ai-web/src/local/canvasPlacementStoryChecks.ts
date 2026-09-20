export function placementLayer(root: HTMLElement): SVGGElement {
  const layer = root.querySelector<SVGGElement>("[data-canvas-placement]");
  if (!layer) throw new Error("工具未进入放置模式");
  // Synthetic pointers do not register with the browser's native capture map.
  layer.setPointerCapture = () => undefined;
  return layer;
}

export function placementPointer(
  layer: SVGGElement,
  type: string,
  point: { x: number; y: number },
): void {
  const scene = layer.ownerSVGElement!;
  const position = scene.createSVGPoint();
  position.x = point.x;
  position.y = point.y;
  const client = position.matrixTransform(scene.getScreenCTM()!);
  layer.dispatchEvent(new PointerEvent(type, {
    bubbles: true, pointerId: 71, button: 0,
    buttons: type === "pointerup" ? 0 : 1,
    clientX: client.x, clientY: client.y,
  }));
}

export async function placeNodeInStory(
  root: HTMLElement,
  start = { x: 320, y: 240 },
  end = start,
): Promise<void> {
  const layer = placementLayer(root);
  const scene = layer.ownerSVGElement!;
  placementPointer(layer, "pointerdown", start);
  placementPointer(layer, "pointermove", end);
  placementPointer(layer, "pointerup", end);
  scene.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await placementRender();
}

export function placementRender(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
