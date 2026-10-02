import { afterEach, expect, it, vi } from "vitest";
import { createStorageProtection } from "./storage-protection";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("serializes protection writes and releases only after an outstanding renewal completes", async () => {
  vi.stubGlobal("document", { removeEventListener: vi.fn() });
  const requests: RequestInit[] = [];
  let complete!: () => void;
  const pending = new Promise<void>(resolve => { complete = resolve; });
  const fetcher = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
    requests.push(options!);
    if (options?.method === "PUT") await pending;
    return new Response(null, { status: 204 });
  });
  const protection = createStorageProtection("session", () => ({ revisions: [4], assetIds: ["image"] }), fetcher);
  const renewal = protection.renew();
  await Promise.resolve(); await Promise.resolve();
  const closing = protection.close();
  expect(requests.map(request => request.method)).toEqual(["PUT"]);
  complete(); await renewal; await closing; await protection.renew();
  expect(requests.map(request => request.method)).toEqual(["PUT", "DELETE"]);
  expect(JSON.parse(requests[0].body as string)).toEqual({ revisions: [4], assetIds: ["image"] });
});

it("preserves expiration errors for the editor and renews from current history rather than a stale draft", async () => {
  let revision = 1;
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ code: "DRAFT_VERSION_EXPIRED", message: "Expired" }), { status: 410 }));
  const protection = createStorageProtection("session", () => ({ revisions: [revision], assetIds: [] }), fetcher);
  await expect(protection.renew()).rejects.toMatchObject({ code: "DRAFT_VERSION_EXPIRED", status: 410 });
  revision = 2;
  await expect(protection.renew()).rejects.toMatchObject({ status: 410 });
  expect(JSON.parse((fetcher.mock.calls[1] as unknown as [string, RequestInit])[1].body as string).revisions).toEqual([2]);
});

it("restarts after an effect cleanup and releases the old lease before publishing the restarted protection", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; }), methods: string[] = [];
  const fetcher = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
    methods.push(options!.method!);
    if (methods.length === 1) await pending;
    return new Response(null, { status: 204 });
  });
  const protection = createStorageProtection("session", () => ({ revisions: [1], assetIds: [] }), fetcher);
  protection.start();
  await Promise.resolve(); await Promise.resolve();
  const closing = protection.close(); protection.start();
  release(); await closing; await protection.renew();
  expect(methods).toEqual(["PUT", "DELETE", "PUT", "PUT"]);
  await protection.close();
  expect(methods.at(-1)).toBe("DELETE");
});
