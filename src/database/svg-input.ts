import { SaxesParser } from "saxes";

const svgNamespace = "http://www.w3.org/2000/svg";
const elements = new Set([
  "svg", "g", "defs", "title", "desc", "path", "rect", "circle", "ellipse",
  "line", "polyline", "polygon", "text", "tspan", "textPath", "style",
  "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern",
  "marker", "symbol", "use", "image", "filter", "feBlend", "feColorMatrix",
  "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting",
  "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA",
  "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feMerge", "feMergeNode",
  "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight",
  "feTile", "feTurbulence",
]);

// Image nodes accept portable static SVG, without executing or fetching content.
export function isSelfContainedSvg(data: Buffer): boolean {
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(data);
    const parser = new SaxesParser({ xmlns: true });
    let depth = 0;
    let rootSeen = false;
    let styleText: string | null = null;
    const reject = () => { throw new Error("Invalid SVG image"); };
    parser.on("doctype", reject);
    parser.on("processinginstruction", reject);
    parser.on("opentag", (tag) => {
      if (tag.uri !== svgNamespace || !elements.has(tag.local)) reject();
      if (depth === 0) {
        if (tag.local !== "svg") reject();
        rootSeen = true;
      }
      depth += 1;
      if (tag.local === "style") styleText = "";
      for (const attribute of Object.values(tag.attributes)) {
        if (/^on/i.test(attribute.local)
          || (attribute.local === "base" && attribute.uri === "http://www.w3.org/XML/1998/namespace")) reject();
        if (attribute.local === "href") {
          const value = attribute.value.trim();
          const localReference = /^#[^\s]+$/.test(value);
          const embeddedBitmap = tag.local === "image"
            && /^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=\s]+$/i.test(value);
          if (!localReference && !embeddedBitmap) reject();
        }
        if (["style", "fill", "stroke", "filter", "clip-path", "mask", "marker", "marker-start", "marker-mid", "marker-end", "cursor"].includes(attribute.local)
          && !hasLocalStyles(attribute.value)) reject();
      }
    });
    const readText = (text: string) => { if (styleText !== null) styleText += text; };
    parser.on("text", readText);
    parser.on("cdata", readText);
    parser.on("closetag", (tag) => {
      if (tag.local === "style") {
        if (!hasLocalStyles(styleText ?? "")) reject();
        styleText = null;
      }
      depth -= 1;
    });
    parser.write(source).close();
    return rootSeen;
  } catch {
    return false;
  }
}

function hasLocalStyles(value: string): boolean {
  const css = value.replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/url\(\s*(['"]?)#[\w:.-]+\1\s*\)/gi, "");
  return !/[\\@]|url\s*\(|expression\s*\(/i.test(css);
}
