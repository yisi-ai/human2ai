import type { DatabaseConnection } from "./migrate.ts";
import { InvalidRecordError, RevisionConflictError } from "./project-session-repository.ts";
import { type WorkspaceSettings, type RetentionSettings, MAX_RETENTION_DAYS } from "../domain/session/storage.ts";

export class WorkspaceSettingsRepository {
  constructor(private readonly database: DatabaseConnection) {}

  get(): WorkspaceSettings {
    return this.database.prepare<[], WorkspaceSettings>(`SELECT revision,
      image_retention_days AS imageRetentionDays, history_retention_days AS historyRetentionDays,
      trash_retention_days AS trashRetentionDays FROM workspace_settings WHERE id = 1`).get()!;
  }

  update(input: RetentionSettings & { expectedRevision: number }): WorkspaceSettings {
    for (const value of [input.imageRetentionDays, input.historyRetentionDays, input.trashRetentionDays]) {
      if (!Number.isInteger(value) || value < 1 || value > MAX_RETENTION_DAYS) {
        throw new InvalidRecordError(`Retention must be an integer between 1 and ${MAX_RETENTION_DAYS} days.`);
      }
    }
    return this.database.transaction(() => {
      const current = this.get();
      if (current.revision !== input.expectedRevision) throw new RevisionConflictError(input.expectedRevision, current.revision);
      this.database.prepare(`UPDATE workspace_settings SET revision = revision + 1,
        image_retention_days = ?, history_retention_days = ?, trash_retention_days = ? WHERE id = 1`)
        .run(input.imageRetentionDays, input.historyRetentionDays, input.trashRetentionDays);
      return this.get();
    })();
  }
}
