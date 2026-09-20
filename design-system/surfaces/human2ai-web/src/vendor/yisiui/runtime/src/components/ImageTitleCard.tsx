import { Children } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import "../../styles/tokens.css";
import "../../styles/image-title-card.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export interface ImageTitleCardProps
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "title"> {
  images: ReactNode;
  title: ReactNode;
  aspectRatio?: CSSProperties["aspectRatio"];
}

type ImageFanStyle = CSSProperties & {
  "--yisiui-image-title-card-offset": string;
  "--yisiui-image-title-card-rotation": string;
  "--yisiui-image-title-card-lift": string;
};

function imageFanStyle(index: number, count: number): ImageFanStyle {
  const normalizedPosition = count <= 1 ? 0 : (index / (count - 1)) * 2 - 1;
  const spread = Math.min(7, 3 + count);
  const offset = Math.min(12, 5 + count * 1.5);

  return {
    "--yisiui-image-title-card-offset": `${normalizedPosition * offset}%`,
    "--yisiui-image-title-card-rotation": `${normalizedPosition * spread}deg`,
    "--yisiui-image-title-card-lift": `${Math.abs(normalizedPosition) * 5}px`,
    zIndex: index + 1,
  };
}

export function ImageTitleCard({
  images,
  title,
  aspectRatio = "3 / 2",
  className,
  ...figureProps
}: ImageTitleCardProps) {
  const imageItems = Children.toArray(images);

  return (
    <figure
      {...figureProps}
      {...uiAssetAttributes("image-title-card", "ImageTitleCard", "card")}
      className={["yisi-image-title-card", className].filter(Boolean).join(" ")}
    >
      <div
        className="yisi-image-title-card-media"
        data-empty={imageItems.length === 0 ? "true" : undefined}
        data-image-count={imageItems.length}
        data-yisiui-slot="images"
        style={{ aspectRatio }}
      >
        {imageItems.map((image, index) => (
          <div
            className="yisi-image-title-card-image"
            key={index}
            style={imageFanStyle(index, imageItems.length)}
          >
            {image}
          </div>
        ))}
      </div>
      <figcaption className="yisi-image-title-card-title" data-yisiui-slot="title">
        {title}
      </figcaption>
    </figure>
  );
}
