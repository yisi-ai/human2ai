// Manual browser regression; current CI does not run this fixture.
import { createRoot } from "react-dom/client";
import { useMemo, useState } from "react";
import { ConfigProvider } from "antd";
import { Human2AiWorkspaceSidebar, type Human2AiWorkspaceSidebarProps } from "../../design-system/surfaces/human2ai-web/src/local/Human2AiWorkspaceSidebar";
import { UiSketchCanvas } from "../../design-system/surfaces/human2ai-web/src/local/UiSketchCanvas";
import { UI_SKETCH_FIXTURE } from "../../design-system/surfaces/human2ai-web/src/local/uiSketchFixtures";
import { createAppI18n } from "../../web/i18n/createI18n";
import { promptTranslationKey } from "../../locales/promptKeys";
import { useWorkspaceTreeExpansion, WORKSPACE_TREE_COLLAPSED_KEYS } from "../../web/lib/use-workspace-tree-expansion";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const pause = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate: () => boolean) {
  const deadline = performance.now() + 10_000;
  while (!predicate()) { assert(performance.now() < deadline, "Session reveal timed out"); await pause(); }
}
const callbacks = { onCreateComposition: async () => {}, onCreateUiSketch: async () => {}, onCreateProject: async () => {},
  onOpenStyleLibrary: () => {}, onRenameProject: async () => {}, onDeleteProject: async () => {},
  onOpenSession: () => {}, onRenameSession: async () => {}, onMoveSession: async () => {}, onDeleteSession: async () => {} };

export async function runSidebarSessionRevealRegression() {
  const results = [];
  const previousStorage = localStorage.getItem(WORKSPACE_TREE_COLLAPSED_KEYS);
  for (const size of [20, 200]) {
    localStorage.setItem(WORKSPACE_TREE_COLLAPSED_KEYS, size === 20 ? "invalid" : "[]");
    const targetId = `target-${size}`;
    const projects = [{ id: "first", name: "First project" }, { id: "last", name: "Last project" }];
    const sessions: Human2AiWorkspaceSidebarProps["sessions"] = [
      ...Array.from({ length: size }, (_, index) => ({ id: `session-${index}`, title: `Session ${index}`,
        projectId: "first", sessionType: "ui-layout" as const, revision: 1 })),
      { id: targetId, title: "Deep linked session", projectId: "last", sessionType: "spatial", revision: 1 },
      { id: "unassigned", title: "Unassigned session", projectId: null, sessionType: "image-composition", revision: 1 },
    ];
    const groups = [{ id: "group", projectId: "last", name: "Target group", sessionIds: [targetId] }];
    let update!: (props: Partial<Human2AiWorkspaceSidebarProps>) => void;
    let remount!: () => void;
    let canvasExecutions = 0;
    function Sidebar() {
      const [props, setProps] = useState<Partial<Human2AiWorkspaceSidebarProps>>({ loading: true, currentSessionId: targetId });
      update = patch => setProps(current => ({ ...current, ...patch }));
      const keys = useMemo(() => [...(props.projects ?? []).map(project => `project:${project.id}`),
        ...(props.groups ?? []).map(group => `group:${group.id}`),
        ...((props.sessions ?? []).some(session => session.projectId === null) ? ["project:unassigned"] : [])],
        [props.projects, props.groups, props.sessions]);
      const expansion = useWorkspaceTreeExpansion(keys);
      return <Human2AiWorkspaceSidebar {...callbacks} projects={[]} sessions={[]} {...props} {...expansion} />;
    }
    function SidebarOwner() {
      const [instance, setInstance] = useState(0); remount = () => setInstance(current => current + 1);
      return <Sidebar key={instance} />;
    }
    const i18n = createAppI18n("en");
    const draft = { ...structuredClone(UI_SKETCH_FIXTURE), rectangles: Array.from({ length: size }, (_, index) => ({
      ...UI_SKETCH_FIXTURE.rectangles[0], id: `node-${index}`, x: index * 15, y: index * 10,
    })) };
    function Canvas() { canvasExecutions++; return UiSketchCanvas({ draft, onDraftChange: () => {},
      translatePrompt: (key, values) => i18n.t(promptTranslationKey("uiSketch", key), values) }); }
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    root.render(<ConfigProvider><div style={{ display: "flex", height: 800 }}>
      <div style={{ width: 280 }}><SidebarOwner /></div><div style={{ flex: 1 }}><Canvas /></div>
    </div></ConfigProvider>);
    const tree = () => container.querySelector<HTMLElement>(".yisi-asset-skeleton-tree")!;
    const row = (key: string) => container.querySelector<HTMLElement>(`[data-session-tree-key="${key}"]`)?.closest<HTMLElement>(".ant-tree-treenode");
    const visible = (key: string) => {
      const item = row(key), scrollport = tree();
      if (!item || !scrollport) return false;
      const target = item.getBoundingClientRect(), bounds = scrollport.getBoundingClientRect();
      return target.height > 0 && target.top >= bounds.top - 1 && target.bottom <= bounds.top + scrollport.clientHeight + 1;
    };
    const assertUpperPlacement = (key: string) => {
      const scrollport = tree(), item = row(key); assert(item, `Missing session ${key}`);
      const offset = item.getBoundingClientRect().top - scrollport.getBoundingClientRect().top - scrollport.clientTop;
      const expected = Math.max(0, Math.min(scrollport.scrollHeight - scrollport.clientHeight,
        scrollport.scrollTop + offset - scrollport.clientHeight / 4));
      assert(Math.abs(scrollport.scrollTop - expected) <= 1, "Session must align to the upper quarter or the scroll boundary");
    };
    const collapse = async (key: string) => {
      await waitFor(() => !tree().querySelector(".ant-tree-treenode-motion"));
      const item = row(key); assert(item, `Missing parent ${key}`);
      if (item.getAttribute("aria-expanded") === "true") item.querySelector<HTMLElement>(".ant-tree-switcher")!.click();
      await waitFor(() => row(key)?.getAttribute("aria-expanded") === "false");
      await pause();
      await waitFor(() => !tree().querySelector(".ant-tree-treenode-motion"));
      await pause();
    };
    const expand = async (key: string) => {
      await waitFor(() => !tree().querySelector(".ant-tree-treenode-motion"));
      const item = row(key); assert(item, `Missing parent ${key}`);
      if (item.getAttribute("aria-expanded") === "false") item.querySelector<HTMLElement>(".ant-tree-switcher")!.click();
      await waitFor(() => row(key)?.getAttribute("aria-expanded") === "true");
      await pause();
      await waitFor(() => !tree().querySelector(".ant-tree-treenode-motion"));
      await pause();
    };
    const marked = (key: string) => !!row(key)?.querySelector(".human2ai-workspace-sidebar__current-dot");
    const saved = () => JSON.parse(localStorage.getItem(WORKSPACE_TREE_COLLAPSED_KEYS) ?? "[]") as string[];
    const reloadSidebar = async () => {
      const oldUpdate = update; remount(); await waitFor(() => update !== oldUpdate); await pause();
      update({ loading: false, projects, sessions, groups });
    };
    const observer = new MutationObserver(records => { canvasMutations += records.length; });
    let canvasMutations = 0;
    try {
      await waitFor(() => !!update); await pause(600);
      canvasExecutions = 0;
      observer.observe(container.querySelector(".human2ai-ui-sketch-canvas")!, { subtree: true, childList: true, attributes: true, characterData: true });
      const beforePageScroll = [scrollX, scrollY];
      update({ loading: false, projects, sessions, groups });
      await waitFor(() => visible(`session:${targetId}`)); await pause(450);
      assert(visible(`session:${targetId}`), "Delayed list loading must reveal the deep-linked session after expansion settles");
      assert(row(`session:${targetId}`)?.getAttribute("aria-selected") === "true", "Deep-linked session must stay selected");
      assert(tree().scrollTop > 0, "Deep session must move the sidebar scroll position");
      assertUpperPlacement(`session:${targetId}`);
      assert(Math.abs(tree().scrollTop - (tree().scrollHeight - tree().clientHeight)) <= 1, "Insufficient content below must clamp to the bottom");
      const originalTree = tree();
      // A normal data refresh must respect the user's subsequent manual scrolling.
      tree().scrollTop = 0;
      update({ sessions: [...sessions] }); await pause(450);
      assert(tree() === originalTree && tree().scrollTop === 0, "Unchanged active session must not force another scroll or remount the tree");
      const middleKey = `session:session-${Math.floor(size / 2)}`;
      update({ currentSessionId: `session-${Math.floor(size / 2)}` });
      await waitFor(() => visible(middleKey) && row(middleKey)?.getAttribute("aria-selected") === "true"); await pause(450);
      assertUpperPlacement(middleKey);
      if (size === 200) assert(tree().scrollTop > 0 && tree().scrollTop < tree().scrollHeight - tree().clientHeight,
        "Large fixture must exercise upper placement without reaching a scroll boundary");
      // Switching sessions respects collapsed ancestors and marks the visible one.
      update({ currentSessionId: "session-0" });
      await waitFor(() => visible("session:session-0") && row("session:session-0")?.getAttribute("aria-selected") === "true");
      await collapse("group:group"); await collapse("project:last");
      await waitFor(() => saved().includes("project:last") && saved().includes("group:group"));
      update({ currentSessionId: targetId });
      await waitFor(() => visible("project:last") && marked("project:last")); await pause(450);
      assert(row("project:last")?.getAttribute("aria-expanded") === "false", "Deep linking must preserve project collapse");
      assertUpperPlacement("project:last");
      const dot = row("project:last")!.querySelector<HTMLElement>(".human2ai-workspace-sidebar__current-dot")!;
      const style = getComputedStyle(dot);
      assert(style.backgroundColor === "rgb(22, 163, 74)" && style.borderRadius === "50%", "Marker must be a solid theme-green circle");
      assert(dot.getAttribute("aria-label") === "包含当前会话", "Marker must describe the hidden current session");
      await expand("project:last"); await waitFor(() => marked("group:group") && !marked("project:last")); await pause(450);
      await waitFor(() => !saved().includes("project:last") && saved().includes("group:group"));
      await reloadSidebar();
      await waitFor(() => visible("group:group") && marked("group:group")); await pause(450);
      assert(row("project:last")?.getAttribute("aria-expanded") === "true" && row("group:group")?.getAttribute("aria-expanded") === "false",
        "Remount must restore open project and collapsed group");
      assertUpperPlacement("group:group");
      await expand("group:group"); await waitFor(() => !!row(`session:${targetId}`) && !marked("group:group")); await pause(450);
      await collapse("project:last"); await waitFor(() => saved().includes("project:last"));
      await reloadSidebar(); await waitFor(() => visible("project:last") && marked("project:last")); await pause(450);
      assert(row("project:last")?.getAttribute("aria-expanded") === "false", "Remount must restore project collapse");
      assertUpperPlacement("project:last");
      await collapse("project:unassigned");
      update({ currentSessionId: "unassigned" }); await waitFor(() => visible("project:unassigned") && marked("project:unassigned")); await pause(450);
      assert(row("project:unassigned")?.getAttribute("aria-expanded") === "false", "Unassigned container collapse must also be respected");
      assertUpperPlacement("project:unassigned");
      const beforeUnknown = tree().scrollTop;
      update({ currentSessionId: "unknown-session" }); await pause(450);
      assert(tree().scrollTop === beforeUnknown, "Unknown session must not change the scroll position");
      update({ currentSessionId: "session-0" }); await pause(20);
      update({ currentSessionId: "unassigned" });
      await waitFor(() => visible("project:unassigned") && marked("project:unassigned"));
      await pause(450); assertUpperPlacement("project:unassigned");
      assert(row("project:unassigned")?.getAttribute("aria-expanded") === "false", "Manual collapse of the active session's parent must be preserved");
      assert(canvasExecutions === 0 && canvasMutations === 0, "Sidebar reveal must not execute or mutate the canvas");
      assert(scrollX === beforePageScroll[0] && scrollY === beforePageScroll[1], "Only the sidebar scrollport may move");
      results.push({ size, delayedLoad: true, selection: true, collapsedProjectReveal: true, collapsedGroupReveal: true, unassignedReveal: true,
        browserPersistence: true, restoredProjectCollapse: true, restoredGroupCollapse: true, themedMarker: true,
        upperPlacement: true, bottomClamped: true,
        manualScrollPreserved: true, manualCollapsePreserved: true, rapidSwitch: true, treeIdentityPreserved: true,
        unknownSessionNoScroll: true, canvasExecutions, canvasMutations, pageScrollUnchanged: true });
    } finally {
      observer.disconnect(); root.unmount(); container.remove();
      if (previousStorage === null) localStorage.removeItem(WORKSPACE_TREE_COLLAPSED_KEYS);
      else localStorage.setItem(WORKSPACE_TREE_COLLAPSED_KEYS, previousStorage);
    }
  }
  return { build: "development esbuild fixture", interaction: "deep link before delayed data, upper-quarter placement and bottom clamping, manual scroll, list refresh, browser persistence across sidebar remounts, collapsed ancestors and theme markers, rapid switching, unassigned and unknown sessions", results };
}
