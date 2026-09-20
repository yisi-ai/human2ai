import type { Meta, StoryContext, StoryObj } from "@storybook/react-webpack5";
import { useState, type ReactNode } from "react";

import {
  assertStorySelector,
  assertStoryText,
} from "../vendor/yisiui/storybook/interactionChecks";
import {
  Human2AiWorkspaceSidebar,
  type Human2AiWorkspaceProject,
  type Human2AiWorkspaceSession,
  type Human2AiWorkspaceSidebarProps,
} from "./Human2AiWorkspaceSidebar";

import "./Human2AiWorkspaceSidebar.stories.css";

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
  languageSelector,
}: {
  initialProjects?: Human2AiWorkspaceProject[];
  initialSessions?: Human2AiWorkspaceSession[];
  languageSelector?: Human2AiWorkspaceSidebarProps["languageSelector"];
}) {
  const [nextProjects, setProjects] = useState(initialProjects);
  const [nextSessions, setSessions] = useState(initialSessions);
  const [currentSessionId, setCurrentSessionId] = useState("hero");

  return (
    <StoryFrame>
      <Human2AiWorkspaceSidebar
        projects={nextProjects}
        sessions={nextSessions}
        currentSessionId={currentSessionId}
        languageSelector={languageSelector}
        onCreateComposition={async (projectId) => {
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
        }}
        onCreateUiSketch={async (projectId) => {
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
  },
};

export const LanguageSelector: Story = {
  name: "底部居中语言选择",
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
    const centerDelta = Math.abs(
      sidebarRect.left + sidebarRect.width / 2
        - (selectorRect.left + selectorRect.width / 2),
    );
    if (centerDelta > 1) {
      throw new Error("Language selector must be horizontally centered in the sidebar");
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
    await nextFrame();
    assertStoryText(canvasElement, "未命名构图");
    if (canvasElement.textContent?.includes("无项目")) {
      throw new Error("The project action must create the composition inside its project");
    }

    findButton(canvasElement, "在“品牌升级”中新建 UI 界面").click();
    await nextFrame();
    assertStoryText(canvasElement, "未命名 UI 界面");
    if (canvasElement.textContent?.includes("无项目")) {
      throw new Error("The project action must create the interface inside its project");
    }
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
    .find((candidate) => candidate.textContent?.trim() === label);
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
