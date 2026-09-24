"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Human2AiShell } from "../components/Human2AiShell";
import { HomeView, type HomeSessionKind } from "../components/HomeView";
import { createCompositionSession, createUiSketchSession, createSpatialSession } from "../lib/human2ai-api";

export default function Home() {
  const router = useRouter();
  const { t } = useTranslation();
  const creating = useRef(false);
  const [pending, setPending] = useState<HomeSessionKind | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function createSession(kind: HomeSessionKind) {
    if (creating.current) return;
    creating.current = true;
    setPending(kind);
    setErrorMessage(null);
    try {
      const session = kind === "composition"
        ? await createCompositionSession(t("composition.session.untitled"))
        : kind === "ui-sketch"
          ? await createUiSketchSession(t("uiSketch.session.untitled"))
          : await createSpatialSession(t("spatial.untitled"));
      router.push(`/${kind}?session=${encodeURIComponent(session.id)}`);
    } catch {
      creating.current = false;
      setPending(null);
      setErrorMessage(t("errors.operationFailed"));
    }
  }

  return (
    <Human2AiShell title={null}>
      <HomeView
        productName={t("app.title")}
        repositoryLabel={t("app.repositoryLink", { productName: t("app.title") })}
        description={t("home.description")}
        skillInstallation={{
          title: t("home.skillInstallation.title"),
          agentTab: t("home.skillInstallation.agentTab"),
          cliTab: t("home.skillInstallation.cliTab"),
          agentPrompt: t("home.skillInstallation.agentPrompt"),
          copy: t("home.skillInstallation.copy"),
          copying: t("home.skillInstallation.copying"),
          copied: t("clipboard.copied"),
          copyFailed: t("home.skillInstallation.copyFailed"),
        }}
        labels={{
          composition: t("home.createComposition"),
          "ui-sketch": t("home.createUiSketch"),
          spatial: t("home.createSpatial"),
        }}
        pending={pending}
        errorMessage={errorMessage}
        onCreate={createSession}
      />
    </Human2AiShell>
  );
}
