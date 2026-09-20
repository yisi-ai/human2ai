import type { StorybookConfig } from "@storybook/react-webpack5";

type MutableWebpackRule = {
  oneOf?: unknown[];
  rules?: unknown[];
  use?: unknown | unknown[];
};

type MutableLoaderUse = {
  loader?: unknown;
  options?: unknown;
};

function enableCssModuleDefaultExports(rule: unknown): void {
  if (!rule || typeof rule !== "object") return;
  const mutableRule = rule as MutableWebpackRule;
  for (const nestedRule of [...(mutableRule.oneOf ?? []), ...(mutableRule.rules ?? [])]) {
    enableCssModuleDefaultExports(nestedRule);
  }

  const uses = Array.isArray(mutableRule.use) ? mutableRule.use : [mutableRule.use];
  for (const use of uses) {
    if (!use || typeof use !== "object") continue;
    const loaderUse = use as MutableLoaderUse;
    if (typeof loaderUse.loader !== "string" || !loaderUse.loader.includes("css-loader")) {
      continue;
    }
    const options = loaderUse.options && typeof loaderUse.options === "object"
      ? loaderUse.options as Record<string, unknown>
      : {};
    const modules = options.modules && typeof options.modules === "object"
      ? options.modules as Record<string, unknown>
      : {};
    loaderUse.options = {
      ...options,
      modules: { ...modules, auto: true, namedExport: false },
    };
  }
}

const config: StorybookConfig = {
  staticDirs: ["../../web/public"],
  stories: [
    "../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    "../../design-system/surfaces/human2ai-web/src/local/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    "../../design-system/surfaces/human2ai-web/src/vendor/yisiui/storybook/stories/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: ["@storybook/addon-webpack5-compiler-swc", "@storybook/addon-a11y"],
  framework: { name: "@storybook/react-webpack5", options: {} },
  webpackFinal: async (webpackConfig) => {
    // Synced YisiUI source uses default CSS Module imports. css-loader 7 otherwise
    // exposes only named locals in a plain react-webpack5 Storybook.
    for (const rule of webpackConfig.module?.rules ?? []) {
      enableCssModuleDefaultExports(rule);
    }
    return webpackConfig;
  },
};

export default config;
