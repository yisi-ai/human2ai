interface SaveFilePickerWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle>;
}

export async function saveImageFile(file: File): Promise<void> {
  const browser = window as SaveFilePickerWindow;
  if (browser.showSaveFilePicker) {
    let handle: FileSystemFileHandle;
    try {
      // Invoke directly from the click, before any asynchronous work loses activation.
      handle = await browser.showSaveFilePicker({
        suggestedName: file.name,
        types: [{ accept: { [file.type]: [file.name.slice(file.name.lastIndexOf("."))] } }],
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      throw error;
    }
    const writable = await handle.createWritable();
    try {
      await writable.write(file);
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => undefined);
      throw error;
    }
    return;
  }

  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
