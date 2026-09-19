import { animatedIconCatalog } from "@human2ai/ui/yisiui";
type AnimatedIconName = (typeof animatedIconCatalog)[number]["name"];

/** Connected geometry moves together; independent accents may follow. */
export function PreviousRedrawnGlyph({ name }: { name: AnimatedIconName }) {
  const motion = { className: "yisi-animated-icon-motion", "data-animated-icon-part": "motion" };
  switch (name) {
    case "plus": return (
      <g {...motion} fill="currentColor" stroke="none">
        <rect x="4.5" y="10.8" width="15" height="2.4" rx="1.2" />
        <rect x="10.8" y="4.5" width="2.4" height="15" rx="1.2" />
      </g>
    );
    case "upload": return (
      <>
        <path d="M4 14v3.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V14" />
        <rect x="5.5" y="18.4" width="13" height="2.5" rx="1.25" fill="currentColor" stroke="none" />
        <g {...motion}>
          <path d="M12 8.7v6.8" />
          <path fill="currentColor" stroke="none" d="M12 3.5c.3 0 .6.12.8.35L17 8.15c.6.6.18 1.65-.68 1.65H7.68C6.82 9.8 6.4 8.75 7 8.15l4.2-4.3c.2-.23.5-.35.8-.35Z" />
        </g>
      </>
    );
    case "send": return (
      <g {...motion}>
        {/* The seam shares both outline junctions and moves with the whole plane. */}
        <path d="M4.1 9.4 19 3.7c.85-.32 1.62.45 1.3 1.3l-5.7 14.9c-.32.84-1.51.84-1.83 0l-2.35-6.32L4.1 11.23c-.84-.32-.84-1.51 0-1.83ZM10.42 13.58 20.08875 3.91125" />
      </g>
    );
    case "refresh": return (
      <g {...motion}>
        <path d="M4.5 9a8 8 0 0 1 13.7-2.7M19.5 15a8 8 0 0 1-13.7 2.7" />
        <g fill="currentColor" stroke="none">
          <path d="m19.2 3.8.65 5.05c.08.64-.52 1.14-1.13.93L14 8.15c-.67-.23-.78-1.12-.21-1.52l4.09-2.91c.52-.37 1.23-.06 1.32.08Z" />
          <path d="m4.8 20.2-.65-5.05c-.08-.64.52-1.14 1.13-.93L10 15.85c.67.23.78 1.12.21 1.52l-4.09 2.91c-.52.37-1.23.06-1.32-.08Z" />
        </g>
      </g>
    );
    case "copy": return (
      <>
        <path d="M6 16H5.5A2.5 2.5 0 0 1 3 13.5v-8A2.5 2.5 0 0 1 5.5 3h7A2.5 2.5 0 0 1 15 5.5" />
        <g {...motion}>
          <path d="M11 7h5l4 4v7a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Z" />
          <path d="M16 7v3a1 1 0 0 0 1 1h3Z" fill="currentColor" stroke="none" />
          <path d="M11.5 15.5h5" />
        </g>
      </>
    );
    case "star": return (
      <g {...motion}>
        <path d="M11.1 3.9c.36-.73 1.44-.73 1.8 0l2.3 4.66 5.14.75c.81.12 1.14 1.12.55 1.7l-3.72 3.62.88 5.12c.14.81-.72 1.43-1.45 1.05L12 18.38 7.4 20.8c-.73.38-1.59-.24-1.45-1.05l.88-5.12-3.72-3.62c-.59-.58-.26-1.58.55-1.7l5.14-.75Z" />
      </g>
    );
    case "bell": return (
      <>
        <circle cx="12" cy="3.2" r="1.4" fill="currentColor" stroke="none" />
        <g {...motion}>
          <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 3.5.7 4.1 1.5 5.6.35.65-.1 1.4-.85 1.4H5.85c-.75 0-1.2-.75-.85-1.4.8-1.5 1.5-2.1 1.5-5.6Z" />
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
