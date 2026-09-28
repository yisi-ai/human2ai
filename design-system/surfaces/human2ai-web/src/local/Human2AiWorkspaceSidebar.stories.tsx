import type { Meta, StoryContext, StoryObj } from "@storybook/react-webpack5";
import { useState, type ReactNode } from "react";
import { waitFor } from "storybook/test";
import { ConfigProvider } from "antd";
import zh from "../../../../../locales/zh-CN/common.json";

import {
  assertStorySelector,
  assertStoryText,
} from "../vendor/yisiui/storybook/interactionChecks";
import {
  Human2AiWorkspaceSidebar,
  type Human2AiWorkspaceProject,
  type Human2AiWorkspaceSession,
  type Human2AiWorkspaceGroup,
  type Human2AiWorkspaceSidebarProps,
} from "./Human2AiWorkspaceSidebar";

import "./Human2AiWorkspaceSidebar.stories.css";

const repositoryLinkLabel = zh.app.repositoryLink.replace("{{productName}}", zh.app.title);

const projects: Human2AiWorkspaceProject[] = [
  { id: "brand", name: "品牌升级" },
  { id: "campaign", name: "夏季活动" },
  { id: "empty", name: "空项目" },
];

const sessions: Human2AiWorkspaceSession[] = [
  {
    id: "hero",
    projectId: "brand",
    sessionType: "image-composition",
    title: "首屏主视觉",
    revision: 1,
  },
  {
    id: "detail",
    projectId: "brand",
    sessionType: "ui-layout",
    title: "产品详情页",
    revision: 2,
  },
  {
    id: "poster",
    projectId: "campaign",
    sessionType: "image-composition",
    title: "活动海报",
    revision: 1,
  },
  {
    id: "idea",
    projectId: null,
    sessionType: "image-composition",
    title: "临时构图想法",
    revision: 1,
  },
];

function SidebarHarness({
  initialProjects = projects,
  initialSessions = sessions,
  initialGroups = [],
  languageSelector,
  repositoryLink,
}: {
  initialProjects?: Human2AiWorkspaceProject[];
  initialSessions?: Human2AiWorkspaceSession[];
  initialGroups?: Human2AiWorkspaceGroup[];
  languageSelector?: Human2AiWorkspaceSidebarProps["languageSelector"];
  repositoryLink?: Human2AiWorkspaceSidebarProps["repositoryLink"];
}) {
  const [nextProjects, setProjects] = useState(initialProjects);
  const [nextSessions, setSessions] = useState(initialSessions);
  const [groups, setGroups] = useState(initialGroups);
  const [currentSessionId, setCurrentSessionId] = useState("hero");

  function addToGroup(sessionId: string, groupId?: string): void {
    if (groupId) setGroups(current => current.map(group => group.id === groupId
      ? { ...group, sessionIds: [...group.sessionIds, sessionId] } : group));
  }

  return (
    <StoryFrame>
      <Human2AiWorkspaceSidebar
        projects={nextProjects}
        sessions={nextSessions}
        groups={groups}
        onCreateGroup={async (projectId, name) => setGroups(current => [...current, { id: `group-${current.length}`, projectId, name, sessionIds: [] }])}
        onRenameGroup={async (id, name) => setGroups(current => current.map(group => group.id === id ? { ...group, name } : group))}
        onDeleteGroup={async id => setGroups(current => current.filter(group => group.id !== id))}
        onGroupSession={async (sessionId, groupId) => setGroups(current => current.map(group => ({
          ...group, sessionIds: [...group.sessionIds.filter(id => id !== sessionId), ...(group.id === groupId ? [sessionId] : [])],
        })))}
        currentSessionId={currentSessionId}
        languageSelector={languageSelector}
        repositoryLink={repositoryLink}
        onCreateComposition={async (projectId, groupId) => {
          setSessions((current) => [
            {
              id: "new",
              projectId: projectId ?? null,
              sessionType: "image-composition",
              title: "未命名构图",
              revision: 1,
            },
            ...current,
          ]);
          setCurrentSessionId("new");
          addToGroup("new", groupId);
        }}
        onCreateUiSketch={async (projectId, groupId) => {
          setSessions((current) => [
            {
              id: "new-ui-sketch",
              projectId: projectId ?? null,
              sessionType: "ui-layout",
              title: "未命名 UI 界面",
              revision: 1,
            },
            ...current,
          ]);
          setCurrentSessionId("new-ui-sketch");
          addToGroup("new-ui-sketch", groupId);
        }}
        onCreateSpatial={async (projectId, groupId) => {
          setSessions(current => [{
            id: "new-spatial", projectId: projectId ?? null, sessionType: "spatial",
            title: zh.spatial.untitled, revision: 1,
          }, ...current]);
          setCurrentSessionId("new-spatial");
          addToGroup("new-spatial", groupId);
        }}
        onCreateProject={async (name) => {
          setProjects((current) => [{ id: `project-${current.length}`, name }, ...current]);
        }}
        onOpenStyleLibrary={() => undefined}
        onRenameProject={async (projectId, name) => {
          setProjects((current) =>
            current.map((project) =>
              project.id === projectId ? { ...project, name } : project,
            ),
          );
        }}
        onDeleteProject={async (projectId) => {
          setProjects((current) => current.filter((project) => project.id !== projectId));
        }}
        onOpenSession={setCurrentSessionId}
        onRenameSession={async (sessionId, title) => {
          setSessions((current) =>
            current.map((session) =>
              session.id === sessionId
                ? { ...session, title, revision: session.revision + 1 }
                : session,
            ),
          );
        }}
        onMoveSession={async (sessionId, projectId) => {
          setSessions((current) =>
            current.map((session) =>
              session.id === sessionId
                ? { ...session, projectId, revision: session.revision + 1 }
                : session,
            ),
          );
        }}
        onDeleteSession={async (sessionId) => {
          setSessions((current) => current.filter((session) => session.id !== sessionId));
        }}
      />
    </StoryFrame>
  );
}

function LanguageSelectorHarness() {
  const [language, setLanguage] = useState("zh-CN");

  return (
    <SidebarHarness
      repositoryLink={{ href: "https://github.com/yisi-ai/human2ai", label: repositoryLinkLabel }}
      languageSelector={{
        "aria-label": "界面语言",
        onChange: setLanguage,
        options: [
          { value: "zh-CN", label: "中文" },
          { value: "en", label: "EN" },
        ],
        placement: "top",
        value: language,
      }}
    />
  );
}

function StoryFrame({ children }: { children: ReactNode }) {
  return <div className="human2ai-workspace-sidebar-story-frame">{children}</div>;
}

const meta = {
  id: "human2ai-workspace-sidebar",
  title: "human2ai/Human2AiWorkspaceSidebar",
  component: Human2AiWorkspaceSidebar,
  parameters: { layout: "fullscreen" },
  args: {
    projects,
    sessions,
    onCreateComposition: async () => undefined,
    onCreateUiSketch: async () => undefined,
    onCreateProject: async () => undefined,
    onOpenStyleLibrary: () => undefined,
    onRenameProject: async () => undefined,
    onDeleteProject: async () => undefined,
    onOpenSession: () => undefined,
    onRenameSession: async () => undefined,
    onMoveSession: async () => undefined,
    onDeleteSession: async () => undefined,
  },
} satisfies Meta<typeof Human2AiWorkspaceSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "项目与会话",
  render: () => <SidebarHarness />,
  play: async ({ canvasElement }: StoryContext) => {
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="human2ai/workspace-sidebar"]',
    );
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="yisiui/asset-skeleton-tree"]',
    );
    assertStoryText(canvasElement, "首屏主视觉");
    assertStorySelector(canvasElement, '[data-session-type="image-composition"]');
    assertStorySelector(canvasElement, '[data-session-type="ui-layout"]');
    const containers = Array.from(
      canvasElement.querySelectorAll(".yisi-asset-skeleton-tree-node-container"),
    );
    if (!containers.at(-1)?.textContent?.includes("无项目")) {
      throw new Error("The unassigned project group must be last");
    }
    if (canvasElement.textContent?.includes("当前")) {
      throw new Error("The selected session must not render a current badge");
    }
    const tree = getRequiredElement(canvasElement, '[data-yisiui-asset="yisiui/asset-skeleton-tree"]');
    const preserved = getRequiredElement(canvasElement, '[data-session-tree-key="session:poster"]');
    getRequiredElement(canvasElement, '[data-session-tree-key="session:detail"]').click();
    await waitFor(() => {
      if (!getRequiredElement(canvasElement, '[data-session-tree-key="session:detail"]').closest(".ant-tree-treenode-selected")) {
        throw new Error("Session selection must update in place");
      }
    });
    findButton(canvasElement, "新建构图").click();
    await waitFor(() => assertStorySelector(canvasElement, '[data-session-tree-key="session:new"]'));
    findButton(canvasElement, "未命名构图：会话操作").click();
    await waitFor(() => findMenuItem(canvasElement.ownerDocument, "删除"));
    findMenuItem(canvasElement.ownerDocument, "删除").click();
    await waitFor(() => getRequiredElement(canvasElement.ownerDocument.body, ".ant-modal-footer"));
    findButton(getRequiredElement(canvasElement.ownerDocument.body, ".ant-modal-footer"), "删除").click();
    await waitFor(() => {
      if (canvasElement.querySelector('[data-session-tree-key="session:new"]')) throw new Error("Deleted session must leave the tree");
    });
    if (tree !== canvasElement.querySelector('[data-yisiui-asset="yisiui/asset-skeleton-tree"]')
      || preserved !== canvasElement.querySelector('[data-session-tree-key="session:poster"]')) {
      throw new Error("Selection, insertion and deletion must preserve the tree and unrelated rows");
    }
  },
};

export const SessionGroups: Story = {
  name: "项目分组与会话拖放",
  render: () => <ConfigProvider theme={{ token: { motion: false } }}><SidebarHarness initialGroups={[
    { id: "reference", projectId: "brand", name: "参考", sessionIds: [] },
    { id: "archive", projectId: "brand", name: "归档", sessionIds: ["detail"] },
  ]} /></ConfigProvider>,
  play: async ({ canvasElement }) => {
    const row = (title: string) => canvasElement.querySelector<HTMLElement>(`.yisi-asset-skeleton-tree-node[title="${title}"]`)?.closest<HTMLElement>(".ant-tree-treenode");
    const dialog = () => [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(node => node.getClientRects().length)!;
    const depth = (title: string) => row(title)?.querySelectorAll(".ant-tree-indent-unit").length;
    const drag = async (source: string, target: string) => {
      const from = row(source)!.querySelector<HTMLElement>(".human2ai-workspace-sidebar__tree-node")!;
      const to = row(target)!.querySelector<HTMLElement>(".human2ai-workspace-sidebar__tree-node")!;
      const box = to.getBoundingClientRect();
      const options = { bubbles: true, cancelable: true, dataTransfer: new DataTransfer(), clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
      from.dispatchEvent(new DragEvent("dragstart", options));
      to.dispatchEvent(new DragEvent("dragenter", options));
      to.dispatchEvent(new DragEvent("dragover", options));
      await nextFrame();
      to.dispatchEvent(new DragEvent("drop", options));
      from.dispatchEvent(new DragEvent("dragend", options));
      await nextFrame();
    };
    await waitFor(() => { if (!row("参考") || depth("产品详情页") !== 2) throw new Error("Empty and populated groups must be visible"); });
    if (!(row("参考")!.compareDocumentPosition(row("首屏主视觉")!) & Node.DOCUMENT_POSITION_FOLLOWING)) throw new Error("Groups must precede ungrouped sessions");
    findButton(canvasElement, "品牌升级：项目操作").click();
    await nextFrame();
    findMenuItem(document, zh.workspaceSidebar.newSessionGroup).click();
    await nextFrame();
    const input = document.querySelector<HTMLInputElement>(`input[aria-label="${zh.workspaceSidebar.sessionGroupName}"]`)!;
    setInputValue(input, "参考");
    await nextFrame();
    if (input.getAttribute("aria-invalid") !== "true") throw new Error("Duplicate group names must be rejected within the project");
    setInputValue(input, "待整理");
    await nextFrame();
    findButton(dialog(), "创建").click();
    await waitFor(() => { if (!row("待整理")) throw new Error("Creating a group must retain an empty row"); });
    findButton(canvasElement, "待整理：分组操作").click();
    await nextFrame();
    findMenuItem(document, "重命名").click();
    await nextFrame();
    setInputValue(document.querySelector<HTMLInputElement>(`input[aria-label="${zh.workspaceSidebar.sessionGroupName}"]`)!, "设计稿");
    await nextFrame();
    findButton(dialog(), "确认").click();
    await waitFor(() => { if (!row("设计稿")) throw new Error("Group rename must update its row"); });
    await drag("首屏主视觉", "夏季活动");
    if (depth("首屏主视觉") !== 1) throw new Error("Grouping must reject cross-project drops");
    await drag("首屏主视觉", "设计稿");
    await waitFor(() => { if (depth("首屏主视觉") !== 2) throw new Error("Drop into empty group failed"); });
    await drag("首屏主视觉", "品牌升级");
    await waitFor(() => { if (depth("首屏主视觉") !== 1) throw new Error("Drop onto project must release membership"); });
    await drag("首屏主视觉", "设计稿");
    await waitFor(() => { if (depth("首屏主视觉") !== 2) throw new Error("Regrouping failed"); });
    findButton(canvasElement, "设计稿：分组操作").click();
    await nextFrame();
    findMenuItem(document, "删除").click();
    await nextFrame();
    findButton(dialog(), "删除").click();
    await waitFor(() => {
      if (row("设计稿") || depth("首屏主视觉") !== 1 || depth("产品详情页") !== 2) throw new Error("Deleting a group must release only its sessions");
    });
    for (const [label, title] of [
      [zh.workspaceSidebar.newCompositionInGroup, "未命名构图"],
      [zh.workspaceSidebar.newUiSketchInGroup, "未命名 UI 界面"],
      [zh.spatial.newInGroup, zh.spatial.untitled],
    ]) {
      await waitFor(() => {
        if (canvasElement.querySelector(".ant-tree-treenode-motion")) throw new Error("Wait for tree expansion to finish before toggling it again");
      });
      await nextFrame();
      const groupRow = row("参考")!;
      if (groupRow.getAttribute("aria-expanded") === "true") {
        groupRow.querySelector<HTMLElement>(".ant-tree-switcher")!.click();
        await waitFor(() => {
          if (row("参考")?.getAttribute("aria-expanded") !== "false") throw new Error("The group must start collapsed");
        });
      }
      findButton(canvasElement, label.replace("{{group}}", "参考")).click();
      await waitFor(() => {
        if (depth(title) !== 2 || row("参考")?.getAttribute("aria-expanded") !== "true") {
          throw new Error("Group creation must expand the group and reveal its new session");
        }
        if (row(title)?.getAttribute("aria-selected") !== "true") throw new Error("The newly created session must be selected");
        if (!(row("参考")!.compareDocumentPosition(row(title)!) & Node.DOCUMENT_POSITION_FOLLOWING)
          || !(row(title)!.compareDocumentPosition(row("归档")!) & Node.DOCUMENT_POSITION_FOLLOWING)) {
          throw new Error("The created session must belong to the target group");
        }
      });
    }
  },
};

export const LanguageSelector: Story = {
  name: "底部仓库链接与语言选择",
  render: () => <LanguageSelectorHarness />,
  play: async ({ canvasElement }) => {
    const sidebar = getRequiredElement(
      canvasElement,
      '[data-yisiui-asset="human2ai/workspace-sidebar"]',
    );
    const selector = getRequiredElement(
      canvasElement,
      '[data-yisiui-asset="human2ai/compact-dropdown-select"]',
    );
    const sidebarRect = sidebar.getBoundingClientRect();
    const selectorRect = selector.getBoundingClientRect();
    const repository = canvasElement.querySelector<HTMLAnchorElement>('a[href="https://github.com/yisi-ai/human2ai"]');
    if (!repository || repository.getAttribute("aria-label") !== repositoryLinkLabel || repository.target !== "_blank") {
      throw new Error("Repository link must have an accessible name and open in a new tab");
    }
    const repositoryRect = repository.getBoundingClientRect();
    if (repositoryRect.right > selectorRect.left) throw new Error("GitHub must appear to the left of the language selector");
    const centerDelta = Math.abs(
      sidebarRect.left + sidebarRect.width / 2
        - (repositoryRect.left + selectorRect.right) / 2,
    );
    if (centerDelta > 1) {
      throw new Error("Footer controls must be horizontally centered in the sidebar");
    }

    selector.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await nextFrame();
    const englishOption = Array.from(
      canvasElement.ownerDocument.querySelectorAll<HTMLElement>('[role="option"]'),
    ).find((option) => option.textContent?.includes("EN"));
    if (!englishOption) throw new Error("Language selector did not expose EN");
    englishOption.click();
    await nextFrame();
    assertStoryText(selector, "EN");
  },
};

export const CreateProject: Story = {
  name: "新建项目弹窗",
  render: () => <SidebarHarness />,
  play: async ({ canvasElement }) => {
    findButton(canvasElement, "新建项目").click();
    await nextFrame();
    const input = canvasElement.ownerDocument.querySelector<HTMLInputElement>(
      'input[aria-label="输入项目名称"]',
    );
    if (!input) throw new Error("Project name dialog did not open");
    await waitForActiveElement(canvasElement.ownerDocument, input);
    if (canvasElement.ownerDocument.activeElement !== input) {
      throw new Error("Project name dialog did not open with focus");
    }
    assertOnlyModalFooterAction(canvasElement.ownerDocument, "创建");
  },
};

export const DuplicateProjectName: Story = {
  name: "项目重名校验",
  render: () => <SidebarHarness />,
  play: async ({ canvasElement }) => {
    findButton(canvasElement, "新建项目").click();
    await nextFrame();
    const input = canvasElement.ownerDocument.querySelector<HTMLInputElement>(
      'input[aria-label="输入项目名称"]',
    );
    if (!input) throw new Error("Project name dialog did not open");
    setInputValue(input, "品牌升级");
    await nextFrame();
    assertStoryText(canvasElement.ownerDocument.body, "项目名称不能重复");
  },
};

export const ProjectRenameMenu: Story = {
  name: "项目菜单与重命名",
  render: () => <SidebarHarness />,
  play: async ({ canvasElement }) => {
    findButton(canvasElement, "品牌升级：项目操作").click();
    await nextFrame();
    const renameItem = findMenuItem(canvasElement.ownerDocument, "重命名");
    renameItem.click();
    await nextFrame();
    const input = canvasElement.ownerDocument.querySelector<HTMLInputElement>(
      'input[aria-label="输入项目名称"]',
    );
    if (!input || input.value !== "品牌升级") {
      throw new Error("Project rename dialog did not open with its current name");
    }
    assertOnlyModalFooterAction(canvasElement.ownerDocument, "确认");
  },
};

export const OccupiedProjectDelete: Story = {
  name: "非空项目不可删除",
  render: () => <SidebarHarness />,
  play: async ({ canvasElement }) => {
    findButton(canvasElement, "品牌升级：项目操作").click();
    await nextFrame();
    const deleteItem = findMenuItem(canvasElement.ownerDocument, "删除");
    if (deleteItem.getAttribute("aria-disabled") !== "true") {
      throw new Error("Delete must be disabled for a project with child sessions");
    }
  },
};

export const EmptyProjectDelete: Story = {
  name: "空项目删除确认",
  render: () => <SidebarHarness />,
  play: async ({ canvasElement }) => {
    findButton(canvasElement, "空项目：项目操作").click();
    await nextFrame();
    findMenuItem(canvasElement.ownerDocument, "删除").click();
    await nextFrame();
    if (!canvasElement.ownerDocument.body.textContent?.includes("删除项目")) {
      throw new Error("Empty project delete confirmation did not open");
    }
  },
};

export const CreateComposition: Story = {
  name: "新建无项目构图",
  render: () => <SidebarHarness />,
  play: async ({ canvasElement }) => {
    findButton(canvasElement, "新建构图").click();
    await nextFrame();
    assertStoryText(canvasElement, "未命名构图");
    assertStorySelector(canvasElement, '[aria-selected="true"]');
  },
};

export const CreateUiSketch: Story = {
  name: "新建无项目 UI 界面",
  render: () => <SidebarHarness />,
  play: async ({ canvasElement }) => {
    findButton(canvasElement, "新建 UI 界面").click();
    await nextFrame();
    assertStoryText(canvasElement, "未命名 UI 界面");
    assertStorySelector(canvasElement, '[data-session-type="ui-layout"]');
    assertStorySelector(canvasElement, '[aria-selected="true"]');
  },
};

export const ProjectCreateActions: Story = {
  name: "项目标题新建入口",
  render: () => (
    <SidebarHarness initialProjects={[projects[0]]} initialSessions={[]} />
  ),
  play: async ({ canvasElement }) => {
    if (canvasElement.textContent?.includes("无项目")) {
      throw new Error("The unassigned group must stay hidden without child sessions");
    }

    findButton(canvasElement, "在“品牌升级”中新建构图").click();
    await waitFor(() => {
      assertStoryText(canvasElement, "未命名构图");
      if (findButton(canvasElement, "在“品牌升级”中新建 UI 界面").disabled) throw new Error("Wait for creation to finish");
    });
    if (canvasElement.textContent?.includes("无项目")) {
      throw new Error("The project action must create the composition inside its project");
    }

    findButton(canvasElement, "在“品牌升级”中新建 UI 界面").click();
    await waitFor(() => {
      assertStoryText(canvasElement, "未命名 UI 界面");
      if (findButton(canvasElement, "在“品牌升级”中新建 3D 空间").disabled) throw new Error("Wait for creation to finish");
    });
    if (canvasElement.textContent?.includes("无项目")) {
      throw new Error("The project action must create the interface inside its project");
    }
    findButton(canvasElement, "在“品牌升级”中新建 3D 空间").click();
    await waitFor(() => assertStoryText(canvasElement, zh.spatial.untitled));
    if (canvasElement.textContent?.includes("无项目")) throw new Error("The project action must create the 3D space inside its project");
  },
};

export const SessionMenu: Story = {
  name: "会话菜单与删除确认",
  render: () => <SidebarHarness />,
  play: async ({ canvasElement }) => {
    findButton(canvasElement, "首屏主视觉：会话操作").click();
    await nextFrame();
    const deleteItem = Array.from(document.querySelectorAll<HTMLElement>("[role='menuitem']"))
      .find((item) => item.textContent?.trim() === "删除");
    if (!deleteItem) throw new Error("Session action menu did not open");
    deleteItem.click();
    await nextFrame();
    if (!document.body.textContent?.includes("删除会话")) {
      throw new Error("Delete confirmation did not open");
    }
  },
};

export const SessionRenameMenu: Story = {
  name: "会话菜单与重命名",
  render: () => <SidebarHarness />,
  play: async ({ canvasElement }) => {
    findButton(canvasElement, "首屏主视觉：会话操作").click();
    await nextFrame();
    findMenuItem(canvasElement.ownerDocument, "重命名").click();
    await nextFrame();
    const input = canvasElement.ownerDocument.querySelector<HTMLInputElement>(
      'input[aria-label="输入会话名称"]',
    );
    if (!input || input.value !== "首屏主视觉") {
      throw new Error("Session rename dialog did not open with its current title");
    }
    assertOnlyModalFooterAction(canvasElement.ownerDocument, "确认");
  },
};

export const SessionMoveMenu: Story = {
  name: "会话移动到其他项目",
  render: () => <SidebarHarness />,
  play: async ({ canvasElement }) => {
    findButton(canvasElement, "首屏主视觉：会话操作").click();
    await nextFrame();
    const menuLabels = Array.from(
      canvasElement.ownerDocument.querySelectorAll<HTMLElement>("[role='menuitem']"),
    ).map((item) => item.textContent?.trim());
    if (menuLabels.join("|") !== "重命名|移动|删除") {
      throw new Error("Session actions must order rename, move, and delete");
    }
    findMenuItem(canvasElement.ownerDocument, "移动").click();
    await nextFrame();
    const selector = getRequiredElement(
      canvasElement.ownerDocument.body,
      '[data-yisiui-asset="human2ai/compact-dropdown-select"]',
    );
    selector.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await nextFrame();
    const options = Array.from(
      canvasElement.ownerDocument.querySelectorAll<HTMLElement>('[role="option"]'),
    );
    if (options.some((option) => option.textContent?.trim() === "品牌升级")) {
      throw new Error("Move targets must exclude the current project");
    }
    const target = options.find((option) => option.textContent?.trim() === "夏季活动");
    if (!target) throw new Error("Move dialog did not expose another project");
    target.click();
    await nextFrame();
    assertOnlyModalFooterAction(canvasElement.ownerDocument, "移动");
    findButton(canvasElement.ownerDocument.body, "移动").click();
    await nextFrame();
    await nextFrame();
    const titles = Array.from(
      canvasElement.querySelectorAll<HTMLElement>(".yisi-asset-skeleton-tree-title"),
    ).map((item) => item.textContent?.trim());
    const projectIndex = titles.indexOf("夏季活动");
    const sessionIndex = titles.indexOf("首屏主视觉");
    const nextProjectIndex = titles.indexOf("空项目");
    if (!(projectIndex < sessionIndex && sessionIndex < nextProjectIndex)) {
      throw new Error("Moved session must render under the selected project");
    }
  },
};

export const SessionMoveUnavailable: Story = {
  name: "没有可移动项目",
  render: () => (
    <SidebarHarness
      initialProjects={[projects[0]]}
      initialSessions={[sessions[0]]}
    />
  ),
  play: async ({ canvasElement }) => {
    findButton(canvasElement, "首屏主视觉：会话操作").click();
    await nextFrame();
    const moveItem = findMenuItem(canvasElement.ownerDocument, "移动");
    if (moveItem.getAttribute("aria-disabled") !== "true") {
      throw new Error("Move must be disabled when no other project exists");
    }
  },
};

export const Loading: Story = {
  name: "加载项目",
  args: { loading: true },
  render: (args) => <StoryFrame><Human2AiWorkspaceSidebar {...args} /></StoryFrame>,
  play: ({ canvasElement }) => {
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="yisiui/loading-state"][aria-label="正在加载项目"]',
    );
  },
};

export const LoadError: Story = {
  name: "项目加载失败",
  args: { errorMessage: "SERVICE_UNAVAILABLE", onRetry: () => undefined },
  render: (args) => <StoryFrame><Human2AiWorkspaceSidebar {...args} /></StoryFrame>,
};

export const Empty: Story = {
  name: "空项目列表",
  render: () => <SidebarHarness initialProjects={[]} initialSessions={[]} />,
  play: ({ canvasElement }) => {
    if (canvasElement.textContent?.includes("无项目")) {
      throw new Error("The unassigned group must not render without sessions");
    }
  },
};

export const LongContent: Story = {
  name: "长项目与长会话",
  render: () => (
    <SidebarHarness
      initialProjects={[{ id: "long", name: "一个名称很长但仍然需要保持侧栏稳定的项目" }]}
      initialSessions={[
        {
          id: "long-session",
          projectId: "long",
          sessionType: "image-composition",
          title: "一个名称很长并且需要在会话列表中正确截断的构图沟通会话",
          revision: 1,
        },
      ]}
    />
  ),
};

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (item) =>
      item.getAttribute("aria-label") === label
      || normalizeLabel(item.textContent) === normalizeLabel(label),
  );
  if (!button) throw new Error(`Story interaction contract missing button: ${label}`);
  return button;
}

function getRequiredElement(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Story interaction contract missing selector: ${selector}`);
  return element;
}

function findMenuItem(document: Document, label: string): HTMLElement {
  const item = Array.from(document.querySelectorAll<HTMLElement>("[role='menuitem']"))
    .find((candidate) => candidate.getClientRects().length > 0 && candidate.textContent?.trim() === label);
  if (!item) throw new Error(`Story interaction contract missing menu item: ${label}`);
  return item;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function assertOnlyModalFooterAction(document: Document, label: string): void {
  const footerButtons = document.querySelectorAll<HTMLButtonElement>(
    ".ant-modal-footer button",
  );
  if (
    footerButtons.length !== 1
    || normalizeLabel(footerButtons[0]?.textContent) !== normalizeLabel(label)
  ) {
    throw new Error(`Modal must expose only the ${label} action`);
  }
}

function normalizeLabel(value: string | null | undefined): string {
  return value?.replace(/\s+/g, "") ?? "";
}

async function nextFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitForActiveElement(
  document: Document,
  element: HTMLElement,
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (document.activeElement === element) return;
    await nextFrame();
  }
}
