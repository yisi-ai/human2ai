"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  bindSessionStyle, getSessionStyle, Human2AiApiError, listStyles,
  type SessionStyleState, type StyleEntry,
} from "./human2ai-api";

export function useSessionStyle(
  sessionId: string | null,
  ensureSession: () => Promise<string>,
  latestRevision: number,
) {
  const { t } = useTranslation();
  const [state, setState] = useState<SessionStyleState | null>(null);
  const [styles, setStyles] = useState<StyleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const activeSession = useRef(sessionId);
  activeSession.current = sessionId;
  const binding = useRef(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let reading = false;
    setLoading(true);
    setError(null);
    const refresh = async () => {
      if (reading || binding.current) return;
      reading = true;
      const version = ++requestVersion.current;
      try {
        const [nextStyles, nextState] = await Promise.all([
          listStyles(), sessionId ? getSessionStyle(sessionId) : Promise.resolve(null),
        ]);
        if (cancelled || version !== requestVersion.current) return;
        setStyles(nextStyles);
        setState(nextState);
        setError(null);
      } catch {
        if (!cancelled && version === requestVersion.current) setError(t("styleLibrary.loadFailed"));
      } finally {
        reading = false;
        if (!cancelled && version === requestVersion.current) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [sessionId, latestRevision, attempt, t]);

  async function bind(styleId: string | null): Promise<void> {
    if (binding.current) return;
    binding.current = true;
    ++requestVersion.current;
    setSaving(true);
    setError(null);
    let targetId = sessionId;
    try {
      targetId ??= await ensureSession();
      if (activeSession.current !== null && activeSession.current !== targetId) return;
      const current = state?.session.id === targetId ? state : await getSessionStyle(targetId);
      const next = await bindSessionStyle(targetId, styleId, current.session.revision);
      if (activeSession.current === targetId || activeSession.current === null) setState(next);
    } catch (cause) {
      if (activeSession.current === targetId || activeSession.current === null) {
        setError(cause instanceof Human2AiApiError && cause.status === 409
          ? t("sessionStyle.conflict") : t("errors.operationFailed"));
      }
      throw cause;
    } finally {
      binding.current = false;
      setSaving(false);
      setLoading(false);
    }
  }

  async function readPromptLine(): Promise<string | undefined> {
    if (!sessionId) return undefined;
    const current = await getSessionStyle(sessionId);
    if (activeSession.current === sessionId) setState(current);
    return current.style ? t("sessionStyle.prompt", { summary: current.style.promptSummary }) : undefined;
  }

  return {
    styles, currentStyle: state?.session.id === sessionId ? state.style : null,
    loading, saving, error, bind, readPromptLine,
    refresh: () => setAttempt((value) => value + 1),
  };
}
