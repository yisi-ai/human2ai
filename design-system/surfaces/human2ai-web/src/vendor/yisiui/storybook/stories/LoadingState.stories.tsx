import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Profiler, useRef } from "react";

import { LoadingState, type LoadingStateProps } from "@human2ai/ui/yisiui";
import { assertStorySelector, assertStoryText } from "../interactionChecks";

function LoadingExample(args: LoadingStateProps) {
  const host = useRef<HTMLDivElement>(null);
  const commits = useRef(0);
  return <div ref={host} data-loading-fixture style={{ height: 480, minHeight: 120, width: 720, maxWidth: "100%", resize: "both", overflow: "hidden" }}>
    <Profiler id="loading-state" onRender={() => {
      if (host.current) host.current.dataset.commits = String(++commits.current);
    }}>
      <LoadingState {...args} />
    </Profiler>
  </div>;
}

// Real browser geometry is required: jsdom cannot catch table-cell width collapse.
async function checkLoadingLayout(canvas: HTMLElement) {
  const host = canvas.querySelector<HTMLElement>("[data-loading-fixture]")!;
  const region = host.querySelector<HTMLElement>(".yisi-loading-state")!;
  const skeleton = host.querySelector<HTMLElement>(".yisi-loading-state-skeleton")!;
  const image = region.dataset.variant === "image";
  const auto = region.dataset.rows === "auto" && !image;
  const selector = image ? ".ant-skeleton-image" : ".ant-skeleton-title, .ant-skeleton-paragraph > li";
  const initialNodes = Array.from(skeleton.querySelectorAll<HTMLElement>(selector));
  const originalStyle = host.style.cssText;
  const samples: unknown[] = [];
  const settle = () => new Promise(resolve => setTimeout(resolve, 150));
  function measure() {
    const bounds = skeleton.getBoundingClientRect();
    const nodes = Array.from(skeleton.querySelectorAll<HTMLElement>(selector));
    if (nodes.length === 0) throw new Error("LoadingState 缺少骨架");
    const sizes = nodes.map(node => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) throw new Error("LoadingState 骨架实际宽高必须大于零");
      if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1) {
        throw new Error("LoadingState 骨架溢出可用区域");
      }
      return { width: rect.width, height: rect.height };
    });
    if (region.scrollWidth > region.clientWidth || region.scrollHeight > region.clientHeight) {
      throw new Error("LoadingState 容器溢出");
    }
    const rows = skeleton.querySelectorAll(".ant-skeleton-paragraph > li").length;
    if (auto) {
      const title = nodes[0];
      const style = getComputedStyle(skeleton);
      const line = parseFloat(style.getPropertyValue("--yisiui-loading-state-line-height"));
      const gap = parseFloat(style.getPropertyValue("--yisiui-loading-state-line-gap"));
      const titleSpace = title.getBoundingClientRect().height + parseFloat(getComputedStyle(title).marginBottom);
      if (rows !== Math.max(0, Math.floor((bounds.height - titleSpace + gap) / (line + gap)))) {
        throw new Error("LoadingState 行数未随可用高度调整");
      }
    } else if (!image && rows !== initialNodes.length - 1) {
      throw new Error("LoadingState 显式行数不应随容器变化");
    }
    if (nodes[0] !== initialNodes[0] || (!image && nodes[1] !== initialNodes[1])) {
      throw new Error("LoadingState 缩放不应重建已有节点");
    }
    if (region.dataset.motion === "none" || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (nodes.some(node => getComputedStyle(node).animationName !== "none")) throw new Error("LoadingState 减少动效未生效");
    }
    return { width: bounds.width, height: bounds.height, rows, sizes };
  }
  try {
    await settle();
    samples.push(measure());
    // Fixed rows need enough vertical room; auto/image also exercise short and tall hosts.
    for (const [width, height] of [[320, auto || image ? 240 : 520], [960, 720], [240, auto || image ? 144 : 520], [720, 480]]) {
      host.style.width = `${width}px`;
      host.style.height = `${height}px`;
      await settle();
      samples.push(measure());
    }
    const before = JSON.stringify(measure());
    const commits = host.dataset.commits;
    let mutations = 0;
    const observer = new MutationObserver(records => { mutations += records.length; });
    observer.observe(region, { attributes: true, childList: true, characterData: true, subtree: true });
    try { await settle(); await settle(); } finally { observer.disconnect(); }
    if (mutations !== 0 || commits !== host.dataset.commits || before !== JSON.stringify(measure())) {
      throw new Error("LoadingState 尺寸稳定后仍持续更新");
    }
    host.dataset.verification = JSON.stringify({ samples, idleMs: 300, idleMutations: mutations, idleCommits: commits === undefined ? null : 0 });
  } finally {
    host.style.cssText = originalStyle;
  }
}

const meta = {
  id: "components-states-loadingstate",
  title: "yisiui-Components/States/LoadingState",
  component: LoadingState,
  render: (args) => <LoadingExample {...args} />,
  parameters: { layout: "padded" },
  argTypes: {
    label: { control: "text" },
    variant: { control: "radio", options: ["text", "image"] },
    rows: { control: { type: "number", min: 1, max: 12, step: 1 } },
    compact: { control: "boolean" },
    motion: { control: "radio", options: ["auto", "none"] },
    className: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof LoadingState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "自适应文字加载",
  args: {
    label: "正在加载内容",
  },
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/loading-state"]');
    assertStorySelector(canvasElement, '[aria-busy="true"][aria-label="正在加载内容"]');
    assertStoryText(canvasElement, "正在加载内容");
    assertStorySelector(canvasElement, '[data-rows="auto"]');
    await checkLoadingLayout(canvasElement);
  },
};

export const Compact: Story = {
  name: "紧凑文字加载",
  args: {
    label: "正在加载面板",
    compact: true,
  },
  play: async ({ canvasElement }) => { await checkLoadingLayout(canvasElement); },
};

export const ReducedMotion: Story = {
  name: "关闭动效",
  args: {
    label: "正在加载静态内容",
    rows: 4,
    motion: "none",
  },
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-motion="none"]');
    if (canvasElement.querySelector(".ant-skeleton-active")) {
      throw new Error("motion=none 时不应启用 Skeleton 动画");
    }
    await checkLoadingLayout(canvasElement);
  },
};

export const RowBoundary: Story = {
  name: "显式行数边界",
  args: {
    label: "正在加载边界示例",
    rows: 99,
  },
  play: async ({ canvasElement }) => {
    if (canvasElement.querySelectorAll(".ant-skeleton-paragraph > li").length !== 12) {
      throw new Error("LoadingState 应把骨架行数限制在十二行以内");
    }
    await checkLoadingLayout(canvasElement);
  },
};

export const Image: Story = {
  name: "图像加载",
  args: {
    label: "正在加载图像",
    variant: "image",
  },
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-variant="image"] .ant-skeleton-image');
    assertStoryText(canvasElement, "正在加载图像");
    await checkLoadingLayout(canvasElement);
  },
};
