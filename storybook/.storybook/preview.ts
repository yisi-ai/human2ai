import { ConfigProvider } from "antd";
import { createElement } from "react";
import type { Preview } from "@storybook/react-webpack5";

import { antdTheme } from "@human2ai/ui/yisiui/antd-theme";
import "@human2ai/ui/yisiui/tokens.css";

const preview: Preview = {
  decorators: [
    (Story) => createElement(ConfigProvider, { theme: antdTheme }, createElement(Story)),
  ],
  parameters: {
    a11y: { test: "error" },
    controls: { expanded: true },
    layout: "fullscreen",
    options: { storySort: { order: ["human2ai", "yisiui-Components", "yisiui-Modules", "yisiui-Layouts", "yisiui-Foundations", "yisiui-System", "*"] } },
    viewport: {
      viewports: {
        desktopMinimum: { name: "Desktop minimum", styles: { width: "1024px", height: "800px" } },
        desktopStandard: { name: "Desktop standard", styles: { width: "1280px", height: "800px" } },
        desktopWide: { name: "Desktop wide", styles: { width: "1536px", height: "960px" } },
      },
    },
    globals: { viewport: "desktopStandard" },
  },
};

export default preview;
