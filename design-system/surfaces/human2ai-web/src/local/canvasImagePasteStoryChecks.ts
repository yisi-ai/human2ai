export async function uploadPastedStoryImage(file: File): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 80));
  if (file.name === "failure.png") throw new Error("Upload rejected by fixture");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function paste(target: Element, clipboardData: DataTransfer): ClipboardEvent {
  const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData });
  target.dispatchEvent(event);
  return event;
}

async function imageClipboard(name: string, color: string): Promise<DataTransfer> {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const context = canvas.getContext("2d")!;
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!)));
  const clipboard = new DataTransfer();
  clipboard.items.add(new File([blob], name, { type: "image/png" }));
  clipboard.setData("text/plain", "clipboard image");
  return clipboard;
}

async function waitFor(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error("Clipboard image interaction did not reach its expected state");
}

export async function checkCanvasImagePaste(canvasElement: HTMLElement, kind: "composition" | "ui-sketch") {
  const scene = canvasElement.querySelector<SVGSVGElement>(`[data-${kind}-scene]`)!;
  const imageSelector = `[data-${kind}-kind="image"]`;
  scene.focus();
  const text = new DataTransfer();
  text.setData("text/plain", "ordinary text");
  if (paste(scene, text).defaultPrevented) throw new Error("Canvas must leave text clipboard contents alone");

  const failed = await imageClipboard("failure.png", "#b33");
  paste(scene, failed);
  await waitFor(() => Boolean(document.querySelector(".ant-message-error")));
  if (canvasElement.querySelector(imageSelector)) throw new Error("Failed uploads must not leave image nodes");

  const first = await imageClipboard("first.png", "#369");
  if (!paste(document.body, first).defaultPrevented) throw new Error("Canvas must consume native body-targeted image paste while the SVG has focus");
  paste(scene, first);
  await waitFor(() => Boolean(canvasElement.querySelector(`${imageSelector} image`)));
  if (canvasElement.querySelectorAll(imageSelector).length !== 1) throw new Error("Pending paste must not create duplicate nodes");
  const node = canvasElement.querySelector<SVGGElement>(imageSelector)!;
  const bounds = node.querySelector<SVGRectElement>(".human2ai-canvas-image__boundary")!;
  if (Number(bounds.getAttribute("width")) !== 320 || Number(bounds.getAttribute("height")) !== 180) {
    throw new Error("Pasted image must preserve its source aspect ratio");
  }
  const originalSource = node.querySelector("image")!.getAttribute("href");
  const position = node.getAttribute("transform");
  node.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  await waitFor(() => Boolean(document.querySelector('[role="dialog"] [aria-label="备注"]')));
  const note = document.querySelector<HTMLTextAreaElement>('[role="dialog"] [aria-label="备注"]')!;
  if (paste(note, text).defaultPrevented) throw new Error("Image editor must preserve ordinary text paste");

  const replacement = await imageClipboard("replacement.png", "#693");
  note.focus();
  if (!paste(note, replacement).defaultPrevented) throw new Error("Image paste in the note field must reach the image editor");
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(note, "upload-time note");
  note.dispatchEvent(new Event("input", { bubbles: true }));
  await waitFor(() => canvasElement.querySelector(`${imageSelector} image`)?.getAttribute("href") !== originalSource);
  if (canvasElement.querySelectorAll(imageSelector).length !== 1 || node.getAttribute("transform") !== position) {
    throw new Error("Editor paste must replace the existing node without changing its position");
  }
  if (note.value !== "upload-time note") throw new Error("Uploading must preserve concurrent note edits");
}
