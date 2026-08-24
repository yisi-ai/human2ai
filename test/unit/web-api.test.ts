import { describe, expect, it, vi } from "vitest";

import { createDraft } from "../../src/domain/composition/index.js";
import {
  listCompositionDrafts,
  saveCompositionDraft,
} from "../../web/lib/human2ai-api.js";

describe("Human2AI Web API client", () => {
  it("reads draft revisions through the same-origin API", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ draftVersions: [{ revision: 1 }] }),
    ) as typeof fetch;

    await expect(listCompositionDrafts("session/a", fetcher)).resolves.toEqual([
      { revision: 1 },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/sessions/session%2Fa/composition/drafts",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("saves an explicit revision and preserves conflict details", async () => {
    const draft = createDraft();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ revision: 2 }, { status: 201 }))
      .mockResolvedValueOnce(
        Response.json(
          {
            code: "DRAFT_REVISION_CONFLICT",
            message: "revision changed",
            actualLatestRevision: 3,
          },
          { status: 409 },
        ),
      );
    const fetcher = fetchMock as typeof fetch;

    await expect(saveCompositionDraft("session-1", 1, draft, fetcher)).resolves.toEqual({
      revision: 2,
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      expectedLatestRevision: 1,
      draft,
    });

    await expect(
      saveCompositionDraft("session-1", 1, draft, fetcher),
    ).rejects.toMatchObject({
      code: "DRAFT_REVISION_CONFLICT",
      status: 409,
      details: { actualLatestRevision: 3 },
    });
  });
});
