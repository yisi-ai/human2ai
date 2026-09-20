"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import type { UiAssetAttributes } from "../assetMarker";

const UiAssetAttributeContext = createContext<UiAssetAttributes | null>(null);

export interface UiAssetAttributeScopeProps {
  attributes: UiAssetAttributes;
  children: ReactNode;
}

export function UiAssetAttributeScope({
  attributes,
  children,
}: UiAssetAttributeScopeProps) {
  const inheritedAttributes = useContext(UiAssetAttributeContext);

  return (
    <UiAssetAttributeContext.Provider value={inheritedAttributes ?? attributes}>
      {children}
    </UiAssetAttributeContext.Provider>
  );
}

export function useUiAssetAttributes(
  fallbackAttributes: UiAssetAttributes,
): UiAssetAttributes {
  return useContext(UiAssetAttributeContext) ?? fallbackAttributes;
}
