"use client";

import {
  Human2AiAppShell,
  Human2AiWorkspaceSidebar,
  type Human2AiAppShellProps,
} from "@human2ai/ui";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { isAppLocale, resolveAppLocale } from "../i18n/createI18n";
import {
  createCompositionSession,
  createUiSketchSession,
  createSpatialSession,
  createProject,
  deleteProject,
  deleteSession,
  listProjects,
  listSessions,
  moveSession,
  renameProject,
  renameSession,
  type Human2AiProject,
  type Human2AiSession,
} from "../lib/human2ai-api";

type Human2AiShellProps = Omit<Human2AiAppShellProps, "labels" | "sidebar"> & {
  currentSessionId?: string | null;
  onCurrentSessionRename?: (title: string) => void;
};

const languageOptions = [
  { value: "zh-CN", label: "中文" },
  { value: "en", label: "EN" },
] as const;

export function Human2AiShell({
  currentSessionId = null,
  onCurrentSessionRename,
  ...props
}: Human2AiShellProps) {
  const router = useRouter();
  const { i18n, t } = useTranslation();
  const [projects, setProjects] = useState<Human2AiProject[]>([]);
  const [sessions, setSessions] = useState<Human2AiSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void Promise.all([listProjects(), listSessions()])
      .then(([nextProjects, nextSessions]) => {
        if (cancelled) return;
        setProjects(nextProjects);
        setSessions(nextSessions);
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

  return (
    <Human2AiAppShell
      {...props}
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
        rightPanel: t("shell.rightPanel"),
        collapseRightPanel: t("shell.collapseRightPanel"),
        expandRightPanel: t("shell.expandRightPanel"),
      }}
      sidebar={(
        <Human2AiWorkspaceSidebar
          projects={projects}
          sessions={sessions}
          currentSessionId={currentSessionId}
          loading={loading}
          errorMessage={loadError}
          languageSelector={{
            "aria-label": t("language.selectorLabel"),
            onChange: (nextLocale) => {
              if (isAppLocale(nextLocale)) void i18n.changeLanguage(nextLocale);
            },
            options: languageOptions,
            placement: "top",
            value: resolveAppLocale(i18n.resolvedLanguage),
          }}
          labels={{
            functionArea: t("workspaceSidebar.functionArea"),
            projectArea: t("workspaceSidebar.projectArea"),
            newComposition: t("workspaceSidebar.newComposition"),
            newCompositionInProject: (projectName) => t(
              "workspaceSidebar.newCompositionInProject",
              { project: projectName },
            ),
            newSpatial: t("spatial.newSpace"),
            newSpatialInProject: project => t("spatial.newInProject", { project }),
            spatialSession: t("spatial.title"),
            newUiSketch: t("workspaceSidebar.newUiSketch"),
            newUiSketchInProject: (projectName) => t(
              "workspaceSidebar.newUiSketchInProject",
              { project: projectName },
            ),
            newProject: t("workspaceSidebar.newProject"),
            styleLibrary: t("styleLibrary.title"),
            projectNamePlaceholder: t("workspaceSidebar.projectNamePlaceholder"),
            createProject: t("actions.create"),
            unassigned: t("workspaceSidebar.unassigned"),
            imageCompositionSession: t("workspaceSidebar.imageCompositionSession"),
            uiLayoutSession: t("workspaceSidebar.uiLayoutSession"),
            sessionActions: t("workspaceSidebar.sessionActions"),
            projectActions: t("workspaceSidebar.projectActions"),
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
          }}
          onCreateComposition={async (projectId) => {
            const session = await createCompositionSession(
              t("composition.session.untitled"),
              projectId ?? null,
            );
            setSessions((current) => [session, ...current]);
            router.push(`/composition?session=${encodeURIComponent(session.id)}`);
          }}
          onCreateSpatial={async projectId => {
            const session = await createSpatialSession(t("spatial.untitled"), projectId ?? null);
            setSessions(current => [session, ...current]);
            router.push(`/spatial?session=${encodeURIComponent(session.id)}`);
          }}
          onCreateUiSketch={async (projectId) => {
            const session = await createUiSketchSession(
              t("uiSketch.session.untitled"),
              projectId ?? null,
            );
            setSessions((current) => [session, ...current]);
            router.push(`/ui-sketch?session=${encodeURIComponent(session.id)}`);
          }}
          onCreateProject={async (name) => {
            const project = await createProject(name);
            setProjects((current) => [project, ...current]);
          }}
          onOpenStyleLibrary={() => router.push("/styles")}
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
            if (currentSessionId === sessionId) onCurrentSessionRename?.(renamed.title);
          }}
          onMoveSession={async (sessionId, projectId) => {
            const session = sessions.find((item) => item.id === sessionId);
            if (!session) throw new Error("SESSION_NOT_FOUND");
            const moved = await moveSession(sessionId, projectId, session.revision);
            setSessions((current) =>
              current.map((item) => (item.id === sessionId ? moved : item)),
            );
          }}
          onDeleteSession={async (sessionId) => {
            const session = sessions.find((item) => item.id === sessionId);
            if (!session) throw new Error("SESSION_NOT_FOUND");
            await deleteSession(sessionId, session.revision);
            setSessions((current) => current.filter((item) => item.id !== sessionId));
            if (currentSessionId === sessionId) router.push("/");
          }}
          onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
        />
      )}
    />
  );
}
