"use client";

import {
  BgColorsOutlined,
  CodeSandboxOutlined,
  FolderAddOutlined,
  LayoutOutlined,
  MoreOutlined,
  PictureOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, Input, Modal, Tooltip } from "antd";
import type { InputRef, MenuProps } from "antd";
import { useEffect, useRef, useState } from "react";

import {
  AssetSkeletonTree,
  type AssetSkeletonTreeNode,
} from "../vendor/yisiui/runtime/src/patterns/AssetSkeletonTree";
import { CompositeButton } from "../vendor/yisiui/runtime/src/components/CompositeButton";
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
  currentSessionId?: string | null;
  loading?: boolean;
  errorMessage?: string | null;
  labels?: Partial<Human2AiWorkspaceSidebarLabels>;
  languageSelector?: CompactDropdownSelectProps;
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
  currentSessionId = null,
  loading = false,
  errorMessage,
  labels: labelOverrides,
  languageSelector,
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
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
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
  }, [hasUnassignedSessions, projects]);

  const sessionsByKey = new Map(sessions.map((session) => [sessionKey(session.id), session]));
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
      ...sessions
        .filter((session) => session.projectId === project.id)
        .map<AssetSkeletonTreeNode>((session, sessionIndex) => ({
          key: sessionKey(session.id),
          parentKey: projectKey(project.id),
          order: sessionIndex,
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
            if (key === "rename") {
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
            if (key === "rename") {
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
          <AssetSkeletonTree
            nodes={nodes}
            mode="view"
            defaultExpandAll
            showContentOrder={false}
            showCurrent={false}
            showIcon
            showStatus={false}
            expandedKeys={expandedProjectKeys}
            onExpand={(keys) => setExpandedProjectKeys(keys.map(String))}
            icon={({ eventKey }) => {
              const session = sessionsByKey.get(String(eventKey));
              return session ? renderSessionTypeIcon(session.sessionType, labels) : null;
            }}
            currentKey={currentSessionId ? sessionKey(currentSessionId) : null}
            selectedKeys={currentSessionId ? [sessionKey(currentSessionId)] : []}
            onSelect={(keys) => {
              const key = String(keys[0] ?? "");
              if (key.startsWith("session:")) onOpenSession(key.slice("session:".length));
            }}
          />
        )}
      </section>

      {languageSelector ? (
        <div className="human2ai-workspace-sidebar__language-selector">
          <CompactDropdownSelect {...languageSelector} />
        </div>
      ) : null}

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
