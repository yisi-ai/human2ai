"use client";

import {
  BgColorsOutlined,
  CodeSandboxOutlined,
  FolderAddOutlined,
  FolderOutlined,
  GithubOutlined,
  LayoutOutlined,
  MoreOutlined,
  PictureOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, Input, Modal, Tooltip } from "antd";
import type { InputRef, MenuProps } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import zh from "../../../../../locales/zh-CN/common.json";

import {
  AssetSkeletonTree,
  type AssetSkeletonTreeNode,
} from "../vendor/yisiui/runtime/src/patterns/AssetSkeletonTree";
import { CompositeButton } from "../vendor/yisiui/runtime/src/components/CompositeButton";
import { BasicButton } from "../vendor/yisiui/runtime/src/components/BasicButton";
import { LoadingState } from "../vendor/yisiui/runtime/src/components/LoadingState";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import {
  CompactDropdownSelect,
  type CompactDropdownSelectProps,
} from "./CompactDropdownSelect";

import "./Human2AiWorkspaceSidebar.css";

export interface Human2AiWorkspaceProject {
  id: string;
  name: string;
}

export interface Human2AiWorkspaceSession {
  id: string;
  projectId: string | null;
  sessionType: "image-composition" | "ui-layout" | "spatial";
  title: string;
  revision: number;
}

export interface Human2AiWorkspaceGroup {
  id: string;
  projectId: string;
  name: string;
  sessionIds: string[];
}

const EMPTY_GROUPS: Human2AiWorkspaceGroup[] = [];

export interface Human2AiWorkspaceSidebarLabels {
  functionArea: string;
  projectArea: string;
  newComposition: string;
  newCompositionInProject: (projectName: string) => string;
  newSpatial: string;
  newSpatialInProject: (projectName: string) => string;
  spatialSession: string;
  newUiSketch: string;
  newUiSketchInProject: (projectName: string) => string;
  newProject: string;
  styleLibrary: string;
  projectNamePlaceholder: string;
  createProject: string;
  unassigned: string;
  imageCompositionSession: string;
  uiLayoutSession: string;
  sessionActions: string;
  projectActions: string;
  newSessionGroup: string;
  sessionGroupName: string;
  sessionGroupActions: string;
  renameSessionGroup: string;
  deleteSessionGroup: string;
  deleteSessionGroupDescription: string;
  sessionGroupNameConflict: string;
  groupSession: string;
  ungroupedSessions: string;
  rename: string;
  confirmRename: string;
  move: string;
  moveSessionTitle: string;
  selectProject: string;
  moveUnavailable: string;
  delete: string;
  projectNameConflict: string;
  renameProjectTitle: string;
  deleteProjectTitle: string;
  deleteProjectDescription: string;
  deleteProjectDisabled: string;
  renameSessionTitle: string;
  renameSessionPlaceholder: string;
  deleteSessionTitle: string;
  deleteSessionDescription: string;
  cancel: string;
  loading: string;
  loadFailed: string;
  retry: string;
  actionFailed: string;
}

export interface Human2AiWorkspaceSidebarProps {
  projects: Human2AiWorkspaceProject[];
  sessions: Human2AiWorkspaceSession[];
  groups?: Human2AiWorkspaceGroup[];
  onCreateGroup?: (projectId: string, name: string) => Promise<void>;
  onRenameGroup?: (groupId: string, name: string) => Promise<void>;
  onDeleteGroup?: (groupId: string) => Promise<void>;
  onGroupSession?: (sessionId: string, groupId: string | null) => Promise<void>;
  currentSessionId?: string | null;
  loading?: boolean;
  errorMessage?: string | null;
  labels?: Partial<Human2AiWorkspaceSidebarLabels>;
  languageSelector?: CompactDropdownSelectProps;
  repositoryLink?: { href: string; label: string };
  onCreateComposition: (projectId?: string) => Promise<void>;
  onCreateSpatial?: (projectId?: string) => Promise<void>;
  onCreateUiSketch: (projectId?: string) => Promise<void>;
  onCreateProject: (name: string) => Promise<void>;
  onOpenStyleLibrary: () => void;
  onRenameProject: (projectId: string, name: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onOpenSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => Promise<void>;
  onMoveSession: (sessionId: string, projectId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onRetry?: () => void;
}

const DEFAULT_LABELS: Human2AiWorkspaceSidebarLabels = {
  functionArea: "功能区",
  projectArea: "项目",
  newComposition: "新建构图",
  newCompositionInProject: (projectName) => `在“${projectName}”中新建构图`,
  newSpatial: "新建 3D 空间",
  newSpatialInProject: projectName => `在“${projectName}”中新建 3D 空间`,
  spatialSession: "3D 空间",
  newUiSketch: "新建 UI 界面",
  newUiSketchInProject: (projectName) => `在“${projectName}”中新建 UI 界面`,
  newProject: "新建项目",
  styleLibrary: "风格库",
  projectNamePlaceholder: "输入项目名称",
  createProject: "创建",
  unassigned: "无项目",
  imageCompositionSession: "构图会话",
  uiLayoutSession: "UI 界面会话",
  sessionActions: "会话操作",
  projectActions: "项目操作",
  newSessionGroup: zh.workspaceSidebar.newSessionGroup,
  sessionGroupName: zh.workspaceSidebar.sessionGroupName,
  sessionGroupActions: zh.workspaceSidebar.sessionGroupActions,
  renameSessionGroup: zh.workspaceSidebar.renameSessionGroup,
  deleteSessionGroup: zh.workspaceSidebar.deleteSessionGroup,
  deleteSessionGroupDescription: zh.workspaceSidebar.deleteSessionGroupDescription,
  sessionGroupNameConflict: zh.workspaceSidebar.sessionGroupNameConflict,
  groupSession: zh.workspaceSidebar.groupSession,
  ungroupedSessions: zh.workspaceSidebar.ungroupedSessions,
  rename: "重命名",
  confirmRename: "确认",
  move: "移动",
  moveSessionTitle: "移动会话",
  selectProject: "选择项目",
  moveUnavailable: "没有可移动的项目",
  delete: "删除",
  projectNameConflict: "项目名称不能重复",
  renameProjectTitle: "重命名项目",
  deleteProjectTitle: "删除项目",
  deleteProjectDescription: "删除后无法恢复。",
  deleteProjectDisabled: "项目包含子项，无法删除",
  renameSessionTitle: "重命名会话",
  renameSessionPlaceholder: "输入会话名称",
  deleteSessionTitle: "删除会话",
  deleteSessionDescription: "删除后，该会话的草图和加工记录也会被删除。",
  cancel: "取消",
  loading: "正在加载项目",
  loadFailed: "项目列表加载失败",
  retry: "重试",
  actionFailed: "操作失败，请重试。",
};

export function Human2AiWorkspaceSidebar({
  projects,
  sessions,
  groups = EMPTY_GROUPS,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onGroupSession,
  currentSessionId = null,
  loading = false,
  errorMessage,
  labels: labelOverrides,
  languageSelector,
  repositoryLink,
  onCreateComposition,
  onCreateUiSketch,
  onCreateSpatial,
  onCreateProject,
  onOpenStyleLibrary,
  onRenameProject,
  onDeleteProject,
  onOpenSession,
  onRenameSession,
  onMoveSession,
  onDeleteSession,
  onRetry,
}: Human2AiWorkspaceSidebarProps) {
  const labels = useMemo(() => ({ ...DEFAULT_LABELS, ...labelOverrides }), [labelOverrides]);
  const projectNameInput = useRef<InputRef>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [pendingAction, setPendingAction] = useState<
    | "spatial"
    | "composition"
    | "ui-sketch"
    | "create-project"
    | "rename-project"
    | "delete-project"
    | "rename-session"
    | "move-session"
    | "delete-session"
    | "save-group"
    | "delete-group"
    | "group-session"
    | null
  >(null);
  const [pendingSessionProjectId, setPendingSessionProjectId] = useState<
    string | null
  >(null);
  const [expandedProjectKeys, setExpandedProjectKeys] = useState<string[]>([]);
  const knownProjectKeys = useRef<Set<string>>(new Set());
  const [renameProjectTarget, setRenameProjectTarget] =
    useState<Human2AiWorkspaceProject | null>(null);
  const [renameProjectName, setRenameProjectName] = useState("");
  const [deleteProjectTarget, setDeleteProjectTarget] =
    useState<Human2AiWorkspaceProject | null>(null);
  const [renameTarget, setRenameTarget] = useState<Human2AiWorkspaceSession | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [moveTarget, setMoveTarget] = useState<Human2AiWorkspaceSession | null>(null);
  const [moveProjectId, setMoveProjectId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Human2AiWorkspaceSession | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [groupEditor, setGroupEditor] = useState<{ projectId: string; groupId?: string } | null>(null);
  const [groupName, setGroupName] = useState("");
  const groupNameInput = useRef<InputRef>(null);
  const draggedSession = useRef<string | null>(null);
  const dropHighlight = useRef<HTMLDivElement | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<Human2AiWorkspaceGroup | null>(null);
  const existingGroupNames = useMemo(() => new Set(groups
    .filter(group => group.projectId === groupEditor?.projectId && group.id !== groupEditor?.groupId)
    .map(group => group.name)), [groups, groupEditor]);
  const groupNameConflict = existingGroupNames.has(groupName.trim());

  const projectNameConflict = isDuplicateProjectName(projects, projectName);
  const renameProjectNameConflict = isDuplicateProjectName(
    projects,
    renameProjectName,
    renameProjectTarget?.id,
  );
  const hasUnassignedSessions = sessions.some((session) => session.projectId === null);

  useEffect(() => {
    const nextProjectKeys = [
      ...projects.map((project) => projectKey(project.id)),
      ...groups.map(group => groupKey(group.id)),
      ...(hasUnassignedSessions ? ["project:unassigned"] : []),
    ];
    const addedProjectKeys = nextProjectKeys.filter(
      (key) => !knownProjectKeys.current.has(key),
    );
    knownProjectKeys.current = new Set(nextProjectKeys);
    if (addedProjectKeys.length === 0) return;
    setExpandedProjectKeys((current) => [
      ...new Set([...current, ...addedProjectKeys]),
    ]);
  }, [hasUnassignedSessions, projects, groups]);

  const projectTree = useMemo(() => {
    const projectsByKey = new Map(projects.map(project => [projectKey(project.id), project]));
    const sessionsByKey = new Map(sessions.map((session) => [sessionKey(session.id), session]));
    const groupsByKey = new Map(groups.map(group => [groupKey(group.id), group]));
    const groupBySession = new Map(groups.flatMap(group => group.sessionIds.map(id => [id, group] as const)));
    const nodes: AssetSkeletonTreeNode[] = (() => {
      const projectNodes = projects.flatMap<AssetSkeletonTreeNode>((project, projectIndex) => [
        {
          key: projectKey(project.id),
          parentKey: null,
          order: projectIndex,
          nodeKind: "container",
          title: project.name,
          trailing: renderProjectActions(project),
        },
        ...groups.filter(group => group.projectId === project.id).map<AssetSkeletonTreeNode>((group, index) => ({
          key: groupKey(group.id), parentKey: projectKey(project.id), order: index,
          nodeKind: "container", title: group.name, trailing: renderGroupMenu(group),
          extraClassNames: ["human2ai-workspace-sidebar__group"],
        })),
        ...sessions
          .filter((session) => session.projectId === project.id)
          .map<AssetSkeletonTreeNode>((session, sessionIndex) => ({
            key: sessionKey(session.id),
            parentKey: groupBySession.get(session.id)?.projectId === project.id
              ? groupKey(groupBySession.get(session.id)!.id) : projectKey(project.id),
            order: groups.length + sessionIndex,
            nodeKind: "content",
            title: session.title,
            trailing: renderSessionMenu(session),
          })),
      ]);
      const unassignedSessions = sessions
        .filter((session) => session.projectId === null)
        .map<AssetSkeletonTreeNode>((session, sessionIndex) => ({
          key: sessionKey(session.id),
          parentKey: "project:unassigned",
          order: sessionIndex,
          nodeKind: "content",
          title: session.title,
          trailing: renderSessionMenu(session),
        }));

      if (unassignedSessions.length === 0) return projectNodes;

      return [
        ...projectNodes,
        {
          key: "project:unassigned",
          parentKey: null,
          order: projects.length,
          nodeKind: "container",
          title: labels.unassigned,
        },
        ...unassignedSessions,
      ];
    })();

    return (
      <AssetSkeletonTree
        nodes={nodes}
        mode="view"
        titleRender={node => {
          const key = String(node.key);
          const session = sessionsByKey.get(key);
          const targetGroup = groupsByKey.get(key);
          const targetProject = projectsByKey.get(key);
          const targetProjectId = targetGroup?.projectId ?? targetProject?.id;
          const canReceive = () => {
            const source = draggedSession.current ? sessionsByKey.get(sessionKey(draggedSession.current)) : undefined;
            return Boolean(onGroupSession && !pendingAction && source?.projectId && source.projectId === targetProjectId
              && (groupBySession.get(source.id)?.id ?? null) !== (targetGroup?.id ?? null));
          };
          return <div className="human2ai-workspace-sidebar__tree-node" data-session-tree-key={key}
            aria-label={session?.title ?? targetGroup?.name ?? targetProject?.name ?? labels.unassigned}
            draggable={Boolean(onGroupSession && session?.projectId && !pendingAction)}
            onDragStart={event => {
              if (!session?.projectId || (event.target as HTMLElement).closest("button")) { event.preventDefault(); return; }
              draggedSession.current = session.id;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", session.title);
              event.stopPropagation();
            }}
            onDragOver={event => {
              if (!canReceive()) return;
              event.preventDefault(); event.stopPropagation();
              event.dataTransfer.dropEffect = "move";
              if (dropHighlight.current !== event.currentTarget) clearDropHighlight();
              dropHighlight.current = event.currentTarget;
              event.currentTarget.dataset.dropTarget = "true";
            }}
            onDragLeave={event => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) clearDropHighlight();
            }}
            onDrop={event => {
              if (!canReceive() || !draggedSession.current) return;
              event.preventDefault(); event.stopPropagation();
              const id = draggedSession.current;
              draggedSession.current = null;
              clearDropHighlight();
              void assignGroup(id, targetGroup?.id ?? null);
            }}
            onDragEnd={() => { draggedSession.current = null; clearDropHighlight(); }}>
            {typeof node.title === "function" ? node.title(node) : node.title}
          </div>;
        }}
        defaultExpandAll
        showContentOrder={false}
        showCurrent={false}
        showIcon
        showStatus={false}
        expandedKeys={expandedProjectKeys}
        onExpand={(keys) => setExpandedProjectKeys(keys.map(String))}
        icon={({ eventKey }) => {
          const session = sessionsByKey.get(String(eventKey));
          return session ? renderSessionTypeIcon(session.sessionType, labels)
            : groupsByKey.has(String(eventKey)) ? <FolderOutlined aria-hidden="true" /> : null;
        }}
        currentKey={currentSessionId ? sessionKey(currentSessionId) : null}
        selectedKeys={currentSessionId ? [sessionKey(currentSessionId)] : []}
        onSelect={(keys) => {
          const key = String(keys[0] ?? "");
          if (key.startsWith("session:")) onOpenSession(key.slice("session:".length));
        }}
      />
    );
  }, [projects, sessions, groups, labels, pendingAction, pendingSessionProjectId,
    onCreateComposition, onCreateUiSketch, onCreateSpatial, onOpenSession,
    onCreateGroup, onRenameGroup, onDeleteGroup, onGroupSession,
    currentSessionId, expandedProjectKeys]);

  function renderProjectActions(project: Human2AiWorkspaceProject) {
    const compositionLabel = labels.newCompositionInProject(project.name);
    const uiSketchLabel = labels.newUiSketchInProject(project.name);

    return (
      <span className="human2ai-workspace-sidebar__project-actions">
        <Tooltip title={compositionLabel}>
          <Button
            className="human2ai-workspace-sidebar__node-action"
            type="text"
            size="small"
            icon={<PictureOutlined aria-hidden="true" />}
            aria-label={compositionLabel}
            loading={
              pendingAction === "composition"
              && pendingSessionProjectId === project.id
            }
            disabled={Boolean(
              pendingAction
              && (
                pendingAction !== "composition"
                || pendingSessionProjectId !== project.id
              )
            )}
            onClick={(event) => {
              event.stopPropagation();
              void createComposition(project.id);
            }}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </Tooltip>
        <Tooltip title={uiSketchLabel}>
          <Button
            className="human2ai-workspace-sidebar__node-action"
            type="text"
            size="small"
            icon={<LayoutOutlined aria-hidden="true" />}
            aria-label={uiSketchLabel}
            loading={
              pendingAction === "ui-sketch"
              && pendingSessionProjectId === project.id
            }
            disabled={Boolean(
              pendingAction
              && (
                pendingAction !== "ui-sketch"
                || pendingSessionProjectId !== project.id
              )
            )}
            onClick={(event) => {
              event.stopPropagation();
              void createUiSketch(project.id);
            }}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </Tooltip>
        {onCreateSpatial && <Tooltip title={labels.newSpatialInProject(project.name)}><Button className="human2ai-workspace-sidebar__node-action" type="text" size="small" icon={<CodeSandboxOutlined />} aria-label={labels.newSpatialInProject(project.name)} disabled={Boolean(pendingAction)} onClick={event => { event.stopPropagation(); void createSpatial(project.id); }} onPointerDown={event => event.stopPropagation()} /></Tooltip>}
        {renderProjectMenu(project)}
      </span>
    );
  }

  function renderProjectMenu(project: Human2AiWorkspaceProject) {
    const hasChildren = sessions.some((session) => session.projectId === project.id);
    const items: MenuProps["items"] = [
      ...(onCreateGroup ? [{ key: "create-group", label: labels.newSessionGroup, disabled: Boolean(pendingAction) }] : []),
      { key: "rename", label: labels.rename },
      {
        key: "delete",
        label: labels.delete,
        danger: true,
        disabled: hasChildren,
        title: hasChildren ? labels.deleteProjectDisabled : undefined,
      },
    ];
    return (
      <Dropdown
        trigger={["click"]}
        menu={{
          items,
          onClick: ({ key, domEvent }) => {
            domEvent.stopPropagation();
            setActionError(null);
            if (key === "create-group") {
              setGroupEditor({ projectId: project.id });
              setGroupName("");
            } else if (key === "rename") {
              setRenameProjectTarget(project);
              setRenameProjectName(project.name);
            } else if (key === "delete" && !hasChildren) {
              setDeleteProjectTarget(project);
            }
          },
        }}
      >
        <Button
          className="human2ai-workspace-sidebar__node-menu"
          type="text"
          size="small"
          icon={<MoreOutlined />}
          aria-label={`${project.name}：${labels.projectActions}`}
          title={labels.projectActions}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        />
      </Dropdown>
    );
  }

  function renderSessionMenu(session: Human2AiWorkspaceSession) {
    const moveDisabled = projects.every((project) => project.id === session.projectId);
    const items: MenuProps["items"] = [
      { key: "rename", label: labels.rename },
      ...(onGroupSession && session.projectId ? [{
        key: "group", label: labels.groupSession, disabled: Boolean(pendingAction),
        children: [
          { key: "ungroup", label: labels.ungroupedSessions, disabled: !groups.some(group => group.sessionIds.includes(session.id)) },
          ...groups.filter(group => group.projectId === session.projectId).map(group => ({
            key: groupKey(group.id), label: group.name, disabled: group.sessionIds.includes(session.id),
          })),
        ],
      }] : []),
      {
        key: "move",
        label: labels.move,
        disabled: moveDisabled,
        title: moveDisabled ? labels.moveUnavailable : undefined,
      },
      { key: "delete", label: labels.delete, danger: true },
    ];
    return (
      <Dropdown
        trigger={["click"]}
        menu={{
          items,
          onClick: ({ key, domEvent }) => {
            domEvent.stopPropagation();
            setActionError(null);
            if (key === "ungroup" || key.startsWith("group:")) {
              void assignGroup(session.id, key === "ungroup" ? null : key.slice("group:".length));
            } else if (key === "rename") {
              setRenameTarget(session);
              setRenameTitle(session.title);
            } else if (key === "move" && !moveDisabled) {
              setMoveTarget(session);
              setMoveProjectId("");
            } else if (key === "delete") {
              setDeleteTarget(session);
            }
          },
        }}
      >
        <Button
          className="human2ai-workspace-sidebar__node-menu"
          type="text"
          size="small"
          icon={<MoreOutlined />}
          aria-label={`${session.title}：${labels.sessionActions}`}
          title={labels.sessionActions}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        />
      </Dropdown>
    );
  }

  function clearDropHighlight(): void {
    if (dropHighlight.current) delete dropHighlight.current.dataset.dropTarget;
    dropHighlight.current = null;
  }

  function renderGroupMenu(group: Human2AiWorkspaceGroup) {
    return (
      <Dropdown trigger={["click"]} menu={{
        items: [
          { key: "rename", label: labels.rename, disabled: !onRenameGroup || Boolean(pendingAction) },
          { key: "delete", label: labels.delete, danger: true, disabled: !onDeleteGroup || Boolean(pendingAction) },
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          setActionError(null);
          if (key === "rename") {
            setGroupEditor({ projectId: group.projectId, groupId: group.id });
            setGroupName(group.name);
          } else if (key === "delete") setDeleteGroupTarget(group);
        },
      }}>
        <Button className="human2ai-workspace-sidebar__node-menu" type="text" size="small"
          icon={<MoreOutlined />} aria-label={`${group.name}：${labels.sessionGroupActions}`} title={labels.sessionGroupActions}
          onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} />
      </Dropdown>
    );
  }

  async function submitGroup(): Promise<void> {
    if (!groupEditor || !groupName.trim() || groupNameConflict || pendingAction) return;
    setPendingAction("save-group");
    setActionError(null);
    try {
      if (groupEditor.groupId) await onRenameGroup?.(groupEditor.groupId, groupName.trim());
      else await onCreateGroup?.(groupEditor.projectId, groupName.trim());
      expandProject(groupEditor.projectId);
      setGroupEditor(null);
    } catch (error) {
      setActionError(error && typeof error === "object" && "code" in error && error.code === "SESSION_GROUP_NAME_CONFLICT"
        ? labels.sessionGroupNameConflict : labels.actionFailed);
    } finally { setPendingAction(null); }
  }

  async function submitGroupDelete(): Promise<void> {
    if (!deleteGroupTarget || !onDeleteGroup || pendingAction) return;
    setPendingAction("delete-group");
    setActionError(null);
    try {
      await onDeleteGroup(deleteGroupTarget.id);
      expandProject(deleteGroupTarget.projectId);
      setDeleteGroupTarget(null);
    } catch { setActionError(labels.actionFailed); }
    finally { setPendingAction(null); }
  }

  async function assignGroup(sessionId: string, groupId: string | null): Promise<void> {
    if (!onGroupSession || pendingAction) return;
    const session = sessions.find(item => item.id === sessionId);
    const group = groups.find(item => item.id === groupId);
    if (!session?.projectId || (groupId !== null && group?.projectId !== session.projectId)) return;
    setPendingAction("group-session");
    setActionError(null);
    try {
      await onGroupSession(sessionId, groupId);
      setExpandedProjectKeys(current => [...new Set([...current, projectKey(session.projectId!), ...(groupId ? [groupKey(groupId)] : [])])]);
    } catch { setActionError(labels.actionFailed); }
    finally { setPendingAction(null); }
  }

  function openProjectDialog(): void {
    setActionError(null);
    setProjectDialogOpen(true);
  }

  function closeProjectDialog(): void {
    if (pendingAction === "create-project") return;
    setProjectDialogOpen(false);
    setProjectName("");
    setActionError(null);
  }

  async function createComposition(projectId?: string): Promise<void> {
    expandProject(projectId);
    setPendingAction("composition");
    setPendingSessionProjectId(projectId ?? null);
    setActionError(null);
    try {
      await onCreateComposition(projectId);
    } catch {
      setActionError(labels.actionFailed);
    } finally {
      setPendingAction(null);
      setPendingSessionProjectId(null);
    }
  }

  async function createUiSketch(projectId?: string): Promise<void> {
    expandProject(projectId);
    setPendingAction("ui-sketch");
    setPendingSessionProjectId(projectId ?? null);
    setActionError(null);
    try {
      await onCreateUiSketch(projectId);
    } catch {
      setActionError(labels.actionFailed);
    } finally {
      setPendingAction(null);
      setPendingSessionProjectId(null);
    }
  }

  async function createSpatial(projectId?: string): Promise<void> {
    expandProject(projectId);
    setPendingAction("spatial");
    setPendingSessionProjectId(projectId ?? null);
    setActionError(null);
    try {
      await onCreateSpatial?.(projectId);
    } catch {
      setActionError(labels.actionFailed);
    } finally {
      setPendingAction(null);
      setPendingSessionProjectId(null);
    }
  }

  async function submitProject(): Promise<void> {
    const name = projectName.trim();
    if (!name || projectNameConflict || pendingAction) return;
    setPendingAction("create-project");
    setActionError(null);
    try {
      await onCreateProject(name);
      setProjectDialogOpen(false);
      setProjectName("");
    } catch (error) {
      setActionError(resolveProjectActionError(error, labels));
    } finally {
      setPendingAction(null);
    }
  }

  function expandProject(projectId?: string): void {
    const key = projectId ? projectKey(projectId) : "project:unassigned";
    setExpandedProjectKeys((current) => (
      current.includes(key) ? current : [...current, key]
    ));
  }

  async function submitProjectRename(): Promise<void> {
    const name = renameProjectName.trim();
    if (!renameProjectTarget || !name || renameProjectNameConflict || pendingAction) return;
    setPendingAction("rename-project");
    setActionError(null);
    try {
      await onRenameProject(renameProjectTarget.id, name);
      setRenameProjectTarget(null);
    } catch (error) {
      setActionError(resolveProjectActionError(error, labels));
    } finally {
      setPendingAction(null);
    }
  }

  async function submitProjectDelete(): Promise<void> {
    if (!deleteProjectTarget || pendingAction) return;
    setPendingAction("delete-project");
    setActionError(null);
    try {
      await onDeleteProject(deleteProjectTarget.id);
      setDeleteProjectTarget(null);
    } catch (error) {
      setActionError(resolveProjectActionError(error, labels));
    } finally {
      setPendingAction(null);
    }
  }

  async function submitRename(): Promise<void> {
    const title = renameTitle.trim();
    if (!renameTarget || !title || pendingAction) return;
    setPendingAction("rename-session");
    setActionError(null);
    try {
      await onRenameSession(renameTarget.id, title);
      setRenameTarget(null);
    } catch {
      setActionError(labels.actionFailed);
    } finally {
      setPendingAction(null);
    }
  }

  async function submitMove(): Promise<void> {
    if (!moveTarget || !moveProjectId || pendingAction) return;
    setPendingAction("move-session");
    setActionError(null);
    try {
      await onMoveSession(moveTarget.id, moveProjectId);
      setMoveTarget(null);
      setMoveProjectId("");
    } catch {
      setActionError(labels.actionFailed);
    } finally {
      setPendingAction(null);
    }
  }

  async function submitDelete(): Promise<void> {
    if (!deleteTarget || pendingAction) return;
    setPendingAction("delete-session");
    setActionError(null);
    try {
      await onDeleteSession(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      setActionError(labels.actionFailed);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "workspace-sidebar",
        name: "Human2AiWorkspaceSidebar",
        category: "module",
        origin: "project",
        status: "candidate",
      })}
      className="human2ai-workspace-sidebar"
    >
      <section
        className="human2ai-workspace-sidebar__actions"
        aria-labelledby="human2ai-sidebar-actions-title"
      >
        <h2 id="human2ai-sidebar-actions-title">{labels.functionArea}</h2>
        <CompositeButton
          icon={<PictureOutlined aria-hidden="true" />}
          label={labels.newComposition}
          collapsedLabel={labels.newComposition}
          loading={pendingAction === "composition" && pendingSessionProjectId === null}
          disabled={Boolean(
            pendingAction
            && (pendingAction !== "composition" || pendingSessionProjectId !== null)
          )}
          onClick={() => void createComposition()}
        />
        <CompositeButton
          icon={<LayoutOutlined aria-hidden="true" />}
          label={labels.newUiSketch}
          collapsedLabel={labels.newUiSketch}
          loading={pendingAction === "ui-sketch" && pendingSessionProjectId === null}
          disabled={Boolean(
            pendingAction
            && (pendingAction !== "ui-sketch" || pendingSessionProjectId !== null)
          )}
          onClick={() => void createUiSketch()}
        />
        {onCreateSpatial && <CompositeButton icon={<CodeSandboxOutlined aria-hidden="true" />} label={labels.newSpatial} collapsedLabel={labels.newSpatial} loading={pendingAction === "spatial" && pendingSessionProjectId === null} disabled={Boolean(pendingAction && pendingAction !== "spatial")} onClick={() => void createSpatial()} />}
        <CompositeButton
          icon={<FolderAddOutlined aria-hidden="true" />}
          label={labels.newProject}
          collapsedLabel={labels.newProject}
          disabled={Boolean(pendingAction)}
          onClick={openProjectDialog}
        />
        <CompositeButton
          icon={<BgColorsOutlined aria-hidden="true" />}
          label={labels.styleLibrary}
          collapsedLabel={labels.styleLibrary}
          onClick={onOpenStyleLibrary}
        />
        {actionError &&
          !groupEditor &&
          !deleteGroupTarget &&
          !projectDialogOpen &&
          !renameProjectTarget &&
          !deleteProjectTarget &&
          !renameTarget &&
          !moveTarget &&
          !deleteTarget ? (
          <p className="human2ai-workspace-sidebar__error" role="alert">
            {actionError}
          </p>
        ) : null}
      </section>

      <section
        className="human2ai-workspace-sidebar__projects"
        aria-labelledby="human2ai-sidebar-projects-title"
        aria-busy={loading}
      >
        <h2 id="human2ai-sidebar-projects-title">{labels.projectArea}</h2>
        {loading ? (
          <LoadingState
            className="human2ai-workspace-sidebar__loading"
            label={labels.loading}
            rows={6}
            compact
          />
        ) : errorMessage ? (
          <div className="human2ai-workspace-sidebar__state" role="alert">
            <span>{labels.loadFailed}</span>
            {onRetry ? (
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                onClick={onRetry}
              >
                {labels.retry}
              </Button>
            ) : null}
          </div>
        ) : (
          projectTree
        )}
      </section>

      {languageSelector || repositoryLink ? (
        <div className="human2ai-workspace-sidebar__language-selector">
          {repositoryLink ? (
            <BasicButton
              className="human2ai-workspace-sidebar__repository-link"
              mode="icon-only"
              icon={<GithubOutlined aria-hidden="true" />}
              iconLabel={repositoryLink.label}
              title={repositoryLink.label}
              href={repositoryLink.href}
              target="_blank"
              rel="noopener noreferrer"
              backgroundColor="none"
            />
          ) : null}
          {languageSelector ? <CompactDropdownSelect {...languageSelector} /> : null}
        </div>
      ) : null}

      <Modal open={Boolean(groupEditor)} title={groupEditor?.groupId ? labels.renameSessionGroup : labels.newSessionGroup}
        okText={groupEditor?.groupId ? labels.confirmRename : labels.createProject}
        cancelText={labels.cancel} confirmLoading={pendingAction === "save-group"}
        okButtonProps={{ disabled: !groupName.trim() || groupNameConflict }}
        afterOpenChange={open => { if (open) groupNameInput.current?.focus(); }}
        onOk={() => void submitGroup()}
        onCancel={() => { if (!pendingAction) { setGroupEditor(null); setActionError(null); } }}>
        <Input ref={groupNameInput} value={groupName} maxLength={200} disabled={Boolean(pendingAction)}
          placeholder={labels.sessionGroupName} aria-label={labels.sessionGroupName}
          status={groupNameConflict ? "error" : undefined} aria-invalid={groupNameConflict}
          aria-describedby={groupNameConflict || actionError ? "human2ai-group-name-error" : undefined}
          onChange={event => { setGroupName(event.target.value); setActionError(null); }}
          onPressEnter={() => void submitGroup()} />
        {groupNameConflict || actionError ? <p id="human2ai-group-name-error" className="human2ai-workspace-sidebar__error" role="alert">{groupNameConflict ? labels.sessionGroupNameConflict : actionError}</p> : null}
      </Modal>

      <Modal open={Boolean(deleteGroupTarget)} title={labels.deleteSessionGroup}
        okText={labels.delete} cancelText={labels.cancel} okButtonProps={{ danger: true }}
        confirmLoading={pendingAction === "delete-group"} onOk={() => void submitGroupDelete()}
        onCancel={() => { if (!pendingAction) { setDeleteGroupTarget(null); setActionError(null); } }}>
        <p>{deleteGroupTarget?.name}</p>
        <p>{labels.deleteSessionGroupDescription}</p>
        {actionError ? <p className="human2ai-workspace-sidebar__error" role="alert">{actionError}</p> : null}
      </Modal>

      <Modal
        open={projectDialogOpen}
        title={labels.newProject}
        okText={labels.createProject}
        footer={(_, { OkBtn }) => <OkBtn />}
        confirmLoading={pendingAction === "create-project"}
        okButtonProps={{
          disabled: !projectName.trim() || projectNameConflict,
        }}
        afterOpenChange={(open) => {
          if (open) projectNameInput.current?.focus();
        }}
        onOk={() => void submitProject()}
        onCancel={closeProjectDialog}
      >
        <Input
          ref={projectNameInput}
          id="human2ai-project-name"
          name="projectName"
          value={projectName}
          maxLength={200}
          disabled={pendingAction === "create-project"}
          status={projectNameConflict ? "error" : undefined}
          placeholder={labels.projectNamePlaceholder}
          aria-label={labels.projectNamePlaceholder}
          aria-invalid={projectNameConflict}
          aria-describedby={
            projectNameConflict || actionError ? "human2ai-project-name-error" : undefined
          }
          onChange={(event) => {
            setProjectName(event.target.value);
            setActionError(null);
          }}
          onPressEnter={() => void submitProject()}
        />
        {projectNameConflict || actionError ? (
          <p
            id="human2ai-project-name-error"
            className="human2ai-workspace-sidebar__error"
            role="alert"
          >
            {projectNameConflict ? labels.projectNameConflict : actionError}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(renameProjectTarget)}
        title={labels.renameProjectTitle}
        okText={labels.confirmRename}
        footer={(_, { OkBtn }) => <OkBtn />}
        confirmLoading={pendingAction === "rename-project"}
        okButtonProps={{
          disabled: !renameProjectName.trim() || renameProjectNameConflict,
        }}
        onOk={() => void submitProjectRename()}
        onCancel={() => {
          if (pendingAction !== "rename-project") setRenameProjectTarget(null);
        }}
      >
        <Input
          autoFocus
          id="human2ai-project-rename"
          name="projectName"
          value={renameProjectName}
          maxLength={200}
          disabled={pendingAction === "rename-project"}
          status={renameProjectNameConflict ? "error" : undefined}
          placeholder={labels.projectNamePlaceholder}
          aria-label={labels.projectNamePlaceholder}
          aria-invalid={renameProjectNameConflict}
          aria-describedby={
            renameProjectNameConflict || actionError
              ? "human2ai-project-rename-error"
              : undefined
          }
          onChange={(event) => {
            setRenameProjectName(event.target.value);
            setActionError(null);
          }}
          onPressEnter={() => void submitProjectRename()}
        />
        {renameProjectNameConflict || actionError ? (
          <p
            id="human2ai-project-rename-error"
            className="human2ai-workspace-sidebar__error"
            role="alert"
          >
            {renameProjectNameConflict ? labels.projectNameConflict : actionError}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteProjectTarget)}
        title={labels.deleteProjectTitle}
        okText={labels.delete}
        cancelText={labels.cancel}
        confirmLoading={pendingAction === "delete-project"}
        okButtonProps={{ danger: true }}
        onOk={() => void submitProjectDelete()}
        onCancel={() => {
          if (pendingAction !== "delete-project") setDeleteProjectTarget(null);
        }}
      >
        <p>{deleteProjectTarget?.name}</p>
        <p>{labels.deleteProjectDescription}</p>
        {actionError ? (
          <p className="human2ai-workspace-sidebar__error" role="alert">
            {actionError}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(renameTarget)}
        title={labels.renameSessionTitle}
        okText={labels.confirmRename}
        footer={(_, { OkBtn }) => <OkBtn />}
        confirmLoading={pendingAction === "rename-session"}
        okButtonProps={{ disabled: !renameTitle.trim() }}
        onOk={() => void submitRename()}
        onCancel={() => {
          if (pendingAction !== "rename-session") setRenameTarget(null);
        }}
      >
        <Input
          autoFocus
          id="human2ai-session-title"
          name="sessionTitle"
          value={renameTitle}
          maxLength={200}
          placeholder={labels.renameSessionPlaceholder}
          aria-label={labels.renameSessionPlaceholder}
          onChange={(event) => setRenameTitle(event.target.value)}
          onPressEnter={() => void submitRename()}
        />
        {actionError ? (
          <p className="human2ai-workspace-sidebar__error" role="alert">
            {actionError}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(moveTarget)}
        title={labels.moveSessionTitle}
        okText={labels.move}
        footer={(_, { OkBtn }) => <OkBtn />}
        confirmLoading={pendingAction === "move-session"}
        okButtonProps={{ disabled: !moveProjectId }}
        onOk={() => void submitMove()}
        onCancel={() => {
          if (pendingAction !== "move-session") {
            setMoveTarget(null);
            setMoveProjectId("");
          }
        }}
      >
        <p>{moveTarget?.title}</p>
        <CompactDropdownSelect
          value={moveProjectId}
          options={[
            { value: "", label: labels.selectProject, disabled: true },
            ...projects
              .filter((project) => project.id !== moveTarget?.projectId)
              .map((project) => ({ value: project.id, label: project.name })),
          ]}
          onChange={setMoveProjectId}
          aria-label={labels.selectProject}
          disabled={pendingAction === "move-session"}
        />
        {actionError ? (
          <p className="human2ai-workspace-sidebar__error" role="alert">
            {actionError}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title={labels.deleteSessionTitle}
        okText={labels.delete}
        cancelText={labels.cancel}
        confirmLoading={pendingAction === "delete-session"}
        okButtonProps={{ danger: true }}
        onOk={() => void submitDelete()}
        onCancel={() => {
          if (pendingAction !== "delete-session") setDeleteTarget(null);
        }}
      >
        <p>{deleteTarget?.title}</p>
        <p>{labels.deleteSessionDescription}</p>
        {actionError ? (
          <p className="human2ai-workspace-sidebar__error" role="alert">
            {actionError}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}

function projectKey(projectId: string): string {
  return `project:${projectId}`;
}

function groupKey(groupId: string): string {
  return `group:${groupId}`;
}

function sessionKey(sessionId: string): string {
  return `session:${sessionId}`;
}

function isDuplicateProjectName(
  projects: Human2AiWorkspaceProject[],
  name: string,
  excludedProjectId?: string,
): boolean {
  const normalizedName = name.trim();
  return Boolean(normalizedName) && projects.some(
    (project) => project.id !== excludedProjectId && project.name.trim() === normalizedName,
  );
}

function resolveProjectActionError(
  error: unknown,
  labels: Human2AiWorkspaceSidebarLabels,
): string {
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "PROJECT_NAME_CONFLICT") return labels.projectNameConflict;
    if (error.code === "PROJECT_NOT_EMPTY") return labels.deleteProjectDisabled;
  }
  return labels.actionFailed;
}

function renderSessionTypeIcon(
  sessionType: Human2AiWorkspaceSession["sessionType"],
  labels: Human2AiWorkspaceSidebarLabels,
) {
  const isComposition = sessionType === "image-composition";
  const label = sessionType === "spatial" ? labels.spatialSession : isComposition
    ? labels.imageCompositionSession
    : labels.uiLayoutSession;

  return (
    <span
      className="human2ai-workspace-sidebar__session-type-icon"
      data-session-type={sessionType}
      role="img"
      aria-label={label}
      title={label}
    >
      {sessionType === "spatial" ? <CodeSandboxOutlined aria-hidden="true" /> : isComposition ? (
        <PictureOutlined aria-hidden="true" />
      ) : (
        <LayoutOutlined aria-hidden="true" />
      )}
    </span>
  );
}
