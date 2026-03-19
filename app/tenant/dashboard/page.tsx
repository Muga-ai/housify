"use client";

/**
 * app/tenant/dashboard/page.tsx
 *
 * Changes from previous:
 * - Reads `unit.rentAmount` (was `unit.rent`) to match updated units schema
 * - Removed "coming soon" from Rent Payments link — it's live now
 * - Rent due date now reads `unit.rentDueDay` for accuracy
 * - Everything else identical
 */

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection, query, where, getDocs,
  doc, updateDoc, getDoc,
} from "firebase/firestore";
import {
  Home, Wrench, FileText, CalendarDays, Loader2,
  Heart, AlertTriangle, CheckCircle,
} from "lucide-react";
import Link from "next/link";

/* ── TYPES ── */
type WellnessStatus = "green" | "yellow" | "red";

interface Tenant {
  id: string;
  name: string;
  email: string;
  propertyId?: string | null;
  unitId?: string | null;
  status: "pending" | "active" | "disabled";
  wellnessStatus?: WellnessStatus;
}

interface Property { id: string; name: string; }

interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  rentAmount?: number;   // ← FIXED: was `rent`
  rentDueDay?: number;   // ← ADDED: for accurate due date display
}

/* ── PAGE ── */
export default function TenantDashboard() {
  const user = auth.currentUser;
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Tenant";

  const [tenant,   setTenant]   = useState<Tenant | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [unit,     setUnit]     = useState<Unit | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [openRequests, setOpenRequests] = useState(0);
  const [updatingWellness, setUpdatingWellness] = useState(false);

  useEffect(() => {
    const fetchTenantData = async () => {
      if (!user) return;
      try {
        const tenantQuery = query(
          collection(db, "tenants"),
          where("email", "==", user.email)
        );
        const tenantSnap = await getDocs(tenantQuery);
        if (tenantSnap.empty) return;

        const t = { id: tenantSnap.docs[0].id, ...tenantSnap.docs[0].data() } as Tenant;
        setTenant(t);

        if (t.propertyId) {
          const pSnap = await getDoc(doc(db, "properties", t.propertyId));
          if (pSnap.exists()) setProperty({ id: t.propertyId, ...pSnap.data() } as Property);
        }

        if (t.unitId) {
          const uSnap = await getDoc(doc(db, "units", t.unitId));
          if (uSnap.exists()) setUnit({ id: t.unitId, ...uSnap.data() } as Unit);
        }

        const maintenanceSnap = await getDocs(
          query(
            collection(db, "maintenance_requests"),
            where("tenantId", "==", user.uid),
            where("status", "!=", "resolved")
          )
        );
        setOpenRequests(maintenanceSnap.size);
      } catch (err) {
        console.error("Error fetching tenant data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTenantData();
  }, [user]);

  const handleWellnessUpdate = async (status: WellnessStatus) => {
    if (!tenant || updatingWellness) return;
    setUpdatingWellness(true);
    try {
      await updateDoc(doc(db, "tenants", tenant.id), {
        wellnessStatus: status,
        wellnessUpdatedAt: new Date(),
      });
      setTenant((prev) => prev ? { ...prev, wellnessStatus: status } : prev);
    } catch (err) {
      console.error("Failed to update wellness status:", err);
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingWellness(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  /* ── Rent due date — uses actual rentDueDay from unit ── */
  const today = new Date();
  const dueDay = unit?.rentDueDay ?? 1;
  const rentDueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
  // If already past this month's due date, show next month
  if (rentDueDate < today) {
    rentDueDate.setMonth(rentDueDate.getMonth() + 1);
  }
  const rentDueFormatted = rentDueDate.toLocaleDateString("en-GB", {
    day: "numeric", month: "short",
  });

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-8">

        <header>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {displayName}!
          </h1>
          <p className="mt-1 text-gray-600">Manage your tenancy in one place</p>
        </header>

        {/* Quick Stats */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Home className="h-8 w-8 text-indigo-600" />
              <div>
                <p className="text-sm text-gray-600">Your Unit</p>
                <p className="text-xl font-semibold">
                  {unit?.unitNumber || "-"} — {property?.name || "-"}
                </p>
              </div>
            </div>
          </div>

          {/* ← FIXED: reads rentAmount not rent */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-8 w-8 text-indigo-600" />
              <div>
                <p className="text-sm text-gray-600">Rent Due</p>
                <p className="text-xl font-semibold">
                  {unit?.rentAmount
                    ? `KES ${unit.rentAmount.toLocaleString()} • ${rentDueFormatted}`
                    : "Not assigned"}
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

        {/* Wellness Status Card — unchanged */}
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
                const config = {
                  green:  { dot: "bg-green-500",  active: "border-green-500 bg-green-50",   hover: "hover:border-green-300",  label: "All Good",  sub: "I can pay rent on time"    },
                  yellow: { dot: "bg-yellow-400", active: "border-yellow-500 bg-yellow-50", hover: "hover:border-yellow-300", label: "Uncertain", sub: "Slight delay possible"     },
                  red:    { dot: "bg-red-500",    active: "border-red-500 bg-red-50",       hover: "hover:border-red-300",    label: "In Crisis", sub: "Emergency — need support"  },
                }[status];

                return (
                  <button
                    key={status}
                    onClick={() => handleWellnessUpdate(status)}
                    disabled={updatingWellness}
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-4 text-left transition-all disabled:opacity-60 ${
                      tenant?.wellnessStatus === status
                        ? config.active
                        : `border-gray-200 ${config.hover} hover:bg-gray-50/50`
                    }`}
                  >
                    <span className={`h-4 w-4 rounded-full ${config.dot} shrink-0`} />
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{config.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{config.sub}</p>
                    </div>
                    {tenant?.wellnessStatus === status && (
                      <CheckCircle className="h-4 w-4 text-current ml-auto shrink-0" />
                    )}
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

        {/* Quick Actions — payments link is now live */}
        <section className="grid gap-6 md:grid-cols-2">
          <Link
            href="/tenant/maintenance"
            className="rounded-xl border bg-white p-8 shadow-sm hover:shadow-md transition flex items-center gap-4"
          >
            <Wrench className="h-10 w-10 text-indigo-600" />
            <div>
              <h3 className="text-lg font-semibold">Maintenance Requests</h3>
              <p className="text-sm text-gray-600">Submit or track issues</p>
            </div>
          </Link>

          {/* ← UPDATED: removed "coming soon", now live */}
          <Link
            href="/tenant/payments"
            className="rounded-xl border bg-white p-8 shadow-sm hover:shadow-md transition flex items-center gap-4"
          >
            <FileText className="h-10 w-10 text-indigo-600" />
            <div>
              <h3 className="text-lg font-semibold">Rent Payments</h3>
              <p className="text-sm text-gray-600">Submit payment details for verification</p>
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}
