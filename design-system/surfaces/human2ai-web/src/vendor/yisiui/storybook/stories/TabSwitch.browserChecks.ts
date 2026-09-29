/** Real browser layout regression: run by the retained DynamicItems Story in dev and static builds. */
export async function verifyTabSwitchDynamicLayout(canvas: HTMLElement): Promise<void> {
  const wait = (ms = 0) => new Promise<void>(resolve => setTimeout(resolve, ms));
  const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const host = canvas.querySelector<HTMLElement>("[data-tab-layout-fixture]")!;
  const root = () => {
    const node = host.querySelector<HTMLElement>('[aria-label="动态状态栏"]');
    if (!node) throw new Error("TabSwitch unmounted during layout regression");
    return node;
  };
  const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
  const rows = () => Array.from(root().querySelectorAll<HTMLElement>("[data-tab-key]"));
  const selected = () => root().querySelector<HTMLInputElement>("input:checked")!.value;
  const output = () => host.querySelector<HTMLOutputElement>("output")!;
  const action = async (name: string) => { host.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!.click(); await wait(); };
  const choose = async (label: string, value: string) => {
    const control = host.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!;
    control.value = value; control.dispatchEvent(new Event("change", { bubbles: true })); await wait();
  };
  const visibleMenu = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menu"]')).find(node => node.getBoundingClientRect().width && !node.closest(".ant-dropdown-hidden"));
  const until = async (condition: () => unknown, message: string) => {
    const deadline = performance.now() + 10000;
    while (!condition() && performance.now() < deadline) await frame();
    check(condition(), message);
  };
  const report: Record<string, unknown>[] = [];
  const geometry = () => {
    const control = root(), track = control.querySelector<HTMLElement>(".yisi-tab-switch-track")!, viewport = control.querySelector<HTMLElement>(".yisi-tab-switch-viewport")!;
    return { root: control.clientWidth, track: track.clientWidth, painted: track.scrollWidth, viewport: viewport.clientWidth, scroll: viewport.scrollLeft, arrows: control.querySelectorAll(".yisi-tab-switch-scroll-arrow").length };
  };
  const quiet = async (scenario: string) => {
    await wait(550);
    const control = root(), before = geometry(), commits = host.dataset.commits;
    let mutations = 0;
    const observer = new MutationObserver(records => { mutations += records.length; });
    observer.observe(control, { attributes: true, subtree: true, childList: true, characterData: true });
    await wait(240);
    observer.disconnect();
    check(root() === control, `${scenario}: replaced root`);
    check(mutations === 0, `${scenario}: sustained DOM updates (${mutations})`);
    check(host.dataset.commits === commits, `${scenario}: sustained React commits`);
    check(JSON.stringify(geometry()) === JSON.stringify(before), `${scenario}: unstable geometry`);
    report.push({ scenario, ...before, settledMutations: mutations, settledCommits: commits === undefined ? null : 0, profilerAvailable: commits !== undefined });
  };
  const menuAction = async (index: number, text: string) => {
    const row = rows()[index];
    const button = row.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
    button.focus();
    button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, isPrimary: true }));
    button.click();
    await until(() => visibleMenu(), "Hover-mode keyboard menu did not open");
    const menu = visibleMenu();
    const option = Array.from(menu!.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(node => node.textContent === text);
    check(option, `Missing menu action ${text}`);
    option!.click();
    await until(() => !visibleMenu(), "Menu did not finish closing after its action");
  };
  const drag = async (cancel: boolean) => {
    const original = rows(), control = root(), beforeOrder = output().dataset.order, beforeSelection = selected();
    const label = original[2].querySelector<HTMLElement>("label")!, source = label.getBoundingClientRect(), target = original[3].getBoundingClientRect();
    const y = source.y + source.height / 2;
    const pointer = (type: string, x: number, clientY = y) => new PointerEvent(type, { bubbles: true, isPrimary: true, pointerId: 51, pointerType: "mouse", button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: x, clientY });
    label.dispatchEvent(pointer("pointerdown", source.x + source.width / 2)); await wait(380);
    check(control.dataset.dragState === "dragging", "Long press did not activate");
    window.dispatchEvent(pointer("pointermove", target.right - 2)); await frame();
    check(original[3].style.transform && original[3].style.transform !== "translate3d(0px, 0px, 0px)", "Live displacement missing");
    check(output().dataset.order === beforeOrder && rows().every((row, index) => row === original[index]), "Preview changed formal order or nodes");
    if (cancel) {
      const outside = control.getBoundingClientRect().bottom + 30;
      window.dispatchEvent(pointer("pointermove", target.right - 2, outside)); await frame();
      check(control.dataset.dragState === "cancel", "Outside cancel feedback missing");
      check(original.every(node => node.style.transform === "translate3d(0px, 0px, 0px)"), "Outside preview did not reset");
      window.dispatchEvent(pointer("pointerup", target.right - 2, outside)); await wait();
      check(output().dataset.order === beforeOrder && output().dataset.reorders === "0", "Outside release committed order");
    } else {
      window.dispatchEvent(pointer("pointerup", target.right - 2)); await wait();
      check(output().dataset.order !== beforeOrder && output().dataset.reorders === "1", "Inside drop did not commit exactly once");
      check(rows().every(node => original.includes(node)), "Committed reorder rebuilt tabs");
    }
    check(selected() === beforeSelection && !control.hasAttribute("data-drag-state"), "Drag changed selection or retained temporary state");
  };

  // Real hover-mode menu sequence: rename a nonselected tab, insert/select,
  // outside cancellation, committed reorder, and selected-item deletion.
  for (const width of ["intrinsic", "420"]) {
    await action("reset"); await choose("布局宽度", width); await choose("布局方向", "ltr");
    await menuAction(1, "重命名");
    check(selected() === "1" && rows()[1].textContent?.includes("激活"), "Rename changed selection or did not update label");
    await menuAction(1, "新建");
    check(rows().length === 4 && selected() === rows()[2].dataset.tabKey, "Insert did not select the new tab");
    await drag(true); await drag(false);
    await menuAction(3, "删除");
    check(rows().length === 3 && selected() === "1", "Delete did not recover selection");
    await quiet(`${width}: menu/create/cancel/reorder/delete`);
  }

  // Freeze a *real CSS transition* at an intermediate frame to reproduce the
  // former synchronous feedback loop deterministically, without mocked widths.
  await action("reset"); await choose("布局宽度", "intrinsic");
  rows()[2].querySelector<HTMLInputElement>("input")!.click(); await wait();
  const indicator = root().querySelector<HTMLElement>(".yisi-tab-switch-selection")!;
  indicator.getAnimations().forEach(animation => animation.finish());
  void indicator.getBoundingClientRect();
  const original = rows();
  await action("delete");
  const animations = indicator.getAnimations();
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) check(animations.length > 0, "Selection transition was disabled");
  animations.forEach(animation => { animation.pause(); animation.currentTime = 45; });
  report.push({ scenario: "frozen deletion transition", ...geometry(), transform: getComputedStyle(indicator).transform });
  const survivor = rows()[0].querySelector<HTMLInputElement>("input")!;
  survivor.focus();
  await action("refresh");
  check(rows().every((row, index) => row === original[index]), "Refresh rebuilt surviving tabs");
  check(document.activeElement === survivor, "Refresh lost radio focus");
  await quiet("frozen deletion transition + equivalent refresh");
  check(geometry().arrows === 0 && geometry().painted <= geometry().track + 1, `Animated background changed intrinsic overflow: ${JSON.stringify(geometry())}`);
  animations.forEach(animation => animation.finish());

  for (const width of ["intrinsic", "420", "180"]) {
    for (const direction of ["ltr", "rtl"]) {
      await action("reset"); await choose("布局宽度", width); await choose("布局方向", direction);
      await action("long"); await wait(80);
      if (width !== "intrinsic") check(geometry().arrows === 2, "Long content must retain real overflow arrows");
      const viewport = root().querySelector<HTMLElement>(".yisi-tab-switch-viewport")!;
      viewport.scrollLeft = direction === "rtl" ? -30 : 30; await wait(80);
      const before = rows(), focus = before[1].querySelector<HTMLInputElement>("input")!;
      focus.focus({ preventScroll: true });
      const scroll = viewport.scrollLeft;
      await action("refresh"); await wait(50);
      check(rows().every((row, index) => row === before[index]) && document.activeElement === focus, "Long-name refresh lost identity/focus");
      check(viewport.scrollLeft === scroll, "Equivalent refresh reset scroll");
      // Real, unpaused animation plus repeated commits while its old width shrinks.
      await action("rename");
      for (let count = 0; count < 6; count++) { await wait(20); await action("refresh"); }
      for (const index of [2, 0, 1, 2, 0]) { rows()[index].querySelector<HTMLInputElement>("input")!.click(); await wait(20); }
      await action("new"); await action("delete");
      await quiet(`${width}/${direction}: long-name/rename/rapid-selection/insert/delete`);
    }
  }
  await action("reset"); await choose("布局宽度", "intrinsic"); await choose("布局方向", "ltr");
  rows()[0].dispatchEvent(new MouseEvent("mouseover", { bubbles: true, buttons: 0 }));
  await until(() => visibleMenu(), "Pointer hover did not open the menu");
  const hoveredMenu = visibleMenu();
  check(selected() === "1", "Hover changed selection");
  hoveredMenu!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
  rows()[0].dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: host }));
  await wait();
  check(rows()[0].querySelector('[aria-haspopup="menu"]')?.getAttribute("aria-expanded") === "false", "Escape did not close hover menu");

  await quiet("final");
  host.dataset.browserReport = JSON.stringify(report);
  host.dataset.interactionsPassed = "true";
}
