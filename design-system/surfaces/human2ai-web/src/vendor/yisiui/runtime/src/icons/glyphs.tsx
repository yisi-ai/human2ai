import type { AnimatedIconName } from "./catalog";
import { pointText, smoothPath, starVertices } from "./geometry";

// All paths are computed once, not during animation or React renders.
const plane = smoothPath([[3.4, 10.3], [20.4, 3.6], [13.7, 20.6], [10.7, 13.3]], [3.1, 3.8, 3.1, 1.7], true, 0.56);
const star = smoothPath(starVertices(9.8, 5.2), [2.9, 1.65, 2.9, 1.65, 2.9, 1.65, 2.9, 1.65, 2.9, 1.65], true, 0.56);
const tray = smoothPath([[4, 14], [4, 20], [20, 20], [20, 14]], 3.8, false, 0.56);
const arrow = smoothPath([[12, 3.4], [17.7, 9.7], [6.3, 9.7]], [2.1, 1.8, 1.8], true, 0.56);
const paper = smoothPath([[8, 7], [16, 7], [20, 11], [20, 21], [8, 21]], [4.5, 1.2, 1.2, 4.5, 4.5], true, 0.56);
// The exposed back-sheet ends limit corner space; use a generous circular return.
const backPaper = "M6 16h-.5A2.5 2.5 0 0 1 3 13.5v-8A2.5 2.5 0 0 1 5.5 3h7A2.5 2.5 0 0 1 15 5.5";
// Circular dome: k = 4/3 * tan(pi/8), the cubic quarter-circle approximation.
const domeHandle = 5.5 * 4 / 3 * Math.tan(Math.PI / 8);
const bell = `M6.5 10C6.5 ${10 - domeHandle} ${12 - domeHandle} 4.5 12 4.5C${12 + domeHandle} 4.5 17.5 ${10 - domeHandle} 17.5 10C17.5 13 17.9 14.6 18.6 15.8Q19.3 17 17.9 17H6.1Q4.7 17 5.4 15.8C6.1 14.6 6.5 13 6.5 10Z`;
const refreshTip = smoothPath([[19.2, 3.5], [20, 9.7], [13.8, 7.6]], 1.8, true, 0.56);

const panelFrame = smoothPath([[3, 4.5], [21, 4.5], [21, 19.5], [3, 19.5]], 4.5, true, 0.56);
const resetTip = smoothPath([[3.8, 3.8], [3.8, 9.2], [9.2, 9.2]], 1.6, true, 0.56);

/** Connected geometry moves together; independent accents may follow. */
export function IconGlyph({ name }: { name: AnimatedIconName }) {
  const motion = { className: "yisi-animated-icon-motion", "data-animated-icon-part": "motion" };
  switch (name) {
    case "reset": return (
      <>
        <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
        <g {...motion}>
          <path d="M5.5 7.35A8 8 0 1 1 4 12" />
          <path d={resetTip.d} fill="currentColor" stroke="none" />
        </g>
      </>
    );
    case "sidebar-left":
    case "sidebar-right": return (
      <g transform={name === "sidebar-right" ? "translate(24 0) scale(-1 1)" : undefined}>
        <path d={panelFrame.d} />
        <g {...motion}>
          <rect x="5.5" y="7" width="4" height="10" rx="1.6" fill="currentColor" stroke="none" />
        </g>
      </g>
    );
    case "loading": return (
      <>
        <circle cx="12" cy="12" r="8" opacity="0.16" />
        <g {...motion}><path d="M12 4a8 8 0 1 1-8 8" /></g>
      </>
    );
    case "plus": return (
      <g {...motion} fill="currentColor" stroke="none">
        <rect x="4.5" y="10.8" width="15" height="2.4" rx="1.2" />
        <rect x="10.8" y="4.5" width="2.4" height="15" rx="1.2" />
      </g>
    );
    case "upload": return (
      <>
        <path d={tray.d} />
        <rect x="5.5" y="18.4" width="13" height="2.5" rx="1.25" fill="currentColor" stroke="none" />
        <g {...motion}>
          <path d="M12 8.7v6.8" />
          <path fill="currentColor" stroke="none" d={arrow.d} />
        </g>
      </>
    );
    case "send": return (
      <g {...motion}>
        {/* The seam shares both outline junctions and moves with the whole plane. */}
        <path d={`${plane.d}M${pointText(plane.corners[3].middle)}L${pointText(plane.corners[1].middle)}`} />
      </g>
    );
    case "refresh": return (
      <g {...motion}>
        <path d="M4.5 9a8 8 0 0 1 13.7-2.7M19.5 15a8 8 0 0 1-13.7 2.7" />
        <g fill="currentColor" stroke="none">
          <path d={refreshTip.d} />
          <path d={refreshTip.d} transform="rotate(180 12 12)" />
        </g>
      </g>
    );
    case "copy": return (
      <>
        <path d={backPaper} />
        <g {...motion}>
          <path d={paper.d} />
          <path d="M16 7v2a2 2 0 0 0 2 2h2Z" fill="currentColor" stroke="none" />
          <path d="M11.5 15.5h5" />
        </g>
      </>
    );
    case "star": return (
      <g {...motion}>
        <path d={star.d} />
      </g>
    );
    case "bell": return (
      <>
        <circle cx="12" cy="3.2" r="1.4" fill="currentColor" stroke="none" />
        <g {...motion}>
          <path d={bell} />
        </g>
        <g className="yisi-animated-icon-layer yisi-icon-bell-clapper">
          <path d="M12 17v1.5" />
          <rect x="10.4" y="18" width="3.2" height="3.6" rx="1.6" fill="currentColor" stroke="none" />
        </g>
      </>
    );
    case "close": return (
      <g {...motion}>
        <g transform="rotate(45 12 12)" fill="currentColor" stroke="none">
          <rect x="4.5" y="10.8" width="15" height="2.4" rx="1.2" />
          <rect x="10.8" y="4.5" width="2.4" height="15" rx="1.2" />
        </g>
      </g>
    );

  }
}
