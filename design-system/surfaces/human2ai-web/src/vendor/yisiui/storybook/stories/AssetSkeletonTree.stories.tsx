import type { Meta, StoryObj } from "@storybook/react-webpack5";
import type { TreeProps } from "antd";
import { useState, type ReactNode } from "react";

import { StatusBadge } from "@human2ai/ui/yisiui";
import {
  AssetSkeletonTree,
  assetSkeletonTreeCanDrop,
  assetSkeletonTreeRelativeDropPosition,
  type AssetSkeletonTreeNode,
} from "@human2ai/ui/yisiui";
import { assertStoryRole, assertStorySelector, assertStoryText } from "../interactionChecks";

const meta = {
  id: "modules-assetskeletontree",
  title: "yisiui-Modules/AssetSkeletonTree",
  component: AssetSkeletonTree,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AssetSkeletonTree>;
export default meta;
type Story = StoryObj<typeof meta>;

function TreeStoryFrame({ children }: { children: ReactNode }) {
  return <div className="yisi-asset-skeleton-tree-story-frame">{children}</div>;
}

const articleListNodes: AssetSkeletonTreeNode[] = [
  {
    key: "account:story-lab",
    parentKey: null,
    order: 0,
    nodeKind: "container",
    title: "故事实验室",
    description: "抖音",
  },
  {
    key: "article:city-walk",
    parentKey: "account:story-lab",
    order: 0,
    nodeKind: "content",
    title: "城市散步：从一条旧街开始的观察笔记",
    trailing: <StatusBadge label="3 版" tone="info" mode="text-only" />,
  },
  {
    key: "article:quiet-reading",
    parentKey: "account:story-lab",
    order: 1,
    nodeKind: "content",
    title: "安静阅读的下午",
    trailing: <StatusBadge label="1 版" mode="text-only" />,
  },
  {
    key: "article:material-notes",
    parentKey: "account:story-lab",
    order: 2,
    nodeKind: "content",
    title: "把资料整理成可写的线索",
    trailing: <StatusBadge label="0 版" mode="text-only" />,
  },
  {
    key: "account:field-notes",
    parentKey: null,
    order: 1,
    nodeKind: "container",
    title: "田野笔记",
  },
  {
    key: "article:night-market",
    parentKey: "account:field-notes",
    order: 0,
    nodeKind: "content",
    title: "夜市里的人情观察",
    trailing: <StatusBadge label="2 版" tone="info" mode="text-only" />,
  },
  {
    key: "article:small-objects",
    parentKey: "account:field-notes",
    order: 1,
    nodeKind: "content",
    title: "身边小物的来处",
    trailing: <StatusBadge label="1 版" mode="text-only" />,
  },
];

const longformSkeletonNodes: AssetSkeletonTreeNode[] = [
  {
    key: "part:opening",
    parentKey: null,
    order: 0,
    nodeKind: "container",
    title: "第一部 进入雾中",
    status: "ready",
  },
  {
    key: "unit:arrival",
    parentKey: "part:opening",
    order: 0,
    nodeKind: "content",
    title: "抵达河岸",
    status: "completed",
    hasDraft: true,
  },
  {
    key: "unit:lamp",
    parentKey: "part:opening",
    order: 1,
    nodeKind: "content",
    title: "桥头的灯",
    status: "drafted",
    hasDraft: true,
    openTodoCount: 2,
  },
  {
    key: "part:middle",
    parentKey: null,
    order: 1,
    nodeKind: "container",
    title: "第二部 旧地图",
    status: "planned",
  },
  {
    key: "unit:archive",
    parentKey: "part:middle",
    order: 0,
    nodeKind: "content",
    title: "档案室里的空白页",
    status: "review_needed",
    locked: true,
    lockedReason: "等待连续性复查",
  },
  {
    key: "unit:bridge",
    parentKey: "part:middle",
    order: 1,
    nodeKind: "content",
    title: "没有被记录的桥",
    status: "planned",
    openTodoCount: 1,
  },
  {
    key: "unit:folded-map",
    parentKey: "part:middle",
    order: 2,
    nodeKind: "content",
    title: "被折叠的地图与方向",
    status: "drafted",
    hasDraft: true,
  },
  {
    key: "unit:missing-train",
    parentKey: "part:middle",
    order: 3,
    nodeKind: "content",
    title: "没有抵达的末班车",
    status: "ready",
    isNew: true,
  },
  {
    key: "unit:deleted-note",
    parentKey: "part:middle",
    order: 4,
    nodeKind: "content",
    title: "已经删去的旧注释",
    status: "archived",
    isDeleted: true,
  },
  {
    key: "part:closing",
    parentKey: null,
    order: 2,
    nodeKind: "container",
    title: "第三部 回到岸上",
    status: "planned",
    isNew: true,
  },
  {
    key: "unit:shore",
    parentKey: "part:closing",
    order: 0,
    nodeKind: "content",
    title: "岸边的回声",
    status: "planned",
  },
  {
    key: "unit:rain",
    parentKey: "part:closing",
    order: 1,
    nodeKind: "content",
    title: "雨水留下的痕迹",
    status: "ready",
  },
  {
    key: "unit:signal",
    parentKey: "part:closing",
    order: 2,
    nodeKind: "content",
    title: "远处传来的信号",
    status: "drafted",
    hasDraft: true,
    isNew: true,
  },
  {
    key: "unit:deleted-book",
    parentKey: "part:closing",
    order: 3,
    nodeKind: "content",
    title: "被删除的书页",
    status: "archived",
    isDeleted: true,
  },
  {
    key: "unit:afterglow",
    parentKey: "part:closing",
    order: 4,
    nodeKind: "content",
    title: "天亮之前的余光",
    status: "completed",
    hasDraft: true,
  },
];

const longformSkeletonViewNodes = longformSkeletonNodes.filter((node) => !node.isDeleted);

function normalizeOrder(nodes: AssetSkeletonTreeNode[]): AssetSkeletonTreeNode[] {
  const grouped = new Map<string | null, AssetSkeletonTreeNode[]>();
  for (const node of nodes) {
    const siblings = grouped.get(node.parentKey) ?? [];
    siblings.push(node);
    grouped.set(node.parentKey, siblings);
  }
  for (const siblings of grouped.values()) {
    siblings.sort((left, right) => left.order - right.order || left.key.localeCompare(right.key));
  }

  const nextOrder = new Map<string, number>();
  for (const siblings of grouped.values()) {
    siblings.forEach((node, index) => nextOrder.set(node.key, index));
  }
  return nodes.map((node) => ({ ...node, order: nextOrder.get(node.key) ?? node.order }));
}

function canMoveNode(
  nodes: AssetSkeletonTreeNode[],
  info: Parameters<NonNullable<TreeProps["onDrop"]>>[0],
): boolean {
  return assetSkeletonTreeCanDrop(nodes, {
    dragNode: info.dragNode,
    dropNode: info.node,
    dropPosition: assetSkeletonTreeRelativeDropPosition(info),
  });
}

function moveNode(nodes: AssetSkeletonTreeNode[], info: Parameters<NonNullable<TreeProps["onDrop"]>>[0]): AssetSkeletonTreeNode[] {
  if (!canMoveNode(nodes, info)) {
    return nodes;
  }

  const dragKey = String(info.dragNode.key);
  const dropKey = String(info.node.key);

  const dragged = nodes.find((node) => node.key === dragKey);
  const target = nodes.find((node) => node.key === dropKey);
  if (!dragged || !target) {
    return nodes;
  }

  const descendants = new Set<string>();
  const queue = [dragged.key];
  while (queue.length) {
    const parentKey = queue.shift();
    if (!parentKey) {
      continue;
    }
    descendants.add(parentKey);
    for (const node of nodes) {
      if (node.parentKey === parentKey) {
        queue.push(node.key);
      }
    }
  }
  if (descendants.has(target.key)) {
    return nodes;
  }

  const nextParentKey = info.dropToGap ? target.parentKey : target.key;
  const dropPosition = assetSkeletonTreeRelativeDropPosition(info);
  const remaining = nodes.filter((node) => node.key !== dragged.key);
  const siblings = remaining
    .filter((node) => node.parentKey === nextParentKey)
    .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key));
  const targetIndex = siblings.findIndex((node) => node.key === target.key);
  const insertIndex = info.dropToGap && targetIndex >= 0
    ? targetIndex + (dropPosition > 0 ? 1 : 0)
    : siblings.length;
  siblings.splice(insertIndex, 0, { ...dragged, parentKey: nextParentKey });

  const orderByKey = new Map(siblings.map((node, index) => [node.key, index]));
  return normalizeOrder(
    remaining.map((node) =>
      orderByKey.has(node.key)
        ? { ...node, order: orderByKey.get(node.key) ?? node.order }
        : node,
    ).concat(
      orderByKey.has(dragged.key)
        ? [{ ...dragged, parentKey: nextParentKey, order: orderByKey.get(dragged.key) ?? insertIndex }]
        : [],
    ),
  );
}

function EditorFixture() {
  const [nodes, setNodes] = useState<AssetSkeletonTreeNode[]>(() =>
    longformSkeletonNodes.map((node) => ({
      ...node,
      isChanged: node.key === "unit:folded-map",
    })),
  );
  const [selectedKeys, setSelectedKeys] = useState<string[]>(["unit:lamp"]);

  const handleDrop: TreeProps["onDrop"] = (info) => {
    setNodes((current) => moveNode(current, info));
  };

  return (
    <TreeStoryFrame>
      <AssetSkeletonTree
        mode="edit"
        nodes={nodes}
        showStatus={false}
        selectedKeys={selectedKeys}
        defaultExpandAll
        onSelect={(keys) => setSelectedKeys(keys.map(String))}
        onDrop={handleDrop}
      />
    </TreeStoryFrame>
  );
}

export const ArticleList: Story = {
  name: "文章列表",
  render: () => (
    <TreeStoryFrame>
      <AssetSkeletonTree
        mode="view"
        nodes={articleListNodes}
        maxTitleLength={12}
        showContentOrder={false}
        showStatus={false}
        defaultExpandAll
        selectedKeys={["article:city-walk"]}
      />
    </TreeStoryFrame>
  ),
  play: ({ canvasElement }) => {
    assertStoryRole(canvasElement, "tree");
    assertStoryText(canvasElement, "城市散步：从一条旧街");
    assertStoryText(canvasElement, "抖音");
    assertStorySelector(canvasElement, ".yisi-asset-skeleton-tree-description");
  },
};

export const LongformSkeletonList: Story = {
  name: "长篇骨架列表",
  render: () => (
    <TreeStoryFrame>
      <AssetSkeletonTree
        mode="view"
        nodes={longformSkeletonViewNodes}
        currentKey="unit:lamp"
        maxTitleLength={18}
        showCurrent={false}
        defaultExpandAll
        selectedKeys={["unit:lamp"]}
      />
    </TreeStoryFrame>
  ),
  play: ({ canvasElement }) => {
    assertStoryRole(canvasElement, "tree");
    assertStoryText(canvasElement, "桥头的灯");
    assertStorySelector(
      canvasElement,
      '.yisi-asset-skeleton-tree-content-order [data-yisiui-asset="yisiui/status-badge"]',
    );
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="yisiui/status-badge"].yisi-status-badge-icon-only',
    );
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="yisiui/status-badge"].ant-tag-red',
    );
    assertStorySelector(canvasElement, ".yisi-asset-skeleton-tree-trailing-area");
  },
};

export const SkeletonEditor: Story = {
  name: "骨架编辑",
  render: () => <EditorFixture />,
  play: ({ canvasElement }) => {
    assertStoryRole(canvasElement, "tree");
    assertStorySelector(canvasElement, '[data-mode="edit"]');
    assertStorySelector(canvasElement, ".yisi-asset-skeleton-tree-item-locked");
    assertStorySelector(canvasElement, ".yisi-asset-skeleton-tree-item-changed");
    assertStoryText(canvasElement, "[new]");
    assertStoryText(canvasElement, "[del]");
    assertStoryText(canvasElement, "01");
    assertStoryText(canvasElement, "02");
    assertStorySelector(
      canvasElement,
      '.yisi-asset-skeleton-tree-content-order [data-yisiui-asset="yisiui/status-badge"]',
    );
    assertStorySelector(canvasElement, ".yisi-asset-skeleton-tree-content-order-empty");
    assertStorySelector(
      canvasElement,
      '.yisi-asset-skeleton-tree-item-new > .ant-tree-switcher .yisi-asset-skeleton-tree-content-order',
    );
  },
};
