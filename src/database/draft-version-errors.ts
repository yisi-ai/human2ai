import type { SessionType } from "../domain/session/index.ts";

export class DraftSessionTypeMismatchError extends Error {
  readonly code = "SESSION_TYPE_MISMATCH";

  constructor(
    readonly sessionId: string,
    readonly actualType: SessionType,
    readonly expectedType: SessionType,
  ) {
    super(`Session ${sessionId} has type ${actualType}; expected ${expectedType}`);
  }
}

export class DraftRevisionConflictError extends Error {
  readonly code = "DRAFT_REVISION_CONFLICT";

  constructor(
    readonly expectedLatestRevision: number,
    readonly actualLatestRevision: number,
  ) {
    super(
      `Expected latest draft revision ${expectedLatestRevision}, received ${actualLatestRevision}`,
    );
  }
}

export class DraftVersionNotFoundError extends Error {
  readonly code = "DRAFT_VERSION_NOT_FOUND";

  constructor(
    readonly sessionId: string,
    readonly revision: number,
    sessionLabel: string,
  ) {
    super(`Draft revision ${revision} not found in ${sessionLabel} ${sessionId}`);
  }
}

export class DraftUndoUnavailableError extends Error {
  readonly code = "DRAFT_UNDO_UNAVAILABLE";

  constructor(readonly changeRevision: number) {
    super(`Draft revision ${changeRevision} has no previous revision to restore`);
  }
}

export class StyleProcessingStaleError extends Error {
  readonly code = "STYLE_PROCESSING_STALE";

  constructor() {
    super("The session style changed. Reconnect and read the current canvas and style before processing again.");
  }
}
