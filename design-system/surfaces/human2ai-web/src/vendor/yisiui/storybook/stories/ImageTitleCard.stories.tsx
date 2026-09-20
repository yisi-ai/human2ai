import type { Meta, StoryObj } from "@storybook/react-webpack5";

import { ImageTitleCard } from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

const LANDSCAPE_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#dcecff"/>
        <stop offset="1" stop-color="#f8e9c8"/>
      </linearGradient>
      <linearGradient id="mountain" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#8099a4"/>
        <stop offset="1" stop-color="#314f5a"/>
      </linearGradient>
    </defs>
    <rect width="800" height="500" fill="url(#sky)"/>
    <circle cx="640" cy="105" r="54" fill="#fff7d2" opacity=".9"/>
    <path d="M0 390 190 165 360 365 505 210 800 410V500H0Z" fill="url(#mountain)"/>
    <path d="M0 430 240 285 410 420 595 305 800 430V500H0Z" fill="#587767"/>
    <path d="m146 218 44-53 48 64-34-17-17 14-18-9Z" fill="#f7fbff" opacity=".92"/>
    <path d="m470 260 35-50 54 75-36-19-19 13-16-13Z" fill="#f7fbff" opacity=".9"/>
  </svg>
`)}`;

const FOREST_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    <rect width="800" height="500" fill="#dce8df"/>
    <circle cx="150" cy="110" r="62" fill="#fff6cc"/>
    <path d="M0 360 180 170l120 160 140-200 180 230 180-170v310H0Z" fill="#345d4b"/>
    <path d="M0 410 210 245l150 150 170-135 270 170v70H0Z" fill="#6f8d68"/>
  </svg>
`)}`;

const LAKE_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    <rect width="800" height="500" fill="#d8e9ef"/>
    <path d="M0 300 180 125l155 180 150-140 175 155 140-105v285H0Z" fill="#536d7a"/>
    <rect y="330" width="800" height="170" fill="#7ca8ae"/>
    <path d="M0 390c150-45 270 35 420-5s250 25 380-5v120H0Z" fill="#afc9c8" opacity=".8"/>
  </svg>
`)}`;

const meta = {
  id: "cards-imagetitlecard",
  title: "yisiui-Components/Cards/ImageTitleCard",
  component: ImageTitleCard,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 267 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    images: { control: false, description: "由消费方提供的一张或多张图片；多图按数量轻度扇形排列，每张图片自行提供可访问替代文本。" },
    title: { control: "text", description: "位于图片区下方的标题内容。" },
    aspectRatio: { control: "text", description: "图片展示区比例，默认 3 / 2。" },
    className: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof ImageTitleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "默认图片标题卡片",
  args: {
    images: [
      <img alt="林间晨光" key="forest" src={FOREST_IMAGE} />,
      <img alt="湖面与远山" key="lake" src={LAKE_IMAGE} />,
      <img alt="晨光照亮层叠的山谷" key="valley" src={LANDSCAPE_IMAGE} />,
    ],
    title: "山谷里的清晨",
  },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/image-title-card"]');
    assertStorySelector(canvasElement, '[data-image-count="3"]');
    assertStorySelector(canvasElement, 'img[alt="晨光照亮层叠的山谷"]');
    assertStoryText(canvasElement, "山谷里的清晨");
    const media = canvasElement.querySelector<HTMLElement>(".yisi-image-title-card-media");
    const imageFrame = canvasElement.querySelector<HTMLElement>(".yisi-image-title-card-image");
    const image = canvasElement.querySelector<HTMLImageElement>('img[alt="晨光照亮层叠的山谷"]');
    const title = canvasElement.querySelector<HTMLElement>(".yisi-image-title-card-title");
    if (getComputedStyle(image as Element).objectFit !== "contain") {
      throw new Error("ImageTitleCard must display the complete image without cover cropping.");
    }
    if (getComputedStyle(media as Element).overflow !== "visible") {
      throw new Error("ImageTitleCard must not clip the sides of the image fan.");
    }
    if (getComputedStyle(media as Element).backgroundColor !== "rgba(0, 0, 0, 0)") {
      throw new Error("ImageTitleCard media must not add a light background.");
    }
    if (getComputedStyle(title as Element).backgroundImage !== "none") {
      throw new Error("ImageTitleCard title must not add a light background.");
    }
    const imageFrameStyle = getComputedStyle(imageFrame as Element);
    const imageMask =
      imageFrameStyle.getPropertyValue("mask-image") ||
      imageFrameStyle.getPropertyValue("-webkit-mask-image");
    if (!imageMask.includes("linear-gradient")) {
      throw new Error("ImageTitleCard must fade the image itself to transparency above the title.");
    }
  },
};

export const LongTitle: Story = {
  name: "长标题边界",
  args: {
    images: [
      <img alt="林间晨光" key="forest" src={FOREST_IMAGE} />,
      <img alt="晨光下的山谷与远山" key="valley" src={LANDSCAPE_IMAGE} />,
    ],
    title: "穿过晨雾后看见远处层叠山脉与被第一束阳光照亮的河谷",
  },
  play: ({ canvasElement }) => {
    assertStorySelector(canvasElement, ".yisi-image-title-card-title");
    assertStoryText(canvasElement, "穿过晨雾后看见远处层叠山脉");
  },
};

export const SingleImage: Story = {
  name: "单张图片",
  args: {
    images: <img alt="单张山谷风景" src={LANDSCAPE_IMAGE} />,
    title: "只有一张图片",
  },
  play: ({ canvasElement }) => {
    const media = canvasElement.querySelector<HTMLElement>("[data-image-count='1']");
    if (!media || media.querySelectorAll(".yisi-image-title-card-image").length !== 1) {
      throw new Error("ImageTitleCard should render one full-width image without fan siblings.");
    }
  },
};
