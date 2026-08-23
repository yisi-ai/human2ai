import type { StorybookConfig } from "@storybook/react-webpack5";

const config: StorybookConfig = {
  stories: [
    "../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    "../../design-system/surfaces/human2ai-web/src/local/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    "../../design-system/surfaces/human2ai-web/src/vendor/yisiui/storybook/stories/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: ["@storybook/addon-webpack5-compiler-swc", "@storybook/addon-a11y"],
  framework: { name: "@storybook/react-webpack5", options: {} },
};

export default config;
