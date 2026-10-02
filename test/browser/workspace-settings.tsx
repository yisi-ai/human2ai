// Manual browser regression; bundle with esbuild (browser, automatic JSX), serve
// beside an isolated Human2AI API, and invoke runWorkspaceSettingsRegression().
// Current CI does not execute browser tests. Counters wrap actual component calls
// so renders caused by their own hooks are counted as well as parent updates.
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { ConfigProvider } from "antd";
import { Human2AiWorkspaceSidebar } from "../../design-system/surfaces/human2ai-web/src/local/Human2AiWorkspaceSidebar";
import { UiSketchCanvas } from "../../design-system/surfaces/human2ai-web/src/local/UiSketchCanvas";
import { UI_SKETCH_FIXTURE } from "../../design-system/surfaces/human2ai-web/src/local/uiSketchFixtures";
import { WorkspaceSettings } from "../../web/components/WorkspaceSettings";
import { createAppI18n } from "../../web/i18n/createI18n";
import { RETENTION_DEFAULTS } from "../../src/domain/session/storage";
import { promptTranslationKey } from "../../locales/promptKeys";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const pause = () => new Promise(resolve => setTimeout(resolve, 80));
async function waitFor(predicate: () => boolean | Promise<boolean>) {
  const deadline = performance.now() + 10_000;
  while (!await predicate()) { assert(performance.now() < deadline, "Settings browser regression timed out"); await pause(); }
}
function type(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
function button(label: string): HTMLButtonElement {
  const element = [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.replace(/\s/g, "") === label.replace(/\s/g, "") || button.getAttribute("aria-label") === label);
  assert(element, `Missing settings button: ${label}`); return element;
}
function popup() { return document.querySelector<HTMLElement>(".ant-popconfirm:not(.ant-popover-hidden)"); }
function confirmationButton(label: string) {
  const element = [...(popup()?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
    .find(button => button.textContent?.replace(/\s/g, "") === label.replace(/\s/g, ""));
  assert(element, `Missing confirmation button: ${label}`); return element;
}

export async function runWorkspaceSettingsRegression() {
  const results = [];
  const i18n = createAppI18n("zh-CN");
  for (const size of [20, 200]) {
    const seeded = [];
    for (const [index, sessionType] of ["image-composition", "ui-layout", "spatial"].entries()) {
      const created = await fetch("/api/v1/sessions", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionType, title: `Trash fixture ${size}-${index}` }) });
      assert(created.status === 201, "Isolated browser session fixture must be created");
      const session = await created.json(); seeded.push(session);
      if (index < 2) assert((await fetch(`/api/v1/sessions/${session.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: session.revision }) })).status === 204, "Fixture must enter the recycle bin");
    }
    let sidebarExecutions = 0, canvasExecutions = 0, restored = 0;
    const sessions = Array.from({ length: size }, (_, index) => ({ id: `fixture-${index}`, projectId: null, sessionType: "ui-layout" as const, title: `Session ${index}` }));
    const draft = { ...structuredClone(UI_SKETCH_FIXTURE), rectangles: Array.from({ length: size }, (_, index) => ({
      ...UI_SKETCH_FIXTURE.rectangles[0], id: `node-${index}`, x: index * 15, y: index * 10,
    })) };
    function CountedSidebar() {
      sidebarExecutions++;
      return Human2AiWorkspaceSidebar({ projects: [], sessions, footerExtra: <WorkspaceSettings onRestored={() => { restored++; }} />,
        onCreateComposition: async () => {}, onCreateUiSketch: async () => {}, onCreateProject: async () => {}, onOpenStyleLibrary: () => {},
        onRenameProject: async () => {}, onDeleteProject: async () => {}, onOpenSession: () => {}, onRenameSession: async () => {},
        onMoveSession: async () => {}, onDeleteSession: async () => {} });
    }
    function CountedCanvas() { canvasExecutions++; return UiSketchCanvas({ draft, onDraftChange: () => {},
      translatePrompt: (key, values) => i18n.t(promptTranslationKey("uiSketch", key), values) }); }
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    root.render(<I18nextProvider i18n={i18n}><ConfigProvider><div style={{ display: "flex", height: 800 }}>
      <div style={{ width: 260 }}><CountedSidebar /></div><div style={{ flex: 1 }}><CountedCanvas /></div>
    </div></ConfigProvider></I18nextProvider>);
    try {
      await waitFor(() => !!container.querySelector('button[aria-label="设置"]'));
      button("设置").focus(); button("设置").click();
      await waitFor(() => !!document.querySelector('input[id$="imageRetentionDays"]'));
      // Let the existing canvas entry animation/measurement finish before observing input.
      await new Promise(resolve => setTimeout(resolve, 600)); sidebarExecutions = 0; canvasExecutions = 0;
      let mutations = 0;
      const observer = new MutationObserver(records => { mutations += records.length; });
      const tree = container.querySelector(".human2ai-workspace-sidebar .ant-tree")!;
      const canvas = container.querySelector('.human2ai-ui-sketch-canvas')!;
      assert(tree && canvas, "Actual sidebar and canvas fixture must be mounted");
      observer.observe(tree, { subtree: true, childList: true, attributes: true, characterData: true });
      observer.observe(canvas, { subtree: true, childList: true, attributes: true, characterData: true });
      const originalFetch = window.fetch.bind(window);
      let inFlight = 0, maxInFlight = 0, savesStarted = 0, delayNext = true, deleteRequests = 0, failNextDelete = true;
      window.fetch = async (...args) => {
        if (String(args[0]).includes("/api/v1/trash/sessions") && args[1]?.method === "DELETE") {
          deleteRequests++;
          if (failNextDelete) { failNextDelete = false; return new Response(JSON.stringify({ message: "Fixture deletion failure" }),
            { status: 500, headers: { "Content-Type": "application/json" } }); }
        }
        if (String(args[0]).endsWith("/api/v1/settings") && args[1]?.method === "PUT") {
          inFlight++; savesStarted++; maxInFlight = Math.max(maxInFlight, inFlight);
          try {
            if (delayNext) { delayNext = false; await new Promise(resolve => setTimeout(resolve, 800)); }
            return await originalFetch(...args);
          } finally { inFlight--; }
        }
        return originalFetch(...args);
      };
      const readSettings = async () => (await fetch("/api/v1/settings")).json();
      try {
        const image = document.querySelector<HTMLInputElement>('input[id$="imageRetentionDays"]')!;
        const history = document.querySelector<HTMLInputElement>('input[id$="historyRetentionDays"]')!;
        assert(![...document.querySelectorAll("button")].some(item => item.textContent?.replace(/\s/g, "") === "保存"), "Settings must have no save button");
        assert(image.parentElement?.textContent?.trim() === "天" && !document.querySelector(`label[for="${image.id}"]`)?.textContent?.includes("天"),
          "Day unit must follow the numeric input, outside its label");
        const beforeInvalid = await readSettings();
        type(image, "0"); await new Promise(resolve => setTimeout(resolve, 450));
        assert(document.querySelector('[role="alert"]')?.textContent?.includes("1–3650"), "Invalid days must show field validation");
        assert((await readSettings()).revision === beforeInvalid.revision, "Invalid input must not save settings");
        for (const value of ["", "2", "25", "250", "25"]) { type(image, value); await pause(); }
        type(history, "14");
        await waitFor(() => inFlight === 1);
        assert(!image.disabled && !history.disabled, "Automatic saving must allow continued input");
        type(image, "26"); type(history, "15");
        await waitFor(async () => { const saved = await readSettings(); return saved.imageRetentionDays === 26 && saved.historyRetentionDays === 15; });
        assert(maxInFlight === 1 && savesStarted === 2, "Rapid edits must coalesce and serialize using the newest revision");
        button("回收站").click(); await pause();
        const trash = document.querySelector<HTMLInputElement>('input[id$="trashRetentionDays"]')!;
        type(trash, "30"); button("自动释放").click(); await pause();
        await waitFor(async () => (await readSettings()).trashRetentionDays === 30);
        delayNext = true;
        type(document.querySelector<HTMLInputElement>('input[id$="imageRetentionDays"]')!, "99");
        await waitFor(() => inFlight === 1);
        button("恢复默认值").click();
        await waitFor(async () => { const reset = await readSettings(); return reset.imageRetentionDays === RETENTION_DEFAULTS.imageRetentionDays && reset.historyRetentionDays === RETENTION_DEFAULTS.historyRetentionDays; });
        const reset = await readSettings();
        assert(reset.imageRetentionDays === RETENTION_DEFAULTS.imageRetentionDays && reset.historyRetentionDays === RETENTION_DEFAULTS.historyRetentionDays,
          "Reset must persist automatic cleanup defaults");
        assert(reset.trashRetentionDays === 30, "Reset must preserve trash retention");
        type(document.querySelector<HTMLInputElement>('input[id$="historyRetentionDays"]')!, "9");
        button("关闭设置").click();
        await waitFor(() => !document.querySelector(".ant-modal-root"));
        assert(document.activeElement === container.querySelector('button[aria-label="设置"]'), "Closing must return focus to settings");
        button("设置").focus(); button("设置").click();
        await waitFor(() => !!document.querySelector('input[id$="imageRetentionDays"]'));
        assert(document.querySelector<HTMLInputElement>('input[id$="historyRetentionDays"]')!.value === "9", "Closing immediately after an edit must persist it before reopening");
        button("回收站").click(); await pause();
        const targetRow = () => [...document.querySelectorAll<HTMLElement>(".human2ai-settings__session")]
          .find(row => row.querySelector(".human2ai-settings__session-title")?.textContent === seeded[0].title);
        const deleteTarget = () => {
          const trigger = [...(targetRow()?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
            .find(item => item.textContent?.replace(/\s/g, "") === "立刻删除");
          assert(trigger, "Each trash row must offer immediate deletion"); trigger.focus(); trigger.click();
        };
        deleteTarget(); await waitFor(() => !!popup());
        assert(popup()!.textContent?.includes(seeded[0].title) && popup()!.textContent?.includes("无法恢复"), "Confirmation must identify the target and irreversible deletion");
        confirmationButton("取消").click(); await waitFor(() => !popup());
        assert(deleteRequests === 0 && targetRow(), "Cancelling must keep the session without sending a delete request");
        deleteTarget(); await waitFor(() => !!popup()); confirmationButton("立刻删除").click();
        await waitFor(() => document.querySelector('[role="alert"]')?.textContent === i18n.t("errors.operationFailed"));
        await waitFor(() => !popup());
        assert(targetRow(), "Failed deletion must retain its row and allow retry");
        deleteTarget(); await waitFor(() => !!popup()); confirmationButton("立刻删除").click();
        await waitFor(() => !targetRow()); await waitFor(() => !popup());
        const remaining = (await (await fetch("/api/v1/trash/sessions")).json()).sessions;
        assert(!remaining.some((session: { id: string }) => session.id === seeded[0].id)
          && remaining.some((session: { id: string }) => session.id === seeded[1].id), "Single deletion must leave other trash sessions intact");
        button("清空回收站").click(); await waitFor(() => !!popup()); confirmationButton("取消").click(); await waitFor(() => !popup());
        assert(deleteRequests === 2, "Cancelling empty trash must not send a request");
        button("清空回收站").click(); await waitFor(() => !!popup()); confirmationButton("清空回收站").click();
        await waitFor(() => !!document.querySelector(".human2ai-settings__empty"));
        assert(button("清空回收站").disabled, "Empty trash action must be disabled when the recycle bin is empty");
        assert((await (await fetch("/api/v1/trash/sessions")).json()).sessions.length === 0, "Empty trash must persist");
        assert((await fetch(`/api/v1/sessions/${seeded[2].id}`)).status === 200, "Active sessions must survive emptying trash");
        assert(sidebarExecutions === 0 && canvasExecutions === 0 && mutations === 0,
          `Settings changed unrelated work at ${size}: sidebar=${sidebarExecutions}, canvas=${canvasExecutions}, DOM=${mutations}`);
        assert(restored === 0, "Settings edits must not request a workspace reload");
        results.push({ size, sidebarExecutions, canvasExecutions, mutations, maxInFlight, noSaveButton: true, suffixUnit: true,
          finalInputSaved: true, resetDuringSave: true, resetPreservedTrash: true, immediateCloseSaved: true, reopen: true,
          cancelPreservedTrash: true, failedDeleteKeptRow: true, singleDelete: true, emptyTrash: true, activeSessionPreserved: true });
      } finally { observer.disconnect(); window.fetch = originalFetch; }
    } finally { root.unmount(); container.remove(); }
  }
  return { build: "development esbuild fixture", interaction: "actual settings input, automatic save, editing during a delayed request, section navigation, reset during save, immediate close and reopen, cancelled confirmations, failed deletion, single deletion and empty trash", results, nativeIme: "not exercised" };
}
