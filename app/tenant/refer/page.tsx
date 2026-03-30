"use client";

/**
 * app/tenant/refer/page.tsx
 *
 * Tenant referral & earnings page.
 *
 * What it does:
 * - Fetches the current tenant's doc to get their unique referral code (tenant doc ID)
 * - Fetches vacant units in the same org so tenant can see what's available
 * - Fetches all referrals made by this tenant and their statuses
 * - Lets tenant copy their referral link or share it
 * - Shows earnings: pending (unit filled, not yet paid) and paid out
 *
 * Referral link format: https://tunzaprop.co.ke/join?ref=<tenantDocId>
 *
 * Referral lifecycle (managed by admin):
 *   submitted → unit_filled → paid
 *
 * No new referral doc is created here — it is created on the /join page
 * when the referred person completes registration.
 */

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, doc, getDoc,
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
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); return; }

      try {
        /* 1. Find tenant doc */
        const byUid = await getDocs(
          query(collection(db, "tenants"), where("uid", "==", user.uid))
        );
        if (byUid.empty) { setLoading(false); return; }

        const tenantDoc = { id: byUid.docs[0].id, ...byUid.docs[0].data() } as Tenant;
        setTenant(tenantDoc);

        const orgId = tenantDoc.orgId;

        /* 2. Vacant units in same org */
        const unitSnap = await getDocs(
          query(
            collection(db, "units"),
            where("orgId", "==", orgId),
            where("tenantId", "==", null)
          )
        );

        /* 3. Fetch property names for vacant units */
        const propIds = [...new Set(
          unitSnap.docs.map((d) => d.data().propertyId).filter(Boolean)
        )];
        const propMap: Record<string, Property> = {};
        await Promise.all(
          propIds.map(async (pid) => {
            const pSnap = await getDoc(doc(db, "properties", pid));
            if (pSnap.exists()) {
              propMap[pid] = { id: pid, ...pSnap.data() } as Property;
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
            };
          })
          // Exclude the tenant's own unit if somehow it shows
          .filter((u) => u.id !== tenantDoc.unitId);

        setVacantUnits(vacant);

        /* 4. Referrals made by this tenant */
        const refSnap = await getDocs(
          query(
            collection(db, "referrals"),
            where("referrerTenantId", "==", tenantDoc.id)
          )
        );
        setReferrals(
          refSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Referral))
        );
      } catch (err) {
        console.error("Referral page error:", err);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* fallback for older browsers */
      const el = document.createElement("textarea");
      el.value = referralLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: "Join me on Tunzaprop",
      text: `Hey! There's a great place available in my building. Check it out and sign up using my link — it helps both of us 🏠`,
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

  /* ── Render ────────────────────────────────────────────────────────── */
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
        <p className="text-sm text-gray-500 mb-4">
          Share this link with anyone looking for a place. When they register and move into
          a vacant unit in your building, your landlord will reward you.
        </p>

        <div className="flex items-center gap-2 bg-white border rounded-lg px-4 py-3">
          <span className="flex-1 text-sm text-gray-700 font-mono truncate">
            {referralLink}
          </span>
          <button
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition"
          >
            {copied
              ? <><CheckCircle className="h-4 w-4 text-green-500" /> Copied!</>
              : <><Copy className="h-4 w-4" /> Copy</>
            }
          </button>
        </div>

        <button
          onClick={handleShare}
          className="mt-3 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition shadow-sm"
        >
          <Share2 className="h-4 w-4" />
          Share via WhatsApp / SMS
        </button>

        <p className="mt-3 text-xs text-gray-400">
          Commission amount is set by your landlord per unit. Ask them for details.
        </p>
      </section>

      {/* Vacant units in the building */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Home className="h-5 w-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-gray-900">
            Available units in your building
          </h2>
          <span className="ml-auto text-xs text-gray-400">
            {vacantUnits.length} vacant
          </span>
        </div>

        {vacantUnits.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-gray-50 py-10 text-center">
            <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No vacant units right now — fully occupied!</p>
            <p className="text-xs text-gray-400 mt-1">Check back later or ask your landlord.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {vacantUnits.map((unit) => (
              <div key={unit.id} className="rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      Unit {unit.unitNumber}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{unit.propertyName}</p>
                  </div>
                  <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    Vacant
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
                  {unit.rentAmount && (
                    <span className="font-medium text-indigo-700">
                      KES {unit.rentAmount.toLocaleString()}/mo
                    </span>
                  )}
                  {unit.bedrooms && (
                    <span>{unit.bedrooms} bed{unit.bedrooms !== 1 ? "s" : ""}</span>
                  )}
                  {unit.floor && <span>Floor {unit.floor}</span>}
                </div>

                <button
                  onClick={() => {
                    const msg = encodeURIComponent(
                      `Hi! There's a vacant unit available — Unit ${unit.unitNumber} at ${unit.propertyName}, KES ${unit.rentAmount?.toLocaleString() ?? "?"}/month. Sign up here and mention my referral: ${referralLink}`
                    );
                    window.open(`https://wa.me/?text=${msg}`, "_blank");
                  }}
                  className="mt-4 w-full flex items-center justify-center gap-2 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-sm font-medium py-2 rounded-lg transition"
                >
                  <Share2 className="h-4 w-4" />
                  Share this unit on WhatsApp
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Referral history */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-gray-900">My referral history</h2>
        </div>

        {referrals.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-gray-50 py-10 text-center">
            <Gift className="h-8 w-8 text-indigo-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No referrals yet — share your link to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {referrals.map((ref) => {
              const cfg = STATUS_CONFIG[ref.status] ?? STATUS_CONFIG.submitted;
              return (
                <div key={ref.id} className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{ref.referredName}</p>
                    <p className="text-xs text-gray-400">{ref.referredEmail}</p>
                    {ref.unitNumber && (
                      <p className="text-xs text-gray-500 mt-0.5">Unit {ref.unitNumber}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{cfg.desc}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badge}`}>
                      {cfg.icon}
                      {cfg.label}
                    </span>
                    {ref.commissionAmount != null && (
                      <span className={`text-sm font-bold ${ref.status === "paid" ? "text-green-600" : "text-blue-600"}`}>
                        KES {ref.commissionAmount.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </main>
  );
}
