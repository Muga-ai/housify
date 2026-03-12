/**
 * lib/org.ts
 *
 * Central hook that resolves the current user's orgId and org document.
 * Import this in any page/layout that needs to scope Firestore queries.
 *
 * Usage:
 *   const { orgId, org, loading } = useOrg();
 */

"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

export interface Org {
  id: string;
  name: string;
  adminEmail: string;
  plan: "starter" | "growth" | "pro";
  status: "active" | "inactive" | "trial";
  trialEndsAt?: Date;
  createdAt?: Date;
}

interface OrgState {
  orgId: string | null;
  org: Org | null;
  loading: boolean;
  error: string | null;
}

export function useOrg(): OrgState {
  const [state, setState] = useState<OrgState>({
    orgId: null,
    org: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ orgId: null, org: null, loading: false, error: null });
        return;
      }

      try {
        // 1. Get user doc to find orgId
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists()) {
          setState({ orgId: null, org: null, loading: false, error: "User record not found." });
          return;
        }

        const orgId = userSnap.data().orgId as string;
        if (!orgId) {
          setState({ orgId: null, org: null, loading: false, error: "No org assigned to user." });
          return;
        }

        // 2. Get org doc
        const orgSnap = await getDoc(doc(db, "orgs", orgId));
        if (!orgSnap.exists()) {
          setState({ orgId, org: null, loading: false, error: "Org not found." });
          return;
        }

        const data = orgSnap.data();
        const org: Org = {
          id: orgId,
          name: data.name,
          adminEmail: data.adminEmail,
          plan: data.plan,
          status: data.status,
          trialEndsAt: data.trialEndsAt?.toDate(),
          createdAt: data.createdAt?.toDate(),
        };

        setState({ orgId, org, loading: false, error: null });
      } catch (err) {
        console.error("useOrg error:", err);
        setState({ orgId: null, org: null, loading: false, error: "Failed to load org." });
      }
    });

    return unsubscribe;
  }, []);

  return state;
}

/**
 * Server-side helper: get orgId from a uid (for API routes / server actions)
 */
export async function getOrgIdForUser(uid: string, db: any): Promise<string | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data().orgId ?? null) : null;
}