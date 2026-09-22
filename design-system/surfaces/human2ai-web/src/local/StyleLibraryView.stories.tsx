import type { Meta, StoryContext, StoryObj } from "@storybook/react-webpack5";
import { useEffect, useState } from "react";

import type { StyleEntry } from "../../../../../src/domain/style";
import {
  assertStorySelector,
  assertStoryText,
} from "../vendor/yisiui/storybook/interactionChecks";
import {
  StyleLibraryView,
  type StyleLibraryDraft,
} from "./StyleLibraryView";

import { createBrickModelFixture } from "./styleModelFixture";

import { image, labels, fixtureStyles } from "./styleLibraryFixtures";

function Harness({
  initialStyles = fixtureStyles,
  loading = false,
  errorMessage = null,
}: {
  initialStyles?: StyleEntry[];
  loading?: boolean;
  errorMessage?: string | null;
}) {
  const [styles, setStyles] = useState(initialStyles);

  async function createStyle(draft: StyleLibraryDraft): Promise<StyleEntry> {
    const style: StyleEntry = {
      id: `style-${styles.length + 1}`,
      name: draft.name,
      category: draft.category,
      creatorType: "user",
      description: draft.description,
      promptSummary: draft.promptSummary,
      referenceImages: [],
      revision: 1,
      createdAt: "2026-09-03T12:00:00.000Z",
      updatedAt: "2026-09-03T12:00:00.000Z",
    };
    setStyles((current) => [style, ...current]);
    return style;
  }

  async function updateStyle(
    style: StyleEntry,
    draft: StyleLibraryDraft,
  ): Promise<StyleEntry> {
    const updated = {
      ...style,
      name: draft.name,
      category: draft.category,
      description: draft.description,
      promptSummary: draft.promptSummary,
      referenceImages: style.referenceImages.filter(
        (reference) => !draft.removedReferenceImageIds.includes(reference.id),
      ),
      revision: style.revision + 1,
    };
    setStyles((current) => current.map((item) => item.id === style.id ? updated : item));
    return updated;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--yisiui-color-surface-page)" }}>
      <StyleLibraryView
        styles={styles}
        labels={labels}
        loading={loading}
        errorMessage={errorMessage}
        imageUrl={() => image}
        onCreate={createStyle}
        onUpdate={updateStyle}
        onDelete={async (style) => {
          setStyles((current) => current.filter((item) => item.id !== style.id));
        }}
        onRetry={() => undefined}
      />
    </div>
  );
}

const meta = {
  id: "human2ai-style-library-view",
  title: "human2ai/StyleLibraryView",
  component: StyleLibraryView,
  parameters: { layout: "fullscreen" },
  args: {
    styles: fixtureStyles,
    labels,
    imageUrl: () => image,
    onCreate: async () => fixtureStyles[0],
    onUpdate: async (style) => style,
    onDelete: async () => undefined,
  },
} satisfies Meta<typeof StyleLibraryView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "风格合集与左右预览",
  render: () => <Harness />,
  play: async ({ canvasElement }: StoryContext) => {
    assertStorySelector(canvasElement, '[data-yisiui-asset="human2ai/style-library-view"]');
    assertStoryText(canvasElement, "低饱和电影感");
    assertStorySelector(canvasElement, '[data-yisiui-asset="yisiui/image-title-card"]');
    assertStorySelector(canvasElement, '[data-image-count="2"]');
    findButton(canvasElement, "打开“低饱和电影感”").click();
    await nextFrame();
    assertStoryText(canvasElement.ownerDocument.body, "参考");
    assertStoryText(canvasElement.ownerDocument.body, "设计规范");
    assertStoryText(canvasElement.ownerDocument.body, "User");
    assertStoryText(canvasElement.ownerDocument.body, "压低整体饱和度");
  },
};

export const NoReferenceImages: Story = {
  name: "无参考图",
  render: () => <Harness initialStyles={[fixtureStyles[1]]} />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-image-count="0"][data-empty="true"]');
    findButton(canvasElement, "打开“克制型工作台”").click();
    await nextFrame();
    assertStoryText(canvasElement.ownerDocument.body, "无参考图");
    assertStoryText(canvasElement.ownerDocument.body, "Agent");
  },
};

export const SingleReferenceImage: Story = {
  name: "单张参考图",
  render: () => <Harness initialStyles={[{
    ...fixtureStyles[0],
    referenceImages: fixtureStyles[0].referenceImages.slice(0, 1),
  }]} />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-image-count="1"]');
  },
};

export const ManyReferenceImages: Story = {
  name: "多张参考图",
  render: () => <Harness initialStyles={[{
    ...fixtureStyles[0],
    referenceImages: Array.from({ length: 4 }, (_, index) => ({
      ...fixtureStyles[0].referenceImages[0],
      id: `reference-${index + 1}`,
      position: index,
    })),
  }]} />,
  play: async ({ canvasElement }) => {
    assertStorySelector(canvasElement, '[data-image-count="3"]');
    findButton(canvasElement, "打开“低饱和电影感”").click();
    await nextFrame();
    const thumbnails = canvasElement.ownerDocument.querySelectorAll(
      ".human2ai-style-library__thumbnails button",
    );
    if (thumbnails.length !== 4) {
      throw new Error("The preview must retain every reference image");
    }
  },
};

export const Empty: Story = {
  name: "空风格库",
  render: () => <Harness initialStyles={[]} />,
  play: async ({ canvasElement }) => assertStoryText(canvasElement, "还没有风格"),
};

export const Loading: Story = {
  name: "加载中",
  render: () => <Harness loading />,
};

export const ErrorState: Story = {
  name: "加载失败",
  render: () => <Harness errorMessage="failed" />,
  play: async ({ canvasElement }) => {
    assertStoryText(canvasElement, "风格加载失败");
    findButton(canvasElement, "重试");
  },
};

export const DestructiveDelete: Story = {
  name: "删除确认",
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    findButton(canvasElement, "打开“低饱和电影感”").click();
    await nextFrame();
    findButton(canvasElement.ownerDocument.body, "删除").click();
    await nextFrame();
    assertStoryText(canvasElement.ownerDocument.body, "确认删除这个风格？");
    assertStoryText(canvasElement.ownerDocument.body, "该风格及其全部参考图和模型将被永久删除。");
  },
};

export const LongContent: Story = {
  name: "长说明",
  render: () => (
    <Harness initialStyles={[{
      ...fixtureStyles[0],
      name: "具有很长名称的画面风格，用来确认卡片与预览标题不会挤压操作",
      description: Array.from({ length: 12 }, () => fixtureStyles[0].description).join("\n\n"),
    }]} />
  ),
};

export const NarrowViewport: Story = {
  name: "窄视口",
  parameters: { viewport: { defaultViewport: "mobile1" } },
  render: () => <Harness />,
};

function findButton(root: ParentNode, label: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (item) => item.getAttribute("aria-label") === label || item.textContent?.trim() === label,
  );
  if (!button) throw new Error(`Missing button: ${label}`);
  return button;
}

async function nextFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function ModelHarness({ failed = false, images = true }: { failed?: boolean; images?: boolean }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string;
    void (failed ? Promise.resolve(new ArrayBuffer(4)) : createBrickModelFixture()).then((data) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(new Blob([data], { type: "model/gltf-binary" }));
      setUrl(objectUrl);
    });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [failed]);
  const style: StyleEntry = {
    ...fixtureStyles[2], id: "brick-example", name: "积木微缩",
    description: "以统一模数的砖块、薄板和圆柱件构建微缩模型。保留清晰拼缝与适量凸点，使用带轻微圆角和柔和高光的硬质塑料材质。奶油白墙体、陶土色屋顶和蓝绿色门窗，整体轮廓简洁，呈现桌面收藏模型质感。",
    promptSummary: "模块化积木、清晰拼缝与凸点，圆角塑料，克制配色。",
    referenceImages: images ? fixtureStyles[0].referenceImages : [],
    previewModel: { id: "brick-model", originalFilename: "brick-example.glb", byteSize: 1, createdAt: fixtureStyles[2].createdAt },
  };
  return url ? <StyleLibraryView styles={[style]} labels={labels} imageUrl={() => image} modelUrl={() => url} /> : <div role="status">{labels.model.loading}</div>;
}

export const ModelExample: Story = {
  name: "程序生成的积木模型",
  render: () => <ModelHarness images={false} />,
  play: async ({ canvasElement }) => {
    for (let attempt = 0; attempt < 300 && !canvasElement.querySelector("button"); attempt++) await nextFrame();
    findButton(canvasElement, "打开“积木微缩”").click();
    for (let attempt = 0; attempt < 300; attempt++) {
      await nextFrame();
      if (canvasElement.ownerDocument.querySelector('.human2ai-style-model-preview[data-state="ready"]')) return;
    }
    throw new Error("Generated model did not render");
  },
};

export const ModelFailure: Story = {
  name: "模型失败时仍可查看参考图",
  render: () => <ModelHarness failed />,
  play: async ({ canvasElement }) => {
    for (let attempt = 0; attempt < 300 && !canvasElement.querySelector("button"); attempt++) await nextFrame();
    findButton(canvasElement, "打开“积木微缩”").click();
    for (let attempt = 0; attempt < 300; attempt++) {
      await nextFrame();
      if (canvasElement.ownerDocument.querySelector('.human2ai-style-model-preview[data-state="error"]')) {
        assertStoryText(canvasElement.ownerDocument.body, labels.model.failed);
        return;
      }
    }
    throw new Error("Model failure did not surface");
  },
};
