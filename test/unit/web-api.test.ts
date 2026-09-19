import { describe, expect, it, vi } from "vitest";

import { createDraft } from "../../src/domain/composition/index.js";
import { createUiSketchDraft } from "../../src/domain/ui-sketch/index.js";
import {
  createCompositionSession,
  createSpatialSession,
  createUserStyle,
  deleteStyle,
  deleteStyleReference,
  createUiSketchSession,
  deleteSession,
  imageAssetContentUrl,
  listCompositionDrafts,
  getLatestSpatialDraftVersion,
  listStyles,
  listUiSketchDrafts,
  moveSession,
  renameSession,
  saveCompositionDraft,
  saveUiSketchDraft,
  styleReferenceContentUrl,
  updateStyle,
  uploadImageAsset,
  uploadStyleReference,
} from "../../web/lib/human2ai-api.js";

describe("Human2AI Web API client", () => {
  it.each([
    ["image-composition", createCompositionSession],
    ["ui-layout", createUiSketchSession],
    ["spatial", createSpatialSession],
  ] as const)("creates an unassigned %s session for the home entry", async (sessionType, create) => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({
      id: "created-session",
      sessionType,
      projectId: null,
    }, { status: 201 }));
    await expect(create("Untitled", null, fetcher)).resolves.toMatchObject({
      id: "created-session", sessionType, projectId: null,
    });
    expect(fetcher).toHaveBeenCalledWith("/api/v1/sessions", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ sessionType, title: "Untitled" });
    expect(body.projectId ?? null).toBeNull();
  });

  it("checks the known spatial revision without requesting its history", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ draftVersion: { revision: 702 } }))
      .mockResolvedValueOnce(Response.json({ draftVersion: null }));
    await expect(getLatestSpatialDraftVersion("session/a", 701, fetcher)).resolves.toEqual({ revision: 702 });
    await expect(getLatestSpatialDraftVersion("session/a", 702, fetcher)).resolves.toBeNull();
    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/v1/sessions/session%2Fa/spatial/drafts/latest?knownRevision=701", expect.objectContaining({ cache: "no-store" }));
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/v1/sessions/session%2Fa/spatial/drafts/latest?knownRevision=702", expect.objectContaining({ cache: "no-store" }));
  });

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

  it("creates, reads, and saves UI sketch sessions through their own endpoints", async () => {
    const draft = createUiSketchDraft();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ id: "ui-session", sessionType: "ui-layout" }, { status: 201 }),
      )
      .mockResolvedValueOnce(Response.json({ draftVersions: [{ revision: 1, draft }] }))
      .mockResolvedValueOnce(Response.json({ revision: 2, draft }, { status: 201 }));
    const fetcher = fetchMock as typeof fetch;

    await expect(createUiSketchSession("UI 草图", null, fetcher)).resolves.toMatchObject({
      sessionType: "ui-layout",
    });
    await expect(listUiSketchDrafts("session/ui", fetcher)).resolves.toEqual([
      { revision: 1, draft },
    ]);
    await expect(saveUiSketchDraft("session/ui", 1, draft, fetcher)).resolves.toEqual({
      revision: 2,
      draft,
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      sessionType: "ui-layout",
      title: "UI 草图",
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/v1/sessions/session%2Fui/ui-sketch/drafts",
    );
    expect(JSON.parse(fetchMock.mock.calls[2][1]?.body as string)).toEqual({
      expectedLatestRevision: 1,
      draft,
    });
  });

  it("creates typed sessions inside the requested project", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ id: "composition", projectId: "project-1" }, { status: 201 }),
      )
      .mockResolvedValueOnce(
        Response.json({ id: "interface", projectId: "project-1" }, { status: 201 }),
      );
    const fetcher = fetchMock as typeof fetch;

    await createCompositionSession("主视觉构图", "project-1", fetcher);
    await createUiSketchSession("落地页布局", "project-1", fetcher);

    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      sessionType: "image-composition",
      title: "主视觉构图",
      projectId: "project-1",
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({
      sessionType: "ui-layout",
      title: "落地页布局",
      projectId: "project-1",
    });
  });

  it("renames and deletes sessions through revision-aware requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: "session-1", revision: 2 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const fetcher = fetchMock as typeof fetch;

    await expect(renameSession("session/1", "新名称", 1, fetcher)).resolves.toEqual({
      id: "session-1",
      revision: 2,
    });
    expect(fetchMock.mock.calls[0]).toEqual([
      "/api/v1/sessions/session%2F1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "新名称", expectedRevision: 1 }),
      }),
    ]);

    await expect(deleteSession("session/1", 2, fetcher)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[1]).toEqual([
      "/api/v1/sessions/session%2F1",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ expectedRevision: 2 }),
      }),
    ]);
  });

  it("moves sessions to a project through a revision-aware request", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ id: "session-1", projectId: "project-2", revision: 2 }),
    ) as typeof fetch;

    await expect(moveSession("session/1", "project/2", 1, fetcher)).resolves.toEqual({
      id: "session-1",
      projectId: "project-2",
      revision: 2,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/sessions/session%2F1/project",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ projectId: "project/2", expectedRevision: 1 }),
      }),
    );
  });

  it("uploads image bytes without JSON encoding", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "人物 参考.png", {
      type: "image/png",
    });
    const fetchMock = vi.fn(async () => Response.json({
      id: "asset-1",
      sessionId: "session/1",
      mimeType: "image/png",
    }, { status: 201 }));
    const fetcher = fetchMock as typeof fetch;

    await expect(uploadImageAsset("session/1", file, fetcher)).resolves.toMatchObject({
      id: "asset-1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/sessions/session%2F1/assets?filename=%E4%BA%BA%E7%89%A9%20%E5%8F%82%E8%80%83.png",
      expect.objectContaining({
        method: "POST",
        body: file,
        headers: { "content-type": "image/png" },
      }),
    );
    expect(imageAssetContentUrl("session/1", "asset/1")).toBe(
      "/api/v1/sessions/session%2F1/assets/asset%2F1/content",
    );
  });

  it("manages User style entries and their reference images", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "界面 参考.png", {
      type: "image/png",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ styles: [{ id: "style-1" }] }))
      .mockResolvedValueOnce(Response.json({
        id: "style-1",
        creatorType: "user",
        revision: 1,
      }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ id: "style-1", revision: 2 }))
      .mockResolvedValueOnce(Response.json({ id: "style-1", revision: 3 }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ id: "style-1", revision: 4 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const fetcher = fetchMock as typeof fetch;

    await expect(listStyles(fetcher)).resolves.toEqual([{ id: "style-1" }]);
    await createUserStyle({
      name: "Quiet UI",
      category: "ui",
      description: "Large spacing and restrained surfaces.",
    }, fetcher);
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({
      name: "Quiet UI",
      category: "ui",
      description: "Large spacing and restrained surfaces.",
    });

    await updateStyle("style/1", {
      expectedRevision: 1,
      description: "Large spacing, restrained surfaces, and strong alignment.",
    }, fetcher);
    await uploadStyleReference("style/1", file, 2, fetcher);
    expect(fetchMock.mock.calls[3]).toEqual([
      "/api/v1/styles/style%2F1/references?filename=%E7%95%8C%E9%9D%A2%20%E5%8F%82%E8%80%83.png&expectedRevision=2",
      expect.objectContaining({
        method: "POST",
        body: file,
        headers: { "content-type": "image/png" },
      }),
    ]);

    await deleteStyleReference("style/1", "reference/1", 3, fetcher);
    await expect(deleteStyle("style/1", 4, fetcher)).resolves.toBeUndefined();
    expect(styleReferenceContentUrl("style/1", "reference/1")).toBe(
      "/api/v1/styles/style%2F1/references/reference%2F1/content",
    );
  });
});
