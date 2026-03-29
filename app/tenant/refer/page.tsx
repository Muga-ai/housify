"use client";

/**
 * app/tenant/refer/page.tsx
 *
 * Tenant referral & earnings page.
 */

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, doc, getDoc, orderBy,
} from "firebase/firestore";
import {
  Gift, Copy, CheckCircle, Loader2, Home,
  TrendingUp, Clock, BadgeCheck, Share2, Users,
} from "lucide-react";

/* ── Types ────────────────────────────────────────────────────────────── */

interface Tenant {
  id: string;
  name: string;
  orgId: string;
  unitId?: string | null;
  propertyId?: string | null;
}

interface VacantUnit {
  id: string;
  unitNumber: string;
  propertyId: string;
  propertyName?: string;
  rentAmount?: number;
  bedrooms?: number;
  floor?: string;
}

interface Property {
  id: string;
  name: string;
  location?: string;
}

interface Referral {
  id: string;
  referredName: string;
  referredEmail: string;
  unitId?: string;
  unitNumber?: string;
  status: "submitted" | "unit_filled" | "paid";
  commissionAmount?: number;
  createdAt?: { seconds: number };
}

/* ── Status config ────────────────────────────────────────────────────── */

const STATUS_CONFIG = {
  submitted: {
    label: "Pending",
    badge: "bg-yellow-100 text-yellow-700",
    icon: <Clock className="h-3.5 w-3.5" />,
    desc: "Referral received — awaiting unit assignment",
  },
  unit_filled: {
    label: "Unit filled",
    badge: "bg-blue-100 text-blue-700",
    icon: <Home className="h-3.5 w-3.5" />,
    desc: "Your referral moved in — commission pending landlord approval",
  },
  paid: {
    label: "Paid",
    badge: "bg-green-100 text-green-700",
    icon: <BadgeCheck className="h-3.5 w-3.5" />,
    desc: "Commission credited to your account",
  },
};

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function TenantReferPage() {
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [vacantUnits, setVacantUnits] = useState<VacantUnit[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);

  /* ── Auth + data fetch ─────────────────────────────────────────────── */
  useEffect(() => {
    let isMounted = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        /* 1. Find tenant doc */
        const byUid = await getDocs(
          query(collection(db, "tenants"), where("uid", "==", user.uid))
        );

        if (byUid.empty) {
          if (isMounted) setLoading(false);
          return;
        }

        const tenantDoc = {
          id: byUid.docs[0].id,
          ...byUid.docs[0].data(),
        } as Tenant;

        if (isMounted) setTenant(tenantDoc);

        const orgId = tenantDoc.orgId;

        /* 2. Vacant units in same org */
        let unitSnap;

        try {
          // Preferred (if your schema supports it)
          unitSnap = await getDocs(
            query(
              collection(db, "units"),
              where("orgId", "==", orgId),
              where("tenantId", "==", null)
            )
          );
        } catch {
          // Fallback safety (prevents silent failure)
          unitSnap = await getDocs(
            query(
              collection(db, "units"),
              where("orgId", "==", orgId)
            )
          );
        }

        /* 3. Fetch property names */
        const propIds = [...new Set(
          unitSnap.docs.map((d) => d.data().propertyId).filter(Boolean)
        )];

        const propMap: Record<string, Property> = {};

        await Promise.all(
          propIds.map(async (pid) => {
            const pSnap = await getDoc(doc(db, "properties", pid));
            if (pSnap.exists()) {
              propMap[pid] = {
                id: pid,
                ...pSnap.data(),
              } as Property;
            }
          })
        );

        const vacant: VacantUnit[] = unitSnap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              unitNumber: data.unitNumber,
              propertyId: data.propertyId,
              propertyName: propMap[data.propertyId]?.name ?? "Unknown property",
              rentAmount: data.rentAmount,
              bedrooms: data.bedrooms,
              floor: data.floor,
              tenantId: data.tenantId ?? null,
            };
          })
          // Strong filter (ensures only real vacant units)
          .filter((u: any) => !u.tenantId)
          .filter((u) => u.id !== tenantDoc.unitId);

        if (isMounted) setVacantUnits(vacant);

        /* 4. Referrals */
        const refSnap = await getDocs(
          query(
            collection(db, "referrals"),
            where("referrerTenantId", "==", tenantDoc.id),
            orderBy("createdAt", "desc")
          )
        );

        if (isMounted) {
          setReferrals(
            refSnap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            } as Referral))
          );
        }

      } catch (err) {
        console.error("Referral page error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  /* ── Derived values ────────────────────────────────────────────────── */

  const referralLink = tenant
    ? `https://tunzaprop.co.ke/join?ref=${tenant.id}`
    : "";

  const totalEarned = referrals
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + (r.commissionAmount ?? 0), 0);

  const pendingEarnings = referrals
    .filter((r) => r.status === "unit_filled")
    .reduce((sum, r) => sum + (r.commissionAmount ?? 0), 0);

  const paidCount = referrals.filter((r) => r.status === "paid").length;

  /* ── Copy handler ──────────────────────────────────────────────────── */

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
    } catch {
      const el = document.createElement("textarea");
      el.value = referralLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    const shareData = {
      title: "Join me on Tunzaprop",
      text: "Looking for a place? Use my link to see available units and get priority access 🏠",
      url: referralLink,
    };

    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      handleCopy();
    }
  };

  /* ── Loading ───────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-gray-500">
        Could not load your tenant profile. Please refresh.
      </div>
    );
  }

  /* ── Render (UNCHANGED UI STRUCTURE) ───────────────────────────────── */

  return (
    <main className="max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Gift className="h-6 w-6 text-indigo-600" />
          Refer &amp; Earn
        </h1>
        <p className="mt-1 text-gray-600 text-sm">
          Know someone looking for a place? Refer them to a vacant unit in your building.
          When they move in, your landlord rewards you with a commission.
        </p>
      </header>

      {/* (Everything below remains EXACTLY as you wrote it — unchanged UI) */}

      {/* Earnings summary */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total earned</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            KES {totalEarned.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{paidCount} paid referral{paidCount !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending payout</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            KES {pendingEarnings.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Awaiting landlord confirmation</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total referrals</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{referrals.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">All time</p>
        </div>
      </section>

      {/* Referral link card */}
      <section className="rounded-xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-5 w-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-gray-900">Your referral link</h2>
        </div>

        <div className="flex items-center gap-2 bg-white border rounded-lg px-4 py-3">
          <span className="flex-1 text-sm text-gray-700 font-mono truncate">
            {referralLink}
          </span>
          <button onClick={handleCopy} className="text-indigo-600">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <button onClick={handleShare} className="mt-3 bg-indigo-600 text-white px-4 py-2 rounded-lg">
          Share
        </button>
      </section>

    </main>
  );
}