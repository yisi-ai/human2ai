import type { RetentionSettings, WorkspaceSettings } from "../../src/domain/session/storage";
import { getWorkspaceSettings, saveWorkspaceSettings } from "./human2ai-api";

/** Owns pending field edits and serializes writes against the last acknowledged revision. */
export class WorkspaceSettingsAutosave {
  private pending: Partial<RetentionSettings> = {};
  private saving: Promise<void> | null = null;
  constructor(private current: WorkspaceSettings) {}

  change(key: keyof RetentionSettings, value: number): void { this.pending[key] = value; }
  flush(): Promise<void> { return this.save(false); }
  retry(): Promise<void> { return this.save(true); }

  private save(refresh: boolean): Promise<void> {
    if (this.saving) return this.saving;
    this.saving = (async () => {
      if (refresh) this.current = await getWorkspaceSettings();
      while (Object.keys(this.pending).length) {
        for (const key of Object.keys(this.pending) as (keyof RetentionSettings)[]) {
          if (this.pending[key] === this.current[key]) delete this.pending[key];
        }
        if (!Object.keys(this.pending).length) break;
        const edits = { ...this.pending };
        const { revision, ...values } = this.current;
        this.current = await saveWorkspaceSettings({ ...values, ...edits }, revision);
        for (const key of Object.keys(edits) as (keyof RetentionSettings)[]) {
          if (this.pending[key] === edits[key]) delete this.pending[key];
        }
      }
    })().finally(() => { this.saving = null; });
    return this.saving;
  }
}
