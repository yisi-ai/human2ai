"use client";

import { CopyOutlined } from "@ant-design/icons";
import { ActionButton } from "@human2ai/ui/yisiui/action-button";
import {
  Human2AiAppShell,
  Human2AiWorkspaceSidebar,
  type Human2AiAppShellProps,
  type Human2AiWorkspaceSidebarLabels,
} from "@human2ai/ui";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createContext, memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { isAppLocale, resolveAppLocale } from "../i18n/createI18n";
import { useAppShellWidths } from "../lib/use-app-shell-widths";
import { useWorkspaceTreeExpansion } from "../lib/use-workspace-tree-expansion";
import { WorkspaceSettings } from "./WorkspaceSettings";
import {
  createCompositionSession,
  createUiSketchSession,
  createSpatialSession,
  createProject,
  createSessionGroup,
  renameSessionGroup,
  deleteSessionGroup,
  setSessionGroup,
  listSessionGroups,
  type SessionGroup,
  deleteProject,
  deleteSession,
  listProjects,
  listSessions,
  getSession,
  moveSession,
  renameProject,
  renameSession,
  type Human2AiProject,
  type Human2AiSession,
} from "../lib/human2ai-api";

type Human2AiShellProps = Pick<Human2AiAppShellProps,
  "title" | "headerExtra" | "children" | "rightPanel" | "rightPanelOpen" | "onRightPanelOpenChange" | "className"
> & {
  currentSessionId?: string | null;
  onCurrentSessionRename?: (title: string) => void;
};

type PageChrome = Pick<Human2AiShellProps,
  "currentSessionId" | "onCurrentSessionRename" | "rightPanelOpen" | "onRightPanelOpenChange" | "className"
> & { owner: object; hasTitle: boolean; hasHeaderExtra: boolean; hasRightPanel: boolean };

const ShellSlots = createContext<{
  title: HTMLSpanElement | null;
  header: HTMLDivElement | null;
  panel: HTMLDivElement | null;
  setPage: Dispatch<SetStateAction<PageChrome | null>>;
} | null>(null);

const languageOptions = [
  { value: "zh-CN", label: "中文" },
  { value: "en", label: "EN" },
] as const;

export function Human2AiShell({
  title, headerExtra, rightPanel, children, rightPanelOpen, onRightPanelOpenChange, className,
  currentSessionId = null,
  onCurrentSessionRename,
}: Human2AiShellProps) {
  const slots = useContext(ShellSlots)!;
  const owner = useRef({}).current;
  const hasTitle = Boolean(title);
  const hasHeaderExtra = headerExtra !== undefined && headerExtra !== null && headerExtra !== false;
  const hasRightPanel = rightPanel !== undefined && rightPanel !== null;
  const setPage = slots.setPage;
  // Only layout/selection metadata crosses this boundary. Draft-driven elements
  // stay in their page's React tree and render into the persistent shell slots.
  useLayoutEffect(() => {
    setPage({ owner, hasTitle, hasHeaderExtra, hasRightPanel, currentSessionId,
      onCurrentSessionRename, rightPanelOpen, onRightPanelOpenChange, className });
  }, [setPage, owner, hasTitle, hasHeaderExtra, hasRightPanel, currentSessionId,
    onCurrentSessionRename, rightPanelOpen, onRightPanelOpenChange, className]);
  useLayoutEffect(() => () => {
    setPage(current => current?.owner === owner ? null : current);
  }, [setPage, owner]);

  return <>
    {slots.title && createPortal(title, slots.title)}
    {slots.header && createPortal(headerExtra, slots.header)}
    {slots.panel && createPortal(rightPanel, slots.panel)}
    {children}
  </>;
}

export function Human2AiShellLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const panelWidths = useAppShellWidths();
  const [page, setPage] = useState<PageChrome | null>(null);
  const [title, setTitle] = useState<HTMLSpanElement | null>(null);
  const [header, setHeader] = useState<HTMLDivElement | null>(null);
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const slots = useMemo(() => ({ title, header, panel, setPage }), [title, header, panel]);
  const currentSessionId = page?.currentSessionId;

  return (
    <ShellSlots.Provider value={slots}>
      <Human2AiAppShell
        {...panelWidths}
        className={page?.className}
        title={page?.hasTitle ? <span ref={setTitle} /> : null}
        headerExtra={page?.hasHeaderExtra ? <div ref={setHeader} style={{ display: "contents" }} /> : undefined}
        rightPanel={page?.hasRightPanel ? <div ref={setPanel} style={{ display: "contents" }} /> : undefined}
        rightPanelOpen={page?.rightPanelOpen}
        onRightPanelOpenChange={page?.onRightPanelOpenChange}
        titleExtra={currentSessionId ? (
          <ActionButton
            key={currentSessionId}
            size="small"
            label={t("sessionDetails.copyId")}
            pendingLabel={t("sessionDetails.copying")}
            successLabel={t("clipboard.copied")}
            errorLabel={t("sessionDetails.copyFailed")}
            idleIcon={<CopyOutlined aria-hidden="true" />}
            onAction={() => navigator.clipboard.writeText(currentSessionId)}
          />
        ) : undefined}
        brand={(
          <Link href="/" className="human2ai-app-shell__brand">
            <img className="human2ai-app-shell__brand-icon" src="/brand/h2a.svg" alt="" width={24} height={24} />
            {t("app.title")}
          </Link>
        )}
        labels={{
          productName: t("app.title"),
          sidebar: t("shell.sidebar"),
          navigation: t("shell.navigation"),
          collapseSidebar: t("shell.collapseSidebar"),
          expandSidebar: t("shell.expandSidebar"),
          resizeSidebar: t("shell.resizeSidebar"),
          rightPanel: t("shell.rightPanel"),
          collapseRightPanel: t("shell.collapseRightPanel"),
          expandRightPanel: t("shell.expandRightPanel"),
          resizeRightPanel: t("shell.resizeRightPanel"),
        }}
        sidebar={(
          <WorkspaceSidebar
            currentSessionId={currentSessionId}
            onCurrentSessionRename={page?.onCurrentSessionRename}
          />
        )}
      >{children}</Human2AiAppShell>
    </ShellSlots.Provider>
  );
}

// Canvas drafts change on every keystroke; only navigation inputs invalidate the sidebar.
const WorkspaceSidebar = memo(function WorkspaceSidebar({
  currentSessionId,
  onCurrentSessionRename,
}: Pick<Human2AiShellProps, "currentSessionId" | "onCurrentSessionRename">) {
  const router = useRouter();
  const { i18n, t } = useTranslation();
  const [projects, setProjects] = useState<Human2AiProject[]>([]);
  const [sessions, setSessions] = useState<Human2AiSession[]>([]);
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const hasUnassignedSessions = sessions.some(session => session.projectId === null);
  const containerKeys = useMemo(() => [...projects.map(project => `project:${project.id}`),
    ...groups.map(group => `group:${group.id}`), ...(hasUnassignedSessions ? ["project:unassigned"] : [])],
    [projects, groups, hasUnassignedSessions]);
  const treeExpansion = useWorkspaceTreeExpansion(containerKeys);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void Promise.all([listProjects(), listSessions(), listSessionGroups()])
      .then(([nextProjects, nextSessions, nextGroups]) => {
        if (cancelled) return;
        setProjects(nextProjects);
        setSessions(nextSessions);
        setGroups(nextGroups);
      })
      .catch(() => {
        if (!cancelled) setLoadError(t("workspaceSidebar.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt, t]);

  // Home and editor actions can create sessions outside this persistent sidebar.
  // Fetch only an unknown selected session; ordinary navigation needs no reload.
  useEffect(() => {
    if (loading || !currentSessionId || sessions.some(session => session.id === currentSessionId)) return;
    let cancelled = false;
    void getSession(currentSessionId).then(session => {
      if (!cancelled) setSessions(current => current.some(item => item.id === session.id) ? current : [session, ...current]);
    }).catch(() => { /* The active page owns missing-session feedback. */ });
    return () => { cancelled = true; };
  }, [currentSessionId, loading, sessions]);

  const rememberCreatedSession = useCallback((session: Human2AiSession, groupId?: string): void => {
    if (groupId) setGroups(current => current.map(group => group.id === groupId
      ? { ...group, sessionIds: [...group.sessionIds, session.id] }
      : group));
    setSessions(current => [session, ...current]);
  }, []);

  // Event handlers read the latest committed list without invalidating every row.
  const committedSessions = useRef(sessions);
  useLayoutEffect(() => { committedSessions.current = sessions; }, [sessions]);
  const committedNavigation = useRef({ currentSessionId, onCurrentSessionRename });
  useLayoutEffect(() => {
    committedNavigation.current = { currentSessionId, onCurrentSessionRename };
  }, [currentSessionId, onCurrentSessionRename]);
  const groupSession = useCallback(async (sessionId: string, groupId: string | null) => {
    const session = committedSessions.current.find(item => item.id === sessionId);
    if (!session?.projectId) throw new Error("SESSION_NOT_FOUND");
    await setSessionGroup(session.projectId, sessionId, groupId);
    setGroups(current => current.map(group => group.id === groupId
      ? { ...group, sessionIds: [...group.sessionIds.filter(id => id !== sessionId), sessionId] }
      : group.sessionIds.includes(sessionId) ? { ...group, sessionIds: group.sessionIds.filter(id => id !== sessionId) } : group));
  }, []);

  const createSessionActions = useMemo(() => ({
    onCreateComposition: async (projectId?: string, groupId?: string) => {
      const session = await createCompositionSession(
        t("composition.session.untitled"),
        projectId ?? null,
        undefined,
        groupId,
      );
      rememberCreatedSession(session, groupId);
      router.push(`/composition?session=${encodeURIComponent(session.id)}`);
    },
    onCreateSpatial: async (projectId?: string, groupId?: string) => {
      const session = await createSpatialSession(t("spatial.untitled"), projectId ?? null, undefined, groupId);
      rememberCreatedSession(session, groupId);
      router.push(`/spatial?session=${encodeURIComponent(session.id)}`);
    },
    onCreateUiSketch: async (projectId?: string, groupId?: string) => {
      const session = await createUiSketchSession(
        t("uiSketch.session.untitled"),
        projectId ?? null,
        undefined,
        groupId,
      );
      rememberCreatedSession(session, groupId);
      router.push(`/ui-sketch?session=${encodeURIComponent(session.id)}`);
    },
  }), [router, t, rememberCreatedSession]);

  const labels = useMemo<Human2AiWorkspaceSidebarLabels>(() => ({
    functionArea: t("workspaceSidebar.functionArea"),
    projectArea: t("workspaceSidebar.projectArea"),
    newComposition: t("workspaceSidebar.newComposition"),
    newCompositionInProject: (projectName) => t(
      "workspaceSidebar.newCompositionInProject",
      { project: projectName },
    ),
    newCompositionInGroup: group => t("workspaceSidebar.newCompositionInGroup", { group }),
    newSpatial: t("spatial.newSpace"),
    newSpatialInProject: project => t("spatial.newInProject", { project }),
    newSpatialInGroup: group => t("spatial.newInGroup", { group }),
    spatialSession: t("spatial.title"),
    newUiSketch: t("workspaceSidebar.newUiSketch"),
    newUiSketchInProject: (projectName) => t(
      "workspaceSidebar.newUiSketchInProject",
      { project: projectName },
    ),
    newUiSketchInGroup: group => t("workspaceSidebar.newUiSketchInGroup", { group }),
    newProject: t("workspaceSidebar.newProject"),
    styleLibrary: t("styleLibrary.title"),
    projectNamePlaceholder: t("workspaceSidebar.projectNamePlaceholder"),
    createProject: t("actions.create"),
    unassigned: t("workspaceSidebar.unassigned"),
    containsCurrentSession: t("workspaceSidebar.containsCurrentSession"),
    imageCompositionSession: t("workspaceSidebar.imageCompositionSession"),
    uiLayoutSession: t("workspaceSidebar.uiLayoutSession"),
    sessionActions: t("workspaceSidebar.sessionActions"),
    projectActions: t("workspaceSidebar.projectActions"),
    newSessionGroup: t("workspaceSidebar.newSessionGroup"),
    sessionGroupName: t("workspaceSidebar.sessionGroupName"),
    sessionGroupActions: t("workspaceSidebar.sessionGroupActions"),
    renameSessionGroup: t("workspaceSidebar.renameSessionGroup"),
    deleteSessionGroup: t("workspaceSidebar.deleteSessionGroup"),
    deleteSessionGroupDescription: t("workspaceSidebar.deleteSessionGroupDescription"),
    sessionGroupNameConflict: t("workspaceSidebar.sessionGroupNameConflict"),
    groupSession: t("workspaceSidebar.groupSession"),
    ungroupedSessions: t("workspaceSidebar.ungroupedSessions"),
    rename: t("actions.rename"),
    confirmRename: t("workspaceSidebar.confirmRename"),
    move: t("actions.move"),
    moveSessionTitle: t("workspaceSidebar.moveSessionTitle"),
    selectProject: t("workspaceSidebar.selectProject"),
    moveUnavailable: t("workspaceSidebar.moveUnavailable"),
    delete: t("actions.delete"),
    projectNameConflict: t("workspaceSidebar.projectNameConflict"),
    renameProjectTitle: t("workspaceSidebar.renameProjectTitle"),
    deleteProjectTitle: t("workspaceSidebar.deleteProjectTitle"),
    deleteProjectDescription: t("workspaceSidebar.deleteProjectDescription"),
    deleteProjectDisabled: t("workspaceSidebar.deleteProjectDisabled"),
    renameSessionTitle: t("workspaceSidebar.renameSessionTitle"),
    renameSessionPlaceholder: t("workspaceSidebar.renameSessionPlaceholder"),
    deleteSessionTitle: t("workspaceSidebar.deleteSessionTitle"),
    deleteSessionDescription: t("workspaceSidebar.deleteSessionDescription"),
    cancel: t("actions.cancel"),
    loading: t("workspaceSidebar.loading"),
    loadFailed: t("workspaceSidebar.loadFailed"),
    retry: t("actions.retry"),
    actionFailed: t("errors.operationFailed"),
  }), [t]);
  return (
    <Human2AiWorkspaceSidebar
      projects={projects}
      sessions={sessions}
      groups={groups}
      currentSessionId={currentSessionId}
      {...treeExpansion}
      loading={loading}
      errorMessage={loadError}
      footerExtra={<WorkspaceSettings onRestored={() => setLoadAttempt(attempt => attempt + 1)} />}
      repositoryLink={{ href: "https://github.com/yisi-ai/human2ai", label: t("app.repositoryLink", { productName: t("app.title") }) }}
      languageSelector={{
        "aria-label": t("language.selectorLabel"),
        onChange: (nextLocale) => {
          if (isAppLocale(nextLocale)) void i18n.changeLanguage(nextLocale);
        },
        options: languageOptions,
        placement: "top",
        value: resolveAppLocale(i18n.resolvedLanguage),
      }}
      labels={labels}
      {...createSessionActions}
      onCreateProject={async (name) => {
        const project = await createProject(name);
        setProjects((current) => [project, ...current]);
      }}
      onOpenStyleLibrary={() => router.push("/styles")}
      onCreateGroup={async (projectId, name) => {
        const group = await createSessionGroup(projectId, name);
        setGroups(current => [...current, group]);
      }}
      onRenameGroup={async (groupId, name) => {
        const group = groups.find(item => item.id === groupId);
        if (!group) throw new Error("SESSION_GROUP_NOT_FOUND");
        const renamed = await renameSessionGroup(groupId, name, group.revision);
        setGroups(current => current.map(item => item.id === groupId ? renamed : item));
      }}
      onDeleteGroup={async groupId => {
        const group = groups.find(item => item.id === groupId);
        if (!group) throw new Error("SESSION_GROUP_NOT_FOUND");
        await deleteSessionGroup(groupId, group.revision);
        setGroups(current => current.filter(item => item.id !== groupId));
      }}
      onGroupSession={groupSession}
      onRenameProject={async (projectId, name) => {
        const project = projects.find((item) => item.id === projectId);
        if (!project) throw new Error("PROJECT_NOT_FOUND");
        const renamed = await renameProject(projectId, name, project.revision);
        setProjects((current) =>
          current.map((item) => (item.id === projectId ? renamed : item)),
        );
      }}
      onDeleteProject={async (projectId) => {
        const project = projects.find((item) => item.id === projectId);
        if (!project) throw new Error("PROJECT_NOT_FOUND");
        await deleteProject(projectId, project.revision);
        setProjects((current) => current.filter((item) => item.id !== projectId));
        setGroups(current => current.filter(group => group.projectId !== projectId));
      }}
      onOpenSession={(sessionId) => {
        const session = sessions.find((item) => item.id === sessionId);
        if (!session) return;
        const pathname = session.sessionType === "spatial" ? "/spatial" : session.sessionType === "ui-layout"
          ? "/ui-sketch"
          : "/composition";
        router.push(`${pathname}?session=${encodeURIComponent(sessionId)}`);
      }}
      onRenameSession={async (sessionId, title) => {
        const session = sessions.find((item) => item.id === sessionId);
        if (!session) throw new Error("SESSION_NOT_FOUND");
        const renamed = await renameSession(sessionId, title, session.revision);
        setSessions((current) =>
          current.map((item) => (item.id === sessionId ? renamed : item)),
        );
        const navigation = committedNavigation.current;
        if (navigation.currentSessionId === sessionId) navigation.onCurrentSessionRename?.(renamed.title);
      }}
      onMoveSession={async (sessionId, projectId) => {
        const session = sessions.find((item) => item.id === sessionId);
        if (!session) throw new Error("SESSION_NOT_FOUND");
        const moved = await moveSession(sessionId, projectId, session.revision);
        setGroups(current => current.map(group => group.sessionIds.includes(sessionId)
          ? { ...group, sessionIds: group.sessionIds.filter(id => id !== sessionId) } : group));
        setSessions((current) =>
          current.map((item) => (item.id === sessionId ? moved : item)),
        );
      }}
      onDeleteSession={async (sessionId) => {
        const session = sessions.find((item) => item.id === sessionId);
        if (!session) throw new Error("SESSION_NOT_FOUND");
        await deleteSession(sessionId, session.revision);
        setGroups(current => current.map(group => group.sessionIds.includes(sessionId)
          ? { ...group, sessionIds: group.sessionIds.filter(id => id !== sessionId) } : group));
        setSessions((current) => current.filter((item) => item.id !== sessionId));
        if (committedNavigation.current.currentSessionId === sessionId) router.push("/");
      }}
      onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
    />
  );
});
