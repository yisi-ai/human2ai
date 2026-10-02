// Browser regression: bundle with esbuild (platform=browser, jsx=automatic),
// then call runI18nHydrationRegression() in an isolated same-origin page.
// This is a manual browser check; the current CI does not run browser tests.
import { memo, Suspense, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { useTranslation } from "react-i18next";
import { AppI18nProvider } from "../../web/i18n/I18nProvider";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function waitFor(predicate: () => boolean) {
  const deadline = performance.now() + 5_000;
  while (!predicate()) {
    assert(performance.now() < deadline, "Timed out waiting for locale hydration");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

export async function runI18nHydrationRegression() {
  const saved = localStorage.getItem("human2ai.locale");
  const languages = Object.getOwnPropertyDescriptor(navigator, "languages");
  const originalLang = document.documentElement.lang;
  const originalTitle = document.title;
  const results = [];
  try {
    for (const source of ["saved", "browser"] as const) {
      for (const size of [1, 200]) {
        if (source === "saved") localStorage.setItem("human2ai.locale", "en");
        else localStorage.removeItem("human2ai.locale");
        Object.defineProperty(navigator, "languages", {
          configurable: true, value: source === "saved" ? ["zh-CN"] : ["en-US"],
        });
        let suspended = false;
        let mounted = false;
        let unrelatedRenders = 0;
        let switchLanguage!: (language: string) => Promise<unknown>;
        let release!: () => void;
        const pending = new Promise<void>(resolve => { release = resolve; });
        const errors: string[] = [];
        const Unrelated = memo(function Unrelated() {
          unrelatedRenders += 1;
          return <div data-unrelated>Unrelated content</div>;
        });
        function Mounted() {
          const { i18n } = useTranslation();
          switchLanguage = language => i18n.changeLanguage(language);
          useEffect(() => { mounted = true; }, []);
          return null;
        }
        function Translated() {
          const { t } = useTranslation();
          if (suspended) throw pending;
          return <span data-translated>{t("uiSketch.session.loading")}</span>;
        }
        const app = <AppI18nProvider>
          <Mounted /><Unrelated />
          <Suspense fallback={null}>
            {Array.from({ length: size }, (_, index) => <Translated key={index} />)}
          </Suspense>
        </AppI18nProvider>;
        const container = document.createElement("div");
        container.innerHTML = renderToString(app);
        document.body.append(container);
        const serverNodes = [...container.querySelectorAll("[data-translated]")];
        unrelatedRenders = 0;
        suspended = true;
        const root = hydrateRoot(container, app, {
          onRecoverableError: error => errors.push(String(error)),
        });
        try {
          await waitFor(() => mounted);
          // Keep Suspense pending while the parent preference effect runs.
          // A provider that exposes SSR translations and then mutates their
          // language here reproduces the reported hydration mismatch.
          await new Promise(resolve => setTimeout(resolve, 50));
          suspended = false;
          release();
          await waitFor(() => container.querySelector("[data-translated]")?.textContent === "Loading interface"
            && document.documentElement.lang === "en");
          const clientNodes = [...container.querySelectorAll("[data-translated]")];
          assert(errors.length === 0, `Hydration recovery: ${errors.join("\n")}`);
          assert(serverNodes.length === 0, "SSR must defer browser-dependent translations");
          assert(clientNodes.every(node => node.textContent === "Loading interface"), "All translation consumers must update");
          assert(unrelatedRenders === 1, "Locale restoration must not rerender unrelated memoized content");
          assert(localStorage.getItem("human2ai.locale") === "en", "Restored locale must be saved");
          await switchLanguage("zh-CN");
          await waitFor(() => clientNodes.every(node => node.textContent === "正在加载 UI 界面"));
          const switchedNodes = [...container.querySelectorAll("[data-translated]")];
          assert(clientNodes.every((node, index) => node === switchedNodes[index]), "Manual language switching must retain mounted nodes");
          assert(unrelatedRenders === 1, "Manual language switching must not rerender unrelated content");
          assert(localStorage.getItem("human2ai.locale") === "zh-CN", "Manual language choice must be saved");
          results.push({ source, size, recoverableErrors: errors.length, unrelatedRenders, retainedNodesOnSwitch: clientNodes.length });
        } finally {
          suspended = false;
          release();
          root.unmount();
          container.remove();
        }
      }
    }
    return results;
  } finally {
    if (saved === null) localStorage.removeItem("human2ai.locale");
    else localStorage.setItem("human2ai.locale", saved);
    if (languages) Object.defineProperty(navigator, "languages", languages);
    else Reflect.deleteProperty(navigator, "languages");
    document.documentElement.lang = originalLang;
    document.title = originalTitle;
  }
}
