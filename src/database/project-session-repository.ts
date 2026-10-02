import { randomUUID } from "node:crypto";

import {
  SESSION_TYPES,
  type Project,
  type Session,
  type SessionGroup,
  type SessionLifecycleStage,
  type SessionType,
} from "../domain/session/index.ts";
import type { TrashSession } from "../domain/session/types.ts";
import type { DatabaseConnection } from "./migrate.ts";

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  revision: number;
  session_count: number;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  id: string;
  project_id: string | null;
  style_id: string | null;
  session_type: SessionType;
  title: string;
  lifecycle_stage: SessionLifecycleStage;
  revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export class ProjectNotFoundError extends Error {
  readonly code = "PROJECT_NOT_FOUND";

  constructor(readonly projectId: string) {
    super(`Project not found: ${projectId}`);
  }
}

export class ProjectNameConflictError extends Error {
  readonly code = "PROJECT_NAME_CONFLICT";

  constructor(readonly name: string) {
    super(`Project name already exists: ${name}`);
  }
}

export class ProjectNotEmptyError extends Error {
  readonly code = "PROJECT_NOT_EMPTY";

  constructor(
    readonly projectId: string,
    readonly sessionCount: number,
  ) {
    super(`Project contains ${sessionCount} session(s): ${projectId}`);
  }
}

export class SessionNotFoundError extends Error {
  readonly code = "SESSION_NOT_FOUND";

  constructor(readonly sessionId: string) {
    super(`Session not found: ${sessionId}`);
  }
}

export class RevisionConflictError extends Error {
  readonly code = "REVISION_CONFLICT";

  constructor(
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(`Expected revision ${expectedRevision}, received ${actualRevision}`);
  }
}

export class InvalidRecordError extends Error {
  readonly code = "INVALID_RECORD";
}

export class SessionGroupNotFoundError extends Error {
  readonly code = "SESSION_GROUP_NOT_FOUND";
  constructor(groupId: string) { super(`Session group not found: ${groupId}`); }
}

export class SessionGroupNameConflictError extends Error {
  readonly code = "SESSION_GROUP_NAME_CONFLICT";
  constructor(name: string) { super(`Session group name already exists: ${name}`); }
}

export class ProjectSessionRepository {
  constructor(private readonly database: DatabaseConnection, private readonly now: () => number = Date.now) {}

  listSessionGroups(): SessionGroup[] {
    const groups = this.database.prepare<[], Omit<SessionGroup, "sessionIds">>(
      "SELECT id, project_id AS projectId, name, revision FROM session_groups ORDER BY rowid",
    ).all();
    const members = this.database.prepare<[], { sessionId: string; groupId: string }>(
      `SELECT member.session_id AS sessionId, member.group_id AS groupId FROM session_group_members member
       JOIN sessions session ON session.id = member.session_id WHERE session.deleted_at IS NULL ORDER BY member.session_id`,
    ).all();
    const byGroup = new Map<string, string[]>();
    for (const member of members) {
      const ids = byGroup.get(member.groupId) ?? [];
      ids.push(member.sessionId);
      byGroup.set(member.groupId, ids);
    }
    return groups.map(group => ({ ...group, sessionIds: byGroup.get(group.id) ?? [] }));
  }

  private getSessionGroup(groupId: string): SessionGroup {
    const group = this.database.prepare<[string], Omit<SessionGroup, "sessionIds">>(
      "SELECT id, project_id AS projectId, name, revision FROM session_groups WHERE id = ?",
    ).get(groupId);
    if (!group) throw new SessionGroupNotFoundError(groupId);
    const members = this.database.prepare<[string], { id: string }>(
      `SELECT member.session_id AS id FROM session_group_members member JOIN sessions session ON session.id = member.session_id
       WHERE member.group_id = ? AND session.deleted_at IS NULL ORDER BY member.session_id`,
    ).all(groupId);
    return { ...group, sessionIds: members.map(member => member.id) };
  }

  private sessionGroupName(projectId: string, value: string, excludedId = ""): string {
    const name = requiredText(value, "Session group name");
    if (name.length > 200) throw new InvalidRecordError("Session group name is too long");
    if (this.database.prepare("SELECT id FROM session_groups WHERE project_id = ? AND name = ? AND id <> ?").get(projectId, name, excludedId)) {
      throw new SessionGroupNameConflictError(name);
    }
    return name;
  }

  createSessionGroup(projectId: string, input: { name: string }): SessionGroup {
    return this.database.transaction(() => {
      this.getProject(projectId);
      const name = this.sessionGroupName(projectId, input.name);
      const id = randomUUID();
      this.database.prepare("INSERT INTO session_groups (id, project_id, name) VALUES (?, ?, ?)").run(id, projectId, name);
      return this.getSessionGroup(id);
    })();
  }

  renameSessionGroup(groupId: string, input: { name: string; expectedRevision: number }): SessionGroup {
    return this.database.transaction(() => {
      const group = this.getSessionGroup(groupId);
      assertRevision(input.expectedRevision, group.revision);
      const name = this.sessionGroupName(group.projectId, input.name, groupId);
      this.database.prepare("UPDATE session_groups SET name = ?, revision = revision + 1 WHERE id = ?").run(name, groupId);
      return this.getSessionGroup(groupId);
    })();
  }

  deleteSessionGroup(groupId: string, input: { expectedRevision: number }): void {
    this.database.transaction(() => {
      assertRevision(input.expectedRevision, this.getSessionGroup(groupId).revision);
      this.database.prepare("DELETE FROM session_groups WHERE id = ?").run(groupId);
    })();
  }

  setSessionGroup(projectId: string, sessionId: string, groupId: string | null): void {
    this.database.transaction(() => {
      this.getProject(projectId);
      const session = this.getSession(sessionId);
      if (session.projectId !== projectId || (groupId !== null && this.getSessionGroup(groupId).projectId !== projectId)) {
        throw new InvalidRecordError("Session and group must belong to the same project");
      }
      if (groupId === null) {
        this.database.prepare("DELETE FROM session_group_members WHERE session_id = ?").run(sessionId);
      } else {
        this.database.prepare(`INSERT INTO session_group_members (session_id, group_id) VALUES (?, ?)
          ON CONFLICT(session_id) DO UPDATE SET group_id = excluded.group_id`).run(sessionId, groupId);
      }
    })();
  }

  listProjects(): Project[] {
    const rows = this.database
      .prepare<[], ProjectRow>(`
        SELECT
          p.id,
          p.name,
          p.description,
          p.revision,
          p.created_at,
          p.updated_at,
          count(s.id) AS session_count
        FROM projects p
        LEFT JOIN sessions s ON s.project_id = p.id AND s.deleted_at IS NULL
        GROUP BY p.id
        ORDER BY p.updated_at DESC, p.id
      `)
      .all();
    return rows.map(mapProject);
  }

  getProject(projectId: string): Project {
    const row = this.database
      .prepare<[string], ProjectRow>(`
        SELECT
          p.id,
          p.name,
          p.description,
          p.revision,
          p.created_at,
          p.updated_at,
          count(s.id) AS session_count
        FROM projects p
        LEFT JOIN sessions s ON s.project_id = p.id AND s.deleted_at IS NULL
        WHERE p.id = ?
        GROUP BY p.id
      `)
      .get(projectId);
    if (!row) throw new ProjectNotFoundError(projectId);
    return mapProject(row);
  }

  createProject(input: { name: string; description?: string | null }): Project {
    const name = requiredText(input.name, "Project name");
    this.assertProjectNameAvailable(name);
    const description = optionalText(input.description);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.database
      .prepare(
        `INSERT INTO projects
          (id, name, description, revision, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)`,
      )
      .run(id, name, description, now, now);
    return this.getProject(id);
  }

  updateProject(
    projectId: string,
    input: {
      expectedRevision: number;
      name?: string;
      description?: string | null;
    },
  ): Project {
    const project = this.getProject(projectId);
    assertRevision(input.expectedRevision, project.revision);
    const name =
      input.name === undefined ? project.name : requiredText(input.name, "Project name");
    if (name !== project.name) this.assertProjectNameAvailable(name, projectId);
    const description =
      input.description === undefined ? project.description : optionalText(input.description);
    const now = new Date().toISOString();
    this.database
      .prepare(
        `UPDATE projects
         SET name = ?, description = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND revision = ?`,
      )
      .run(name, description, now, projectId, input.expectedRevision);
    return this.getProject(projectId);
  }

  deleteProject(
    projectId: string,
    input: { expectedRevision: number },
  ): void {
    const project = this.getProject(projectId);
    assertRevision(input.expectedRevision, project.revision);
    if (project.sessionCount > 0) {
      throw new ProjectNotEmptyError(projectId, project.sessionCount);
    }
    this.database
      .prepare(
        `DELETE FROM projects
         WHERE id = ? AND revision = ?
           AND NOT EXISTS (SELECT 1 FROM sessions WHERE project_id = ? AND deleted_at IS NULL)`,
      )
      .run(projectId, input.expectedRevision, projectId);
  }

  listSessions(): Session[] {
    return this.selectSessions("", []);
  }

  listUnassignedSessions(): Session[] {
    return this.selectSessions("WHERE project_id IS NULL", []);
  }

  listProjectSessions(projectId: string): Session[] {
    this.getProject(projectId);
    return this.selectSessions("WHERE project_id = ?", [projectId]);
  }

  getSession(sessionId: string): Session {
    const row = this.database
      .prepare<[string], SessionRow>(`${SESSION_SELECT} WHERE id = ? AND deleted_at IS NULL`)
      .get(sessionId);
    if (!row) throw new SessionNotFoundError(sessionId);
    return mapSession(row);
  }

  createSession(input: {
    sessionType: SessionType;
    title: string;
    projectId?: string | null;
    groupId?: string;
  }): Session {
    if (!SESSION_TYPES.includes(input.sessionType)) {
      throw new InvalidRecordError(`Unsupported session type: ${input.sessionType}`);
    }
    const title = requiredText(input.title, "Session title");
    const projectId = input.projectId ?? null;
    if (projectId) this.getProject(projectId);
    const id = randomUUID();
    const now = new Date().toISOString();

    this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO sessions
            (id, project_id, session_type, title, lifecycle_stage, revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'draft', 1, ?, ?)`,
        )
        .run(id, projectId, input.sessionType, title, now, now);
      if (input.sessionType === "image-composition") {
        this.database
          .prepare("INSERT INTO composition_sessions (session_id) VALUES (?)")
          .run(id);
      } else if (input.sessionType === "spatial") {
        this.database.prepare("INSERT INTO spatial_sessions (session_id) VALUES (?)").run(id);
      } else {
        this.database.prepare("INSERT INTO ui_sessions (session_id) VALUES (?)").run(id);
      }
      if (input.groupId !== undefined) {
        if (!projectId) throw new InvalidRecordError("Session and group must belong to the same project");
        this.setSessionGroup(projectId, id, input.groupId);
      }
    })();

    return this.getSession(id);
  }

  moveSession(
    sessionId: string,
    input: { projectId: string | null; expectedRevision: number },
  ): Session {
    const session = this.getSession(sessionId);
    assertRevision(input.expectedRevision, session.revision);
    if (input.projectId) this.getProject(input.projectId);
    if (session.projectId === input.projectId) return session;

    const now = new Date().toISOString();
    this.database
      .prepare(
        `UPDATE sessions
         SET project_id = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND revision = ?`,
      )
      .run(input.projectId, now, sessionId, input.expectedRevision);
    return this.getSession(sessionId);
  }

  renameSession(
    sessionId: string,
    input: { title: string; expectedRevision: number },
  ): Session {
    const session = this.getSession(sessionId);
    assertRevision(input.expectedRevision, session.revision);
    const title = requiredText(input.title, "Session title");
    if (session.title === title) return session;

    const now = new Date().toISOString();
    this.database
      .prepare(
        `UPDATE sessions
         SET title = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND revision = ?`,
      )
      .run(title, now, sessionId, input.expectedRevision);
    return this.getSession(sessionId);
  }

  deleteSession(
    sessionId: string,
    input: { expectedRevision: number },
  ): void {
    const session = this.getSession(sessionId);
    assertRevision(input.expectedRevision, session.revision);
    this.database
      .prepare("UPDATE sessions SET deleted_at = ?, updated_at = ?, revision = revision + 1 WHERE id = ? AND revision = ?")
      .run(new Date(this.now()).toISOString(), new Date(this.now()).toISOString(), sessionId, input.expectedRevision);
  }

  listTrashSessions(): TrashSession[] {
    return this.database.prepare<[], SessionRow>(`${SESSION_SELECT} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC, id`)
      .all().map(row => ({ ...mapSession(row), deletedAt: row.deleted_at! }));
  }

  restoreSession(sessionId: string, input: { expectedRevision: number }): Session {
    return this.database.transaction(() => {
      const row = this.database.prepare<[string], SessionRow>(`${SESSION_SELECT} WHERE id = ? AND deleted_at IS NOT NULL`).get(sessionId);
      if (!row) throw new SessionNotFoundError(sessionId);
      assertRevision(input.expectedRevision, row.revision);
      this.database.prepare("UPDATE sessions SET deleted_at = NULL, revision = revision + 1, updated_at = ? WHERE id = ?")
        .run(new Date(this.now()).toISOString(), sessionId);
      // Trash suspends image collection; restoring restarts the unused-image grace period.
      this.database.prepare("UPDATE image_assets SET unreferenced_since = NULL WHERE session_id = ?").run(sessionId);
      return this.getSession(sessionId);
    })();
  }

  purgeExpiredTrash(cutoff: string): number {
    return this.database.prepare("DELETE FROM sessions WHERE deleted_at IS NOT NULL AND deleted_at <= ?").run(cutoff).changes;
  }

  deleteTrashSession(sessionId: string, input: { expectedRevision: number }): void {
    this.database.transaction(() => {
      const row = this.database.prepare<[string], SessionRow>(`${SESSION_SELECT} WHERE id = ? AND deleted_at IS NOT NULL`).get(sessionId);
      if (!row) throw new SessionNotFoundError(sessionId);
      assertRevision(input.expectedRevision, row.revision);
      this.database.prepare("DELETE FROM sessions WHERE id = ? AND deleted_at IS NOT NULL").run(sessionId);
    })();
  }

  clearTrash(): void {
    this.database.prepare("DELETE FROM sessions WHERE deleted_at IS NOT NULL").run();
  }

  private selectSessions(where: string, parameters: string[]): Session[] {
    const rows = this.database
      .prepare<string[], SessionRow>(`${SESSION_SELECT} ${where ? `${where} AND` : "WHERE"} deleted_at IS NULL ORDER BY updated_at DESC, id`)
      .all(...parameters);
    return rows.map(mapSession);
  }

  private assertProjectNameAvailable(name: string, excludedProjectId?: string): void {
    const existing = excludedProjectId
      ? this.database
          .prepare<[string, string], { id: string }>(
            "SELECT id FROM projects WHERE name = ? AND id <> ? LIMIT 1",
          )
          .get(name, excludedProjectId)
      : this.database
          .prepare<[string], { id: string }>(
            "SELECT id FROM projects WHERE name = ? LIMIT 1",
          )
          .get(name);
    if (existing) throw new ProjectNameConflictError(name);
  }
}

const SESSION_SELECT = `
  SELECT
    id,
    project_id,
    style_id,
    session_type,
    title,
    lifecycle_stage,
    revision,
    created_at,
    updated_at,
    deleted_at
  FROM sessions
`;

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    revision: row.revision,
    sessionCount: row.session_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    projectId: row.project_id,
    styleId: row.style_id,
    sessionType: row.session_type,
    title: row.title,
    lifecycleStage: row.lifecycle_stage,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requiredText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new InvalidRecordError(`${label} cannot be empty`);
  return trimmed;
}

function optionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function assertRevision(expectedRevision: number, actualRevision: number): void {
  if (expectedRevision !== actualRevision) {
    throw new RevisionConflictError(expectedRevision, actualRevision);
  }
}
