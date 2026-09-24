import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { Human2AiAppShell } from "@human2ai/ui";

import { HOME_SKILL_INSTALL_COMMAND, HomeView } from "../../web/components/HomeView";
import en from "../../locales/en/common.json";
import zh from "../../locales/zh-CN/common.json";

const meta = {
  title: "human2ai/Pages/Home",
  component: HomeView,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => (
    <Human2AiAppShell title={null} sidebar={null}>
      <Story />
    </Human2AiAppShell>
  )],
  args: {
    productName: zh.app.title,
    repositoryLabel: zh.app.repositoryLink.replace("{{productName}}", zh.app.title),
    description: zh.home.description,
    skillInstallation: { ...zh.home.skillInstallation, copied: zh.clipboard.copied },
    labels: {
      composition: zh.home.createComposition,
      "ui-sketch": zh.home.createUiSketch,
      spatial: zh.home.createSpatial,
    },
    onCreate: () => undefined,
  },
} satisfies Meta<typeof HomeView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const introduction = canvasElement.querySelector("main header");
    const logo = introduction?.querySelector("img");
    const heading = introduction?.querySelector("h1");
    if (!introduction || !logo || heading?.textContent !== args.productName
      || introduction.querySelector("p")?.textContent !== args.description) {
      throw new Error("Home must introduce the product with its logo, name and description");
    }
    await logo.decode();
    const iconBounds = logo.getBoundingClientRect();
    const headingBounds = heading.getBoundingClientRect();
    if (Math.abs((iconBounds.top + iconBounds.bottom) / 2 - (headingBounds.top + headingBounds.bottom) / 2) > 1
      || iconBounds.right > headingBounds.left) {
      throw new Error("Product icon and name must align at the vertical center of a horizontal row");
    }
    if (canvasElement.querySelector(".human2ai-app-shell__page-title")) {
      throw new Error("Home must omit the duplicate shell title");
    }
    const repositoryLink = introduction.querySelector<HTMLAnchorElement>('a[href="https://github.com/yisi-ai/human2ai"]');
    if (!repositoryLink?.querySelector("svg") || repositoryLink.textContent?.trim()
      || repositoryLink.getAttribute("aria-label") !== args.repositoryLabel
      || repositoryLink.getBoundingClientRect().left - headingBounds.right < 32) {
      throw new Error("Home must show only a linked GitHub icon with space after the product name");
    }
    const buttons = [...canvasElement.querySelectorAll<HTMLButtonElement>("[data-home-create-actions] button")];
    if (buttons.length !== 3) throw new Error("Home must offer three creation actions");
    const bounds = buttons.map(button => button.getBoundingClientRect());
    if (bounds.some(box => box.height < 180 || box.height > 360 || Math.abs(box.top - bounds[0].top) > 1)) {
      throw new Error("Home cards must share one row with heights between 180 and 360 pixels");
    }
    const cards = canvasElement.querySelector("[data-home-create-actions]");
    if (!cards?.parentElement
      || Math.abs(cards.getBoundingClientRect().bottom - cards.parentElement.getBoundingClientRect().bottom) > 1) {
      throw new Error("Creation cards must align to the bottom of the home content");
    }
    for (const label of Object.values(args.labels)) {
      if (!buttons.some(button => button.textContent?.includes(label))) {
        throw new Error(`Missing creation action: ${label}`);
      }
    }
    const panel = canvasElement.querySelector('[role="tabpanel"]');
    const installation = panel?.closest("section");
    if (!installation?.querySelector('[data-yisiui-asset="yisiui/animated-icon"][data-icon="copy"]')) {
      throw new Error("Installation copy action must use the YisiUI animated copy icon");
    }
    if (introduction.nextElementSibling !== installation
      || !installation?.nextElementSibling?.hasAttribute("data-home-create-actions")
      || installation.querySelector("p")) {
      throw new Error("Installation commands must follow the product introduction without extra explanatory copy");
    }
    const installationTitle = installation.querySelector("h2");
    if (installationTitle?.textContent !== args.skillInstallation.title
      || installationTitle.nextElementSibling?.getAttribute("role") !== "tablist") {
      throw new Error("The installation title must sit beside the method tabs");
    }
    const agentTab = canvasElement.querySelector<HTMLButtonElement>('[data-tab-key="agent"]');
    const cliTab = canvasElement.querySelector<HTMLButtonElement>('[data-tab-key="cli"]');
    if (agentTab?.getAttribute("aria-selected") !== "true"
      || !panel?.textContent?.includes(args.skillInstallation.agentPrompt)) {
      throw new Error("Home must show Agent installation instructions by default");
    }
    cliTab?.click();
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (panel.querySelector("code")?.textContent !== HOME_SKILL_INSTALL_COMMAND) {
      throw new Error("CLI tab must show the documented installation commands");
    }
    agentTab.click();
  },
};

export const Creating: Story = {
  args: { pending: "composition" },
  play: async ({ canvasElement }) => {
    const buttons = [...canvasElement.querySelectorAll<HTMLButtonElement>("[data-home-create-actions] button")];
    if (buttons.some(button => !button.disabled)) throw new Error("Creation must prevent duplicate clicks");
    if (buttons.filter(button => button.getAttribute("aria-busy") === "true").length !== 1) {
      throw new Error("Only the selected creation action should be busy");
    }
  },
};

export const Failed: Story = { args: { errorMessage: zh.errors.operationFailed } };

export const English: Story = {
  args: {
    productName: en.app.title,
    repositoryLabel: en.app.repositoryLink.replace("{{productName}}", en.app.title),
    description: en.home.description,
    skillInstallation: { ...en.home.skillInstallation, copied: en.clipboard.copied },
    labels: {
      composition: en.home.createComposition,
      "ui-sketch": en.home.createUiSketch,
      spatial: en.home.createSpatial,
    },
  },
};
