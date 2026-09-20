"use client";

import {
  StyleLibraryView,
  type StyleLibraryDraft,
} from "@human2ai/ui";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getStyleLibraryLabels } from "../../lib/style-library-labels";
import { Human2AiShell } from "../../components/Human2AiShell";
import {
  createUserStyle,
  deleteStyle,
  deleteStyleReference,
  listStyles,
  styleReferenceContentUrl,
  updateStyle,
  uploadStyleReference,
  type StyleEntry,
} from "../../lib/human2ai-api";

export default function StylesPage() {
  const { t } = useTranslation();
  const [styles, setStyles] = useState<StyleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const refreshStyles = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true);
    try {
      const nextStyles = await listStyles();
      setStyles(nextStyles);
      setLoadError(null);
    } catch {
      if (showLoading) setLoadError(t("styleLibrary.loadFailed"));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void listStyles()
      .then((nextStyles) => {
        if (!cancelled) setStyles(nextStyles);
      })
      .catch(() => {
        if (!cancelled) setLoadError(t("styleLibrary.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const interval = window.setInterval(() => {
      if (!cancelled) void refreshStyles(false);
    }, 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [loadAttempt, refreshStyles, t]);

  async function createStyle(draft: StyleLibraryDraft): Promise<StyleEntry> {
    let style = await createUserStyle({
      name: draft.name,
      category: draft.category,
      description: draft.description,
      promptSummary: draft.promptSummary,
    });
    setStyles((current) => [style, ...current]);
    try {
      for (const file of draft.newReferenceImages) {
        style = await uploadStyleReference(style.id, file, style.revision);
        replaceStyle(style);
      }
      return style;
    } catch (error) {
      await deleteStyle(style.id, style.revision).catch(() => undefined);
      setStyles((current) => current.filter((item) => item.id !== style.id));
      throw error;
    }
  }

  async function saveStyle(
    currentStyle: StyleEntry,
    draft: StyleLibraryDraft,
  ): Promise<StyleEntry> {
    let style = currentStyle;
    try {
      if (
        style.name !== draft.name
        || style.category !== draft.category
        || style.description !== draft.description
        || style.promptSummary !== draft.promptSummary
      ) {
        style = await updateStyle(style.id, {
          expectedRevision: style.revision,
          name: draft.name,
          category: draft.category,
          description: draft.description,
          promptSummary: draft.promptSummary,
        });
        replaceStyle(style);
      }
      for (const referenceId of draft.removedReferenceImageIds) {
        if (!style.referenceImages.some((reference) => reference.id === referenceId)) continue;
        style = await deleteStyleReference(style.id, referenceId, style.revision);
        replaceStyle(style);
      }
      for (const file of draft.newReferenceImages) {
        style = await uploadStyleReference(style.id, file, style.revision);
        replaceStyle(style);
      }
      return style;
    } catch (error) {
      await refreshStyles(false);
      throw error;
    }
  }

  function replaceStyle(style: StyleEntry): void {
    setStyles((current) => current.map((item) => item.id === style.id ? style : item));
  }

  return (
    <Human2AiShell title={t("styleLibrary.title")}>
      <StyleLibraryView
        styles={styles}
        loading={loading}
        errorMessage={loadError}
        imageUrl={styleReferenceContentUrl}
        labels={getStyleLibraryLabels(t)}
        onCreate={createStyle}
        onUpdate={saveStyle}
        onDelete={async (style) => {
          await deleteStyle(style.id, style.revision);
          setStyles((current) => current.filter((item) => item.id !== style.id));
        }}
        onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
      />
    </Human2AiShell>
  );
}
