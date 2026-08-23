"use client";

import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { StatusCard } from "@human2ai/ui/yisiui/status-card";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

export default function Home() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <main style={{ padding: 32 }}>
      <StatusCard title={t("app.title")} subtitle={t("app.yisiuiReady")} />
      <div style={{ marginTop: 16 }}>
        <BasicButton type="primary" onClick={() => router.push("/composition")}>
          {t("actions.start")}
        </BasicButton>
      </div>
    </main>
  );
}
