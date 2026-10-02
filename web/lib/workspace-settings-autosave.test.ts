import { beforeEach, expect, it, vi } from "vitest";
import { getWorkspaceSettings, saveWorkspaceSettings } from "./human2ai-api";
import { WorkspaceSettingsAutosave } from "./workspace-settings-autosave";
import type { WorkspaceSettings } from "../../src/domain/session/storage";

vi.mock("./human2ai-api", () => ({ getWorkspaceSettings: vi.fn(), saveWorkspaceSettings: vi.fn() }));
const initial: WorkspaceSettings = { revision: 1, imageRetentionDays: 1, historyRetentionDays: 7, trashRetentionDays: 7 };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(saveWorkspaceSettings).mockImplementation(async (values, revision) => ({ ...values, revision: revision + 1 }));
});

it("coalesces pending values and skips values already persisted", async () => {
  const queue = new WorkspaceSettingsAutosave(initial);
  queue.change("imageRetentionDays", 2); queue.change("imageRetentionDays", 25);
  queue.change("historyRetentionDays", 14);
  await queue.flush();
  expect(saveWorkspaceSettings).toHaveBeenCalledExactlyOnceWith({ imageRetentionDays: 25, historyRetentionDays: 14, trashRetentionDays: 7 }, 1);
  queue.change("imageRetentionDays", 25); await queue.flush();
  expect(saveWorkspaceSettings).toHaveBeenCalledTimes(1);
});

it("serializes edits made during a request without losing them or reusing a stale revision", async () => {
  let finish!: (settings: WorkspaceSettings) => void;
  vi.mocked(saveWorkspaceSettings).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const queue = new WorkspaceSettingsAutosave(initial);
  queue.change("imageRetentionDays", 2);
  const closing = queue.flush();
  queue.change("imageRetentionDays", 20); queue.change("trashRetentionDays", 30);
  const otherFlush = queue.flush();
  expect(saveWorkspaceSettings).toHaveBeenCalledTimes(1);
  finish({ ...initial, imageRetentionDays: 2, revision: 2 });
  await Promise.all([closing, otherFlush]);
  expect(saveWorkspaceSettings).toHaveBeenLastCalledWith({ imageRetentionDays: 20, historyRetentionDays: 7, trashRetentionDays: 30 }, 2);
});

it("applies reset after an in-flight edit while retaining the trash value", async () => {
  let finish!: (settings: WorkspaceSettings) => void;
  vi.mocked(saveWorkspaceSettings).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const queue = new WorkspaceSettingsAutosave(initial);
  queue.change("imageRetentionDays", 25);
  const saving = queue.flush();
  queue.change("trashRetentionDays", 30); queue.change("imageRetentionDays", 1); queue.change("historyRetentionDays", 7);
  finish({ ...initial, imageRetentionDays: 25, revision: 2 });
  await saving;
  expect(saveWorkspaceSettings).toHaveBeenLastCalledWith({ imageRetentionDays: 1, historyRetentionDays: 7, trashRetentionDays: 30 }, 2);
});

it("retains failed edits and merges only those fields when retrying against a refreshed revision", async () => {
  vi.mocked(saveWorkspaceSettings).mockRejectedValueOnce(new Error("conflict"));
  const queue = new WorkspaceSettingsAutosave(initial);
  queue.change("imageRetentionDays", 3);
  await expect(queue.flush()).rejects.toThrow("conflict");
  expect(saveWorkspaceSettings).toHaveBeenCalledTimes(1);
  vi.mocked(getWorkspaceSettings).mockResolvedValue({ ...initial, revision: 4, trashRetentionDays: 30 });
  await queue.retry();
  expect(saveWorkspaceSettings).toHaveBeenLastCalledWith({ imageRetentionDays: 3, historyRetentionDays: 7, trashRetentionDays: 30 }, 4);
});
