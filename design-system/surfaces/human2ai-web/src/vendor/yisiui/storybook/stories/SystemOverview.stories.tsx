import type { CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import registry from "@human2ai/ui/yisiui/registry";

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "clamp(32px, 7vw, 96px)",
  color: "#172033",
  background: "#F6F4EE",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
};

const panelStyle: CSSProperties = {
  maxWidth: 760,
  padding: "clamp(24px, 5vw, 56px)",
  background: "#FFFDF8",
  border: "1px solid #D8D2C4",
  borderRadius: 20,
  boxShadow: "0 20px 70px rgba(23, 32, 51, 0.08)",
};

function SystemOverview() {
  return (
    <main style={pageStyle}>
      <section style={panelStyle} aria-labelledby="yisiui-status-title">
        <p style={{ margin: "0 0 12px", color: "#765F22", fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Architecture checkpoint
        </p>
        <h1 id="yisiui-status-title" style={{ margin: 0, fontSize: "clamp(36px, 7vw, 72px)", lineHeight: 0.98, letterSpacing: "-0.055em" }}>
          YisiUI migration candidate
        </h1>
        <p style={{ maxWidth: 620, margin: "28px 0 0", color: "#4C566A", fontSize: 18, lineHeight: 1.65 }}>
          This supporting Story records the active Writer Harness migration set. The view is not a reusable UI asset and is never exported by @human2ai/ui/yisiui.
        </p>
        <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, margin: "36px 0 0" }}>
          {[
            ["Shared assets", String(registry.assets.filter((asset) => asset.status !== "removed").length)],
            ["Surface", "web-react"],
            ["System status", "migration candidate"],
          ].map(([term, value]) => (
            <div key={term} style={{ paddingTop: 14, borderTop: "1px solid #D8D2C4" }}>
              <dt style={{ color: "#70788A", fontSize: 13 }}>{term}</dt>
              <dd style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 650 }}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}

const meta = {
  id: "system-architecture-status", title: "yisiui-System/Architecture Status",
  component: SystemOverview,
  parameters: {
    docs: {
      description: {
        component: "Supporting system view only. It is excluded from the shared asset Registry.",
      },
    },
  },
} satisfies Meta<typeof SystemOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MigrationCandidate: Story = {};
