import { afterEach, expect, it, vi } from "vitest";
import { materializeDroppedSessionPreview } from "./session-preview-drop";

afterEach(() => vi.unstubAllGlobals());

it.each(["ui-layout", "image-composition", "spatial"])("uses the first saved output of a dropped %s session", async sessionType => {
  const preview = { assetId: "preview", width: 320, height: 180 };
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ sources: [{ session: { id: "source", sessionType }, outputs: [{ id: "first" }, { id: "second" }] }] })))
    .mockResolvedValueOnce(new Response(JSON.stringify(preview)));
  vi.stubGlobal("fetch", fetch);
  expect(await materializeDroppedSessionPreview("target", "source")).toEqual(preview);
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/sessions/target/preview-sources");
  expect(fetch.mock.calls[1][0]).toBe("/api/v1/sessions/target/previews");
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ sessionId: "source", sessionType, [sessionType === "spatial" ? "cameraId" : "stateId"]: "first" });
});

it.each([{ sources: [] }, { sources: [{ session: { id: "source", sessionType: "ui-layout" }, outputs: [] }] }])("does not materialize missing, ineligible or unsaved sources", async ({ sources }) => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ sources })));
  vi.stubGlobal("fetch", fetch);
  await expect(materializeDroppedSessionPreview("target", "source")).rejects.toThrow("SESSION_PREVIEW_UNAVAILABLE");
  expect(fetch).toHaveBeenCalledTimes(1);
});
