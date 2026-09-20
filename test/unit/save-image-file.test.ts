import { afterEach, describe, expect, it, vi } from "vitest";

import { saveImageFile } from "../../design-system/surfaces/human2ai-web/src/local/saveImageFile.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("image file download", () => {
  const file = new File([new Uint8Array([0, 128, 255])], "image.webp", { type: "image/webp" });

  function picker() {
    const writable = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined), abort: vi.fn().mockResolvedValue(undefined) };
    const handle = { createWritable: vi.fn().mockResolvedValue(writable) };
    const showSaveFilePicker = vi.fn().mockResolvedValue(handle);
    vi.stubGlobal("window", { showSaveFilePicker });
    return { writable, handle, showSaveFilePicker };
  }

  it("opens the picker synchronously and writes the original file to the chosen destination", async () => {
    const { writable, showSaveFilePicker } = picker();
    const saving = saveImageFile(file);
    expect(showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: "image.webp",
      types: [{ accept: { "image/webp": [".webp"] } }],
    });
    await saving;
    expect(writable.write).toHaveBeenCalledWith(file);
    expect(writable.close).toHaveBeenCalledOnce();
    expect(writable.abort).not.toHaveBeenCalled();
  });

  it("treats picker cancellation as a no-op without a fallback download", async () => {
    const { handle, showSaveFilePicker } = picker();
    showSaveFilePicker.mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    const createObjectURL = vi.spyOn(URL, "createObjectURL");
    await expect(saveImageFile(file)).resolves.toBeUndefined();
    expect(handle.createWritable).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("reports a blocked picker instead of silently downloading elsewhere", async () => {
    const { showSaveFilePicker } = picker();
    const error = new DOMException("Blocked", "SecurityError");
    showSaveFilePicker.mockRejectedValue(error);
    await expect(saveImageFile(file)).rejects.toBe(error);
  });

  it("aborts a failed write without committing partial bytes", async () => {
    const { writable } = picker();
    const error = new DOMException("Write failed", "AbortError");
    writable.write.mockRejectedValue(error);
    await expect(saveImageFile(file)).rejects.toBe(error);
    expect(writable.abort).toHaveBeenCalledOnce();
    expect(writable.close).not.toHaveBeenCalled();
  });

  it("reports permission failures while opening the chosen file", async () => {
    const { handle } = picker();
    handle.createWritable.mockRejectedValue(new Error("Permission denied"));
    await expect(saveImageFile(file)).rejects.toThrow("Permission denied");
  });

  it("falls back to a blob download and releases the URL after the browser can consume it", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout });
    const anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    const append = vi.fn();
    vi.stubGlobal("document", { body: { append }, createElement: vi.fn(() => anchor) });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:image");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    await saveImageFile(file);
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(anchor.href).toBe("blob:image");
    expect(anchor.download).toBe("image.webp");
    expect(append).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:image");
  });
});
