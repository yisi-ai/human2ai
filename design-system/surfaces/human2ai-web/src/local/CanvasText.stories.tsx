import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";

import { assertStorySelector } from "../vendor/yisiui/storybook/interactionChecks";
import { CanvasNode } from "./CanvasNode";
import { CanvasScene } from "./CanvasScene";
import { CanvasText, type CanvasTextBounds } from "./CanvasText";

import "./CanvasElements.stories.css";

function TextScalingExample() {
  const [fontSize, setFontSize] = useState(28);
  const [rotation, setRotation] = useState(0);
  const [textBounds, setTextBounds] = useState<CanvasTextBounds>({
    x: 0,
    y: 0,
    width: fontSize * 7,
    height: fontSize * 4.2,
  });
  return (
    <main className="human2ai-canvas-story">
      <div className="human2ai-canvas-story__stack">
        <div className="human2ai-canvas-story__actions">
          <BasicButton onClick={() => setFontSize((size) => size + 8)}>放大文字</BasicButton>
        </div>
        <div className="human2ai-canvas-story__stage human2ai-canvas-story__stage--compact">
          <CanvasScene bounds={{ x: -320, y: -180, width: 640, height: 360 }} aria-label="文字组件场景">
            <CanvasNode
              id="text"
              label="多行文字"
              rotation={rotation}
              selected
              bounds={{
                x: -textBounds.width / 2,
                y: -textBounds.height / 2,
                width: textBounds.width,
                height: textBounds.height,
              }}
              resizeMode="font-size"
              onResize={(change) => {
                setFontSize(fontSize * change.bounds.width / textBounds.width);
              }}
              onRotate={(change) => setRotation(change.rotation)}
            >
              <g
                transform={`translate(${
                  -textBounds.width / 2 - textBounds.x
                } ${-textBounds.height / 2 - textBounds.y})`}
              >
                <CanvasText
                  text={"第一行文字\n\n第三行文字"}
                  fontSize={fontSize}
                  onBoundsChange={setTextBounds}
                />
              </g>
            </CanvasNode>
          </CanvasScene>
        </div>
      </div>
    </main>
  );
}

const meta = {
  id: "human2ai-canvas-text",
  title: "human2ai/Canvas/Elements/Text",
  component: CanvasText,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CanvasText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ManualLineBreaks: Story = {
  name: "手动换行与字号缩放",
  args: { text: "第一行文字\n\n第三行文字", fontSize: 28 },
  render: () => <TextScalingExample />,
  play: async ({ canvasElement }) => {
    await nextFrame();
    await nextFrame();
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="human2ai/canvas-text"]',
    );
    const text = canvasElement.querySelector<SVGTextElement>(
      '[data-yisiui-asset="human2ai/canvas-text"]',
    );
    if (!text) throw new Error("CanvasText story is missing its text");
    if (text.querySelectorAll("tspan").length !== 3 || text.dataset.lineCount !== "3") {
      throw new Error("CanvasText did not preserve manual line breaks");
    }
    const node = canvasElement.querySelector<SVGGElement>('[data-canvas-node="text"]');
    if (
      node?.dataset.resizeMode !== "font-size" ||
      node.querySelectorAll("[data-resize-handle]").length !== 8 ||
      !node.querySelector("[data-rotation-handle]")
    ) {
      throw new Error("CanvasText must use font-size resizing with optional rotation");
    }
    assertTextMatchesOperationBounds(node, text);
    const initialFontSize = text.getAttribute("font-size");
    const button = canvasElement.querySelector<HTMLButtonElement>("button");
    if (!button || !button.textContent?.includes("放大文字")) {
      throw new Error("CanvasText story is missing its scale action");
    }
    button.click();
    await nextFrame();
    const updatedText = canvasElement.querySelector<SVGTextElement>(
      '[data-yisiui-asset="human2ai/canvas-text"]',
    );
    if (!updatedText) throw new Error("CanvasText story lost its text after scaling");
    if (updatedText.getAttribute("font-size") === initialFontSize) {
      throw new Error("Text scaling must change the stored font-size value");
    }
    await nextFrame();
    assertTextMatchesOperationBounds(node, updatedText);
  },
};

function assertTextMatchesOperationBounds(
  node: SVGGElement,
  text: SVGTextElement,
): void {
  const outline = node.querySelector<SVGRectElement>(".human2ai-canvas-node__outline");
  if (!outline) throw new Error("CanvasText story is missing its operation outline");
  const textRect = text.getBoundingClientRect();
  const outlineRect = outline.getBoundingClientRect();
  const differences = [
    Math.abs(textRect.x - outlineRect.x),
    Math.abs(textRect.y - outlineRect.y),
    Math.abs(textRect.width - outlineRect.width),
    Math.abs(textRect.height - outlineRect.height),
  ];
  if (differences.some((difference) => difference > 0.75)) {
    throw new Error("CanvasText operation outline must match its rendered SVG bounds");
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
