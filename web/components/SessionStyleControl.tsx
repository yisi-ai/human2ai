"use client";

import { SessionStylePicker } from "@human2ai/ui";
import { useTranslation } from "react-i18next";

import type { StyleProcessing } from "../../src/domain/session";
import { styleReferenceContentUrl, type StyleCategory } from "../lib/human2ai-api";
import { getStyleLibraryLabels } from "../lib/style-library-labels";
import type { useSessionStyle } from "../lib/use-session-style";

export function SessionStyleControl({ controller, category, processing, disabled }: {
  controller: ReturnType<typeof useSessionStyle>;
  category: StyleCategory;
  processing?: StyleProcessing;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const style = controller.currentStyle;
  return <SessionStylePicker
    styles={controller.styles}
    currentStyle={style}
    category={category}
    labels={{ title: t("sessionStyle.label"), choose: t("sessionStyle.choose"),
      dialogTitle: t("sessionStyle.dialogTitle"), unbind: t("sessionStyle.unbind"),
      select: t("sessionStyle.select"), pending: t("sessionStyle.pending") }}
    libraryLabels={getStyleLibraryLabels(t)}
    imageUrl={styleReferenceContentUrl}
    onBind={controller.bind}
    onRetry={controller.refresh}
    loading={controller.loading}
    saving={controller.saving}
    error={controller.error}
    disabled={disabled}
    pending={Boolean(style && (processing?.styleId !== style.id || processing.styleRevision !== style.revision))}
  />;
}
