import type { Meta, StoryObj } from "@storybook/react-webpack5";

import { assertStorySelector } from "../vendor/yisiui/storybook/interactionChecks";
import { CanvasImage } from "./CanvasImage";
import { CanvasNode } from "./CanvasNode";
import { CanvasScene } from "./CanvasScene";

import "./CanvasElements.stories.css";

const FIXTURE_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%23dce9ff'/%3E%3Ccircle cx='180' cy='180' r='90' fill='%239dc5ff'/%3E%3Crect x='320' y='90' width='210' height='180' rx='24' fill='%23fff1c2'/%3E%3C/svg%3E";

function ImageStory({
  status = "ready",
  crop,
}: {
  status?: "empty" | "ready" | "loading" | "error";
  crop?: { x: number; y: number; width: number; height: number };
}) {
  return (
    <main className="human2ai-canvas-story">
      <div className="human2ai-canvas-story__stage human2ai-canvas-story__stage--compact">
        <CanvasScene bounds={{ x: -320, y: -180, width: 640, height: 360 }} aria-label="图片组件场景">
          <CanvasNode
            id="image"
            label="本地图片"
            selected
            bounds={{ x: -210, y: -118, width: 420, height: 236 }}
            onResize={() => undefined}
            onRotate={() => undefined}
          >
            <CanvasImage
              src={FIXTURE_IMAGE}
              alt="本地图片预览"
              width={420}
              height={236}
              fit="contain"
              status={status}
              crop={crop}
            />
          </CanvasNode>
        </CanvasScene>
      </div>
    </main>
  );
}

const meta = {
  id: "human2ai-canvas-image",
  title: "human2ai/Canvas/Elements/Image",
  component: CanvasImage,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CanvasImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LocalAsset: Story = {
  name: "本地资源显示",
  args: { src: FIXTURE_IMAGE, alt: "本地图片预览", width: 420, height: 236 },
  render: () => <ImageStory />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, ".human2ai-canvas-image__content");
    const image = canvasElement.querySelector<SVGImageElement>(".human2ai-canvas-image__content");
    if (!image) throw new Error("CanvasImage story is missing its image");
    if (image.getAttribute("preserveAspectRatio") !== "xMidYMid meet") {
      throw new Error("CanvasImage did not preserve contain fitting");
    }
    const node = canvasElement.querySelector<SVGGElement>('[data-canvas-node="image"]');
    if (
      node?.querySelectorAll("[data-resize-handle]").length !== 8 ||
      !node.querySelector("[data-rotation-handle]")
    ) {
      throw new Error("CanvasImage must support eight-way resizing and optional rotation");
    }
  },
};

export const LoadingState: Story = {
  name: "加载中",
  args: { src: FIXTURE_IMAGE, alt: "本地图片预览", width: 420, height: 236 },
  render: () => <ImageStory status="loading" />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-image-status="loading"]');
  },
};

export const ErrorState: Story = {
  name: "加载失败",
  args: { src: FIXTURE_IMAGE, alt: "本地图片预览", width: 420, height: 236 },
  render: () => <ImageStory status="error" />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-image-status="error"]');
  },
};

export const EmptyState: Story = {
  name: "未上传图片",
  args: { alt: "图片节点", width: 420, height: 236 },
  render: () => <ImageStory status="empty" />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-image-status="empty"]');
  },
};

export const CroppedImage: Story = {
  name: "裁剪后的图片",
  args: { src: FIXTURE_IMAGE, alt: "裁剪图片", width: 420, height: 236 },
  render: () => <ImageStory crop={{ x: 0.1, y: 0.2, width: 0.7, height: 0.6 }} />,
  play: async ({ canvasElement }) => {
    const image = canvasElement.querySelector<SVGImageElement>(
      ".human2ai-canvas-image__content",
    );
    if (!image || image.getAttribute("preserveAspectRatio") !== "none") {
      throw new Error("裁剪图片必须通过节点边界裁切归一化视窗");
    }
    assertStorySelector(canvasElement, "clipPath");
  },
};
