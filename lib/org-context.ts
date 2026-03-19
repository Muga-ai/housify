"use client";
 
/**
 * lib/org-context.ts
 *
 * Extracted from app/admin/layout.tsx to fix Next.js 16 build error.
 * Next.js only allows specific exports from layout files (default, config,
 * generateStaticParams, metadata etc). Any other named export like
 * useOrgContext causes: "Type is not assignable to type 'never'"
 *
 * Solution: move the context and hook here, import in layout and all pages.
 */
 
import { createContext, useContext } from "react";
import { Org } from "@/lib/org";
 
export interface OrgContextValue {
  orgId: string;
  org: Org;
}
 
export const OrgContext = createContext<OrgContextValue | null>(null);
 
export function useOrgContext(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrgContext must be used inside AdminLayout");
  return ctx;
}
 