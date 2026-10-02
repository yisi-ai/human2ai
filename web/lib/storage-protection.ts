import type { StorageProtection } from "../../src/domain/session/storage";
import { Human2AiApiError } from "./human2ai-api";

/** Only the protection endpoint is updated; heartbeat receipts never publish React state. */
export function createStorageProtection(sessionId: string, read: () => StorageProtection, fetcher: typeof fetch = globalThis.fetch) {
  const url = `/api/v1/sessions/${encodeURIComponent(sessionId)}/storage-protection/${crypto.randomUUID()}`;
  let closed = false, work = Promise.resolve(), timer: ReturnType<typeof setInterval> | undefined;
  const renew = () => {
    const next = work.catch(() => undefined).then(async () => {
      if (closed) return;
      const response = await fetcher(url, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(read()) });
      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { code?: string; message?: string };
        throw new Human2AiApiError(error.code ?? `HTTP_${response.status}`, error.message ?? response.statusText, response.status, error);
      }
    });
    work = next; return next;
  };
  const refresh = () => { void renew().catch(() => undefined); };
  const visible = () => { if (!document.hidden) refresh(); };
  return {
    renew,
    start() {
      if (timer) return;
      closed = false;
      refresh(); timer = setInterval(refresh, 30_000);
      document.addEventListener("visibilitychange", visible);
    },
    async close() {
      if (closed) { await work.catch(() => undefined); return; }
      closed = true; if (timer) clearInterval(timer);
      timer = undefined;
      document.removeEventListener("visibilitychange", visible);
      const release = work.catch(() => undefined).then(async () => {
        await fetcher(url, { method: "DELETE", keepalive: true }).catch(() => undefined);
      });
      work = release;
      await release;
    },
  };
}
