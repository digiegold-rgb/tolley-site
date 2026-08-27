"use client";
/**
 * components/animate/product-context.tsx — which brand the shell is wearing.
 *
 * `useProduct()` defaults to JELLY_BRAND so every existing /animate tree keeps
 * working with no provider. app/realestateanimated/layout.tsx wraps its
 * subtree in <ProductProvider brand={LISTING_BRAND}> and applies the brand's
 * `--jb-*` CSS variables on the wrapper so tokens.ts picks them up.
 */
import { createContext, useContext, type ReactNode } from "react";
import { JELLY_BRAND, type Brand } from "./brands";

const ProductContext = createContext<Brand>(JELLY_BRAND);

export function ProductProvider({ brand, children }: { brand: Brand; children: ReactNode }) {
  return <ProductContext.Provider value={brand}>{children}</ProductContext.Provider>;
}

export function useProduct(): Brand {
  return useContext(ProductContext);
}

/** Convenience: true inside the Listing Studio front door. */
export function useIsRealEstate(): boolean {
  return useContext(ProductContext).product === "realestate";
}
