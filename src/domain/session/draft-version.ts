export interface StyleProcessingInput {
  styleId: string;
  styleRevision: number;
  sessionRevision: number;
}

export interface StyleProcessing {
  styleId: string;
  styleRevision: number;
  sourceRevision: number;
  resultRevision: number;
}

export interface DraftVersion<TDraft> {
  id: string;
  sessionId: string;
  revision: number;
  fingerprint: string;
  draft: TDraft;
  createdAt: string;
  styleProcessing?: StyleProcessing;
}

export interface CreateDraftVersionInput {
  expectedLatestRevision: number;
  draft: unknown;
  styleProcessing?: StyleProcessingInput;
}

export interface UndoDraftVersionInput {
  changeRevision: number;
  expectedLatestRevision: number;
}

export interface RestoreDraftVersionInput {
  targetRevision: number;
  expectedLatestRevision: number;
}

export interface DraftVersionOperations<TDraft> {
  restoreDraftVersion(sessionId: string, input: RestoreDraftVersionInput): DraftVersion<TDraft>;
  listDraftVersions(sessionId: string): DraftVersion<TDraft>[];
  getLatestDraftVersion(sessionId: string, knownRevision?: number): DraftVersion<TDraft> | null;
  getDraftVersion(sessionId: string, revision: number): DraftVersion<TDraft>;
  createDraftVersion(
    sessionId: string,
    input: CreateDraftVersionInput,
  ): DraftVersion<TDraft>;
  undoDraftVersion(
    sessionId: string,
    input: UndoDraftVersionInput,
  ): DraftVersion<TDraft>;
}
