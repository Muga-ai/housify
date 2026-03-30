"use client";

/**
 * app/tenant/dashboard/page.tsx
 *
 * FIXES (original):
 * 1. Replaced `auth.currentUser` (null on refresh) with `onAuthStateChanged`
 *    so the dashboard waits for Firebase to restore the session before fetching.
 * 2. `fetchTenantData` now receives the user object explicitly — no closure race.
 * 3. `setLoading(false)` is now always reached (was skipped when user was null).
 *
 * ADDITIONS:
 * 4. Referral CTA — fetches vacant unit count (same orgId) and shows a
 *    "Refer & Earn" banner after the Quick Actions section when vacancies exist.
 */

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection, query, where, getDocs,
  doc, updateDoc, getDoc,
} from "firebase/firestore";
import {
  Home, Wrench, FileText, CalendarDays, Loader2,
  Heart, AlertTriangle, CheckCircle, Gift,
} from "lucide-react";
import Link from "next/link";

type WellnessStatus = "green" | "yellow" | "red";

interface Tenant {
  id: string; name: string; email: string;
  propertyId?: string | null; unitId?: string | null;
  uid?: string | null; orgId?: string | null;
  status: "pending" | "active" | "disabled";
  wellnessStatus?: WellnessStatus;
}
interface Property { id: string; name: string; }
interface Unit {
  id: string; propertyId: string; unitNumber: string;
  rentAmount?: number; rentDueDay?: number;
}

export default function TenantDashboard() {
  // ── Auth state ──────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // ── Data state ──────────────────────────────────────────────────────────
  const [tenant,           setTenant]           = useState<Tenant | null>(null);
  const [property,         setProperty]         = useState<Property | null>(null);
  const [unit,             setUnit]             = useState<Unit | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [openRequests,     setOpenRequests]     = useState(0);
  const [updatingWellness, setUpdatingWellness] = useState(false);

  // ── Referral state ──────────────────────────────────────────────────────
  const [vacantCount, setVacantCount] = useState(0);

  // ── Step 1: wait for Firebase Auth to rehydrate ─────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, []);

  // ── Step 2: once auth is known, fetch tenant data ───────────────────────
  useEffect(() => {
    if (!authChecked) return;

    if (!currentUser) {
      // Not signed in — stop spinner; layout will handle redirect
      setLoading(false);
      return;
    }

    fetchTenantData(currentUser);
  }, [authChecked, currentUser]);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchTenantData = async (user: User) => {
    setLoading(true);
    try {
      // Prefer uid lookup (reliable after invite signup), fall back to email
      let tenantDoc: Tenant | null = null;

      const byUid = await getDocs(
        query(collection(db, "tenants"), where("uid", "==", user.uid))
      );
      if (!byUid.empty) {
        tenantDoc = { id: byUid.docs[0].id, ...byUid.docs[0].data() } as Tenant;
      } else {
        const byEmail = await getDocs(
          query(collection(db, "tenants"), where("email", "==", user.email))
        );
        if (!byEmail.empty) {
          tenantDoc = { id: byEmail.docs[0].id, ...byEmail.docs[0].data() } as Tenant;
        }
      }

      if (!tenantDoc) {
        setLoading(false);
        return;
      }
      setTenant(tenantDoc);

      // Property
      if (tenantDoc.propertyId) {
        const pSnap = await getDoc(doc(db, "properties", tenantDoc.propertyId));
        if (pSnap.exists()) setProperty({ id: tenantDoc.propertyId, ...pSnap.data() } as Property);
      }

      // Unit
      if (tenantDoc.unitId) {
        const uSnap = await getDoc(doc(db, "units", tenantDoc.unitId));
        if (uSnap.exists()) setUnit({ id: tenantDoc.unitId, ...uSnap.data() } as Unit);
      }

      // Open maintenance requests (keyed by uid, not tenantId doc)
      const maintSnap = await getDocs(
        query(
          collection(db, "maintenance_requests"),
          where("tenantId", "==", user.uid),
          where("status",   "!=", "resolved")
        )
      );
      setOpenRequests(maintSnap.size);

      // ── Fetch vacant units count for referral CTA ──────────────────────
      if (tenantDoc.orgId) {
        const vacantSnap = await getDocs(
          query(
            collection(db, "units"),
            where("orgId",    "==", tenantDoc.orgId),
            where("tenantId", "==", null)
          )
        );
        setVacantCount(vacantSnap.size);
      }
    } catch (err) {
      console.error("Error fetching tenant data:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Wellness update ──────────────────────────────────────────────────────
  const handleWellnessUpdate = async (status: WellnessStatus) => {
    if (!tenant || updatingWellness) return;
    setUpdatingWellness(true);
    try {
      await updateDoc(doc(db, "tenants", tenant.id), {
        wellnessStatus:    status,
        wellnessUpdatedAt: new Date(),
      });
      setTenant((prev) => prev ? { ...prev, wellnessStatus: status } : prev);
    } catch (err) {
      console.error(err);
      alert("Failed to update. Please try again.");
    } finally {
      setUpdatingWellness(false);
    }
  };

  // ── Loading spinner ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const displayName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "Tenant";

  const today         = new Date();
  const dueDay        = unit?.rentDueDay ?? 1;
  const rentDueDate   = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (rentDueDate < today) rentDueDate.setMonth(rentDueDate.getMonth() + 1);
  const rentDueFormatted = rentDueDate.toLocaleDateString("en-GB", {
    day: "numeric", month: "short",
  });

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <main className="bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-8">

        <header>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {displayName}!
          </h1>
          <p className="mt-1 text-gray-600">Manage your tenancy in one place</p>
        </header>

        {/* QUICK STATS */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Home className="h-8 w-8 text-indigo-600" />
              <div>
                <p className="text-sm text-gray-600">Your Unit</p>
                <p className="text-xl font-semibold">
                  {unit?.unitNumber || "—"} — {property?.name || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-8 w-8 text-indigo-600" />
              <div>
                <p className="text-sm text-gray-600">Rent Due</p>
                <p className="text-xl font-semibold">
                  {unit?.rentAmount
                    ? `KES ${unit.rentAmount.toLocaleString()} • ${rentDueFormatted}`
                    : "Not assigned yet"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Wrench className="h-8 w-8 text-indigo-600" />
              <div>
                <p className="text-sm text-gray-600">Open Requests</p>
                <p className="text-xl font-semibold">{openRequests}</p>
              </div>
            </div>
          </div>
        </section>

        {/* WELLNESS CARD */}
        <section>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="h-5 w-5 text-rose-500" />
              <h2 className="text-base font-semibold text-gray-900">My Payment Wellness</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Let your landlord know your current situation.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["green", "yellow", "red"] as WellnessStatus[]).map((status) => {
                const cfg = {
                  green:  { dot: "bg-green-500",  active: "border-green-500 bg-green-50",   hover: "hover:border-green-300",  label: "All Good",  sub: "I can pay rent on time"   },
                  yellow: { dot: "bg-yellow-400", active: "border-yellow-500 bg-yellow-50", hover: "hover:border-yellow-300", label: "Uncertain", sub: "Slight delay possible"    },
                  red:    { dot: "bg-red-500",    active: "border-red-500 bg-red-50",       hover: "hover:border-red-300",    label: "In Crisis", sub: "Emergency — need support" },
                }[status];
                const isActive = tenant?.wellnessStatus === status;
                return (
                  <button
                    key={status}
                    onClick={() => handleWellnessUpdate(status)}
                    disabled={updatingWellness}
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-4 text-left transition-all disabled:opacity-60 ${
                      isActive ? cfg.active : `border-gray-200 ${cfg.hover} hover:bg-gray-50/50`
                    }`}
                  >
                    <span className={`h-4 w-4 rounded-full ${cfg.dot} shrink-0`} />
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{cfg.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{cfg.sub}</p>
                    </div>
                    {isActive && <CheckCircle className="h-4 w-4 text-current ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>

            {tenant?.wellnessStatus === "red" && (
              <div className="mt-4 flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  Your landlord can see this. They will reach out to discuss options.
                </p>
              </div>
            )}
            {tenant?.wellnessStatus === "yellow" && (
              <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3">
                <p className="text-sm text-yellow-700">
                  Your landlord is aware there may be a delay.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* QUICK ACTIONS */}
        <section className="grid gap-6 md:grid-cols-2">
          <Link href="/tenant/maintenance"
            className="rounded-xl border bg-white p-8 shadow-sm hover:shadow-md transition flex items-center gap-4">
            <Wrench className="h-10 w-10 text-indigo-600" />
            <div>
              <h3 className="text-lg font-semibold">Maintenance Requests</h3>
              <p className="text-sm text-gray-600">Submit or track issues</p>
            </div>
          </Link>
          <Link href="/tenant/payments"
            className="rounded-xl border bg-white p-8 shadow-sm hover:shadow-md transition flex items-center gap-4">
            <FileText className="h-10 w-10 text-indigo-600" />
            <div>
              <h3 className="text-lg font-semibold">Rent Payments</h3>
              <p className="text-sm text-gray-600">Submit payment details for verification</p>
            </div>
          </Link>
        </section>

        {/* REFERRAL CTA — only shown when there are vacant units in the org */}
        {vacantCount > 0 && (
          <section>
            <Link
              href="/tenant/refer"
              className="flex items-center gap-4 rounded-xl border-2 border-indigo-100 bg-gradient-to-r from-indigo-50 to-white p-5 shadow-sm hover:shadow-md transition group"
            >
              <div className="rounded-xl bg-indigo-600 p-3 shrink-0">
                <Gift className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition">
                  {vacantCount} vacant unit{vacantCount !== 1 ? "s" : ""} in your building
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Know someone looking for a place? Refer them and earn a commission when they move in.
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-indigo-600 group-hover:underline whitespace-nowrap">
                Refer &amp; Earn →
              </span>
            </Link>
          </section>
        )}

      </div>
    </main>
  );
}
