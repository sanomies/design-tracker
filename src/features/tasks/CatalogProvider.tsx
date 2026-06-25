import { createContext, useContext, useMemo, type ReactNode } from "react";

import { getProfile, MARKETING_PROFILE, type CatalogProfile } from "./catalog";

// Active catalog profile for the subtree. Defaults to the marketing/brand
// catalog so any surface that hasn't opted in behaves exactly as before.
// Project views provide their project's profile; cross-project views (My
// tasks) provide a merged profile at the page and override per-row with
// each task's project kind.
const CatalogContext = createContext<CatalogProfile>(MARKETING_PROFILE);

export function CatalogProvider({
  kind,
  profile,
  children,
}: {
  /** Project kind ("marketing" | "product"); resolved to a profile. */
  kind?: string | null;
  /** Explicit profile (e.g. the merged profile) — takes precedence. */
  profile?: CatalogProfile;
  children: ReactNode;
}) {
  const value = useMemo(
    () => profile ?? getProfile(kind),
    [profile, kind]
  );
  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
}

export function useCatalog(): CatalogProfile {
  return useContext(CatalogContext);
}
