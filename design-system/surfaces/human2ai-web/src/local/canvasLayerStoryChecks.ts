export async function checkCanvasLayerMenu(canvas: HTMLElement, selector: string, attribute: string, readOnly = false): Promise<void> {
  const tick = () => new Promise((resolve) => window.setTimeout(resolve, 350));
  const nodes = () => Array.from(canvas.querySelectorAll<SVGElement>(selector));
  const ids = () => nodes().map((node) => node.getAttribute(attribute)!);
  const visibleMenu = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menu"]')).find((menu) => menu.checkVisibility());
  const item = (text: string) => {
    const result = Array.from(visibleMenu()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
      .find((node) => node.textContent?.trim() === text);
    if (!result) throw new Error(`缺少层级菜单项：${text}`);
    return result;
  };
  const rightClick = async (node: Element) => {
    const bounds = node.getBoundingClientRect();
    const event = { bubbles: true, cancelable: true, pointerId: 901, button: 2, clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2 };
    node.dispatchEvent(new PointerEvent("pointerdown", event));
    node.dispatchEvent(new PointerEvent("pointerup", event));
    await tick();
    node.dispatchEvent(new MouseEvent("contextmenu", event));
    await tick();
    if (!visibleMenu()) throw new Error("原生右键事件不应关闭菜单");
  };
  const choose = async (text: string) => {
    const target = item(text);
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    target.click();
    await tick();
    for (let attempt = 0; attempt < 40 && visibleMenu(); attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    }
    if (visibleMenu()) throw new Error("执行层级操作后应关闭菜单");
  };
  const assertOrder = (expected: string[]) => {
    if (JSON.stringify(ids()) !== JSON.stringify(expected)) throw new Error(`画布绘制顺序不正确：${ids()}`);
  };
  await tick();
  const original = ids();
  await rightClick(nodes()[0]!);
  if (readOnly) {
    for (const text of ["置于顶层", "上移一层", "下移一层", "置于底层"]) {
      if (item(text).getAttribute("aria-disabled") !== "true") throw new Error("只读画布层级操作应禁用");
    }
    return;
  }
  if (item("置于底层").getAttribute("aria-disabled") !== "true") throw new Error("底层节点不能继续下移");
  await choose("置于顶层");
  assertOrder([...original.slice(1), original[0]!]);
  await rightClick(nodes().at(-1)!);
  if (item("上移一层").getAttribute("aria-disabled") !== "true") throw new Error("顶层节点不能继续上移");
  await choose("下移一层");
  assertOrder([...original.slice(1, -1), original[0]!, original.at(-1)!]);
  await rightClick(nodes().at(-2)!);
  await choose("置于底层");
  assertOrder(original);
  const node = nodes()[0]!;
  const control = canvas.querySelector<SVGGElement>(`[data-canvas-controls="${CSS.escape(node.dataset.canvasNode!)}"]`);
  const handle = control?.querySelector<SVGRectElement>('[data-resize-handle="bottom-right"]');
  if (!handle || !control?.parentElement?.hasAttribute("data-canvas-controls-layer")) {
    throw new Error("底层节点的控制框应独立显示在内容上方");
  }
  const before = node.getBoundingClientRect();
  const hit = handle.getBoundingClientRect();
  const resize = { bubbles: true, pointerId: 903, button: 0, clientX: hit.x + hit.width / 2, clientY: hit.y + hit.height / 2 };
  handle.dispatchEvent(new PointerEvent("pointerdown", resize));
  handle.dispatchEvent(new PointerEvent("pointermove", { ...resize, clientX: resize.clientX + 30, clientY: resize.clientY + 20 }));
  handle.dispatchEvent(new PointerEvent("pointerup", { ...resize, clientX: resize.clientX + 30, clientY: resize.clientY + 20 }));
  await tick();
  if (node.getBoundingClientRect().width <= before.width) throw new Error("分离到顶层的缩放控制仍应调整原节点");
  nodes()[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await tick();
  nodes()[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
  await tick();
  await rightClick(nodes()[0]!);
  await choose("上移一层");
  assertOrder([original[2]!, original[0]!, original[1]!, ...original.slice(3)]);
  const target = nodes()[1]!;
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }));
  await tick();
  if (!visibleMenu()) throw new Error("Shift+F10 应打开层级菜单");
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }));
  await tick();
  if (visibleMenu() || document.activeElement !== target) throw new Error("Escape 应关闭菜单并归还焦点");
  const scene = canvas.querySelector("svg.human2ai-canvas-scene")!;
  scene.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await tick();
  await rightClick(scene);
  for (const text of ["置于顶层", "上移一层", "下移一层", "置于底层"]) {
    if (item(text).getAttribute("aria-disabled") !== "true") throw new Error("无选择时层级操作应禁用");
  }
  document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
  await tick();
  if (visibleMenu()) throw new Error("点击菜单外应关闭");
  const event = { pointerId: 902, button: 2, bubbles: true, clientX: 100, clientY: 100 };
  scene.dispatchEvent(new PointerEvent("pointerdown", event));
  scene.dispatchEvent(new PointerEvent("pointermove", { ...event, clientX: 160 }));
  scene.dispatchEvent(new PointerEvent("pointerup", { ...event, clientX: 160 }));
  await tick();
  if (visibleMenu()) throw new Error("右键平移不应弹出菜单");
}
