import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";

import type { Human2AiCanvasImageCrop } from "../../../../../src/domain/canvas-node-metadata";
import { assertStorySelector } from "../vendor/yisiui/storybook/interactionChecks";
import {
  CanvasImageEditorFields,
  type CanvasImageEditorFieldsProps,
} from "./CanvasImageEditorFields";

const FIXTURE_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%23dce9ff'/%3E%3Ccircle cx='180' cy='180' r='90' fill='%239dc5ff'/%3E%3Crect x='320' y='90' width='210' height='180' rx='24' fill='%23fff1c2'/%3E%3C/svg%3E";

const labels = {
  content: "图片内容",
  upload: "上传图片",
  download: "下载图片",
  downloading: "正在下载",
  downloadFailed: "图片下载失败，请重试。",
  replace: "替换图片",
  uploading: "正在上传",
  uploadFailed: "图片上传失败，请重试。",
  fileTypes: "支持 PNG、JPEG、WebP、SVG，最大 10 MB。",
  cropTitle: "裁剪图片",
  cropLoadFailed: "无法加载图片，请重新上传。",
  svgSource: "SVG 源码",
  svgPaste: "粘贴 SVG",
  svgApply: "使用 SVG",
  svgSaveFailed: "SVG 保存失败，请检查代码后重试。",
  svgCopy: "复制源码",
  svgCopying: "正在复制源码",
  svgCopyFailed: "源码复制失败",
  sourceLoading: "正在读取图片内容",
  sourceLoadFailed: "图片内容读取失败，请重试。",
  svgCopied: "已复制",
  cancel: "取消",
  retry: "重试",
};

function ControlledFields(props: CanvasImageEditorFieldsProps) {
  const [crop, setCrop] = useState<Human2AiCanvasImageCrop | null>(props.crop);
  const [src, setSrc] = useState(props.src);
  const [uploadedSource, setUploadedSource] = useState("");
  const [reportedAspectRatio, setReportedAspectRatio] = useState<number | null>(null);
  return (
    <div
      data-crop-x={crop?.x ?? "none"}
      data-crop-width={crop?.width ?? "none"}
      data-crop-height={crop?.height ?? "none"}
      data-crop-aspect-ratio={reportedAspectRatio ?? "none"}
      data-uploaded-source={uploadedSource}
    >
      <CanvasImageEditorFields
        {...props}
        src={src}
        crop={crop}
        onUpload={async (file) => {
          await props.onUpload(file);
          const source = await file.text();
          setUploadedSource(source);
          setSrc(`data:image/svg+xml,${encodeURIComponent(source)}`);
        }}
        onCropChange={(nextCrop, aspectRatio) => {
          setCrop(nextCrop);
          setReportedAspectRatio(aspectRatio);
        }}
      />
    </div>
  );
}

const meta = {
  id: "human2ai-canvas-image-editor-fields",
  title: "human2ai/Canvas/Editors/CanvasImageEditorFields",
  component: CanvasImageEditorFields,
  args: {
    crop: null,
    aspectRatio: 16 / 9,
    labels,
    onUpload: async () => undefined,
    onReadFile: async (src) => new File([await (await fetch(src)).blob()], "image.svg", { type: "image/svg+xml" }),
    onCropChange: () => undefined,
  },
  render: (args) => (
    <main style={{ width: 520, padding: 24 }}>
      <ControlledFields {...args} />
    </main>
  ),
} satisfies Meta<typeof CanvasImageEditorFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyNode: Story = {
  name: "未上传图片",
  play: async ({ canvasElement }) => {
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="human2ai/canvas-image-editor-fields"]',
    );
    assertStorySelector(canvasElement, 'input[type="file"][accept*="image/png"]');
    if (canvasElement.querySelector("[data-crop-selection]")) {
      throw new Error("没有图片时不应显示裁剪选择框");
    }
    if (findButtons(canvasElement, labels.download).length) throw new Error("空节点不应提供下载");
  },
};

export const UploadedImage: Story = {
  name: "已上传图片与内嵌裁剪框",
  args: {
    src: FIXTURE_IMAGE,
    aspectRatio: 1,
    crop: { x: 0.1, y: 0.1, width: 0.6, height: 0.4 },
  },
  play: async ({ canvasElement }) => {
    const selection = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>("[data-crop-selection]");
      if (!element) throw new Error("图片预览必须直接显示裁剪选择框");
      return element;
    });
    if (
      canvasElement.querySelector(".ant-slider")
      || canvasElement.ownerDocument.querySelector('[role="dialog"]')
      || findButtons(canvasElement, "裁剪").length > 0
    ) {
      throw new Error("内嵌裁剪不应再显示裁剪按钮、滑动条或二级对话框");
    }
    const harness = canvasElement.querySelector<HTMLElement>("[data-crop-x]");
    const initialX = harness?.dataset.cropX;
    selection.dispatchEvent(new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    }));
    await waitFor(() => {
      if (!harness || harness.dataset.cropX === initialX) {
        throw new Error("裁剪选择框没有响应键盘移动");
      }
      return harness.dataset.cropX;
    });
    if (selection.querySelectorAll("[data-crop-handle]").length !== 4) {
      throw new Error("裁剪选择框必须提供四个角点缩放手柄");
    }
    const preview = canvasElement.querySelector<HTMLElement>(
      ".human2ai-canvas-image-editor-fields__preview",
    );
    const handle = selection.querySelector<HTMLElement>(
      '[data-crop-handle="south-east"]',
    );
    if (!preview || !handle || !harness) {
      throw new Error("裁剪 Story 缺少自由缩放交互元素");
    }
    const initialWidth = Number(harness.dataset.cropWidth);
    const initialHeight = Number(harness.dataset.cropHeight);
    const handleBounds = handle.getBoundingClientRect();
    const previewBounds = preview.getBoundingClientRect();
    const clientX = handleBounds.left + handleBounds.width / 2;
    const clientY = handleBounds.top + handleBounds.height / 2;
    handle.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      clientX,
      clientY,
      pointerId: 9,
    }));
    preview.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      buttons: 1,
      clientX: clientX + previewBounds.width * 0.08,
      clientY,
      pointerId: 9,
    }));
    preview.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      clientX: clientX + previewBounds.width * 0.08,
      clientY,
      pointerId: 9,
    }));
    await waitFor(() => {
      const nextWidth = Number(harness.dataset.cropWidth);
      const nextHeight = Number(harness.dataset.cropHeight);
      if (nextWidth <= initialWidth || nextHeight !== initialHeight) {
        throw new Error("裁剪角点必须允许宽度独立于高度变化");
      }
      if (Number(harness.dataset.cropAspectRatio) <= 0) {
        throw new Error("裁剪变更必须回传源像素宽高比");
      }
      return nextWidth;
    });
    await assertImageDownload(canvasElement, decodeURIComponent(FIXTURE_IMAGE.split(",")[1]));
  },
};

const SVG_SOURCE = "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'><circle cx='180' cy='180' r='90' fill='#9dc5ff'/><rect x='320' y='90' width='210' height='180' rx='24' fill='#fff1c2'/></svg>";
const SVG_IMAGE = `data:image/svg+xml,${encodeURIComponent(SVG_SOURCE)}`;
const LONG_SVG_SOURCE = SVG_SOURCE.replace("</svg>", `${"<path d='M0 0L1 1'/>".repeat(500)}</svg>`);

export const SvgSource: Story = {
  name: "直接复制 SVG 源码",
  args: {
    src: SVG_IMAGE,
    onReadFile: async () => new File([SVG_SOURCE], "image.svg", { type: "image/svg+xml" }),
  },
  play: async ({ canvasElement }) => { await assertSourceCopy(canvasElement, SVG_SOURCE); },
};

export const PasteSvg: Story = {
  name: "粘贴 SVG 到空图片节点",
  play: async ({ canvasElement }) => {
    findButtons(canvasElement, labels.svgPaste)[0].click();
    const input = await waitFor(() => {
      const textarea = canvasElement.querySelector("textarea");
      if (!textarea) throw new Error("缺少 SVG 输入框");
      return textarea;
    });
    if (canvasElement.ownerDocument.activeElement !== input) throw new Error("SVG 输入应获得焦点");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, SVG_SOURCE);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await waitFor(() => {
      if (findButtons(canvasElement, labels.svgApply)[0].disabled) throw new Error("输入源码后应能保存");
    });
    findButtons(canvasElement, labels.svgApply)[0].click();
    await waitFor(() => {
      if (canvasElement.querySelector<HTMLElement>("[data-uploaded-source]")?.dataset.uploadedSource !== SVG_SOURCE) {
        throw new Error("SVG 输入没有进入图片上传流程");
      }
      if (canvasElement.querySelector("textarea")) throw new Error("保存成功后应关闭输入框");
    });
  },
};

export const SvgReadFailure: Story = {
  name: "SVG 源码读取失败与重试",
  args: {
    src: SVG_IMAGE,
    onReadFile: async () => { throw new Error("Read failed"); },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      if (!canvasElement.querySelector('[role="alert"]')?.textContent?.includes(labels.sourceLoadFailed)) {
        throw new Error("读取失败必须提供可见反馈");
      }
    });
    if (!findButtons(canvasElement, labels.retry)[0]) throw new Error("读取失败应允许重试");
    if (!findButtons(canvasElement, labels.download)[0]?.disabled) throw new Error("读取失败时禁止下载");
  },
};

export const SvgReadOnly: Story = {
  name: "只读图片仍可复制 SVG 源码",
  args: { src: SVG_IMAGE, disabled: true, onReadFile: async () => new File([SVG_SOURCE], "image.svg", { type: "image/svg+xml" }) },
  play: async ({ canvasElement }) => {
    await assertSourceCopy(canvasElement, SVG_SOURCE);
    await assertImageDownload(canvasElement, SVG_SOURCE);
    if (!findButtons(canvasElement, labels.svgPaste)[0].disabled) throw new Error("只读图片禁止替换源码");
  },
};

export const LongSvgSource: Story = {
  name: "完整复制长 SVG 源码",
  args: { src: SVG_IMAGE, onReadFile: async () => new File([LONG_SVG_SOURCE], "image.svg", { type: "image/svg+xml" }) },
  play: async ({ canvasElement }) => { await assertSourceCopy(canvasElement, LONG_SVG_SOURCE); },
};

async function assertSourceCopy(root: HTMLElement, source: string): Promise<void> {
  const copy = await waitFor(() => {
    const button = findButtons(root, labels.svgCopy)[0];
    if (!button || button.disabled) throw new Error("SVG 图片应直接提供可用的复制源码入口");
    return button;
  });
  const writeText = navigator.clipboard.writeText;
  let copied = "";
  navigator.clipboard.writeText = async (value) => { copied = value; };
  try {
    copy.click();
    await waitFor(() => {
      if (copied !== source) throw new Error("复制必须使用完整 SVG 源码");
    });
    if (root.querySelector("pre, textarea")) throw new Error("复制不应展开源码");
  } finally {
    navigator.clipboard.writeText = writeText;
  }
}

async function assertImageDownload(root: HTMLElement, source: string): Promise<void> {
  const button = await waitFor(() => {
    const download = findButtons(root, labels.download)[0];
    if (!download || download.disabled) throw new Error("图片就绪后必须能下载");
    return download;
  });
  const original = Object.getOwnPropertyDescriptor(window, "showSaveFilePicker");
  let mode: "save" | "cancel" | "fail" = "cancel";
  let saved = "";
  let closed = false;
  let requested = 0;
  Object.defineProperty(window, "showSaveFilePicker", {
    configurable: true,
    value: async () => {
      requested += 1;
      if (mode === "cancel") throw new DOMException("Cancelled", "AbortError");
      return { createWritable: async () => ({
        write: async (file: File) => {
          if (mode === "fail") throw new Error("Write failed");
          saved = await file.text();
        },
        close: async () => { closed = true; },
        abort: async () => undefined,
      }) };
    },
  });
  try {
    button.click();
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    await waitFor(() => {
      if (requested !== 1 || button.disabled) throw new Error("取消后应恢复下载入口");
      if (root.textContent?.includes(labels.downloadFailed)) throw new Error("取消不应报错");
    });
    mode = "fail";
    button.click();
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    await waitFor(() => {
      if (!root.querySelector('[role="alert"]')?.textContent?.includes(labels.downloadFailed)) {
        throw new Error("写入失败必须显示错误");
      }
    });
    mode = "save";
    button.click();
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    await waitFor(() => {
      if (saved !== source || !closed || button.disabled) throw new Error("重试应保存完整原文件并关闭写入");
      if (root.textContent?.includes(labels.downloadFailed)) throw new Error("重试成功应清除错误");
    });
  } finally {
    if (original) Object.defineProperty(window, "showSaveFilePicker", original);
    else Reflect.deleteProperty(window, "showSaveFilePicker");
  }
}

function findButtons(root: Document | HTMLElement, name: string): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>("button")]
    .filter((candidate) => candidate.textContent?.replace(/\s/g, "").includes(name.replace(/\s/g, "")));
}

async function waitFor<T>(read: () => T): Promise<T> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return read();
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    }
  }
  return read();
}
