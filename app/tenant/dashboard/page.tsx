"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,          // ← ADDED
  updateDoc,    // ← ADDED
  getDoc,       // ← ADDED
} from "firebase/firestore";
import {
  Home,
  Wrench,
  FileText,
  CalendarDays,
  Loader2,
  Heart,        // ← ADDED: wellness status icon
  AlertTriangle, // ← ADDED
  CheckCircle,  // ← ADDED
} from "lucide-react";
import Link from "next/link";

/* ---------------- TYPES ---------------- */

// ← ADDED: wellness status type
type WellnessStatus = "green" | "yellow" | "red";

interface Tenant {
  id: string;
  name: string;
  email: string;
  propertyId?: string | null;
  unitId?: string | null;
  status: "pending" | "active" | "disabled";
  wellnessStatus?: WellnessStatus; // ← ADDED
}

interface Property {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  rent?: number; // ← ADDED: so we can show real rent amount
}

/* ---------------- PAGE ---------------- */

export default function TenantDashboard() {
  const user = auth.currentUser;
  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "Tenant";

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [openRequests, setOpenRequests] = useState(0); // ← ADDED: real count
  const [updatingWellness, setUpdatingWellness] = useState(false); // ← ADDED

  useEffect(() => {
    const fetchTenantData = async () => {
      if (!user) return;

      try {
        // 1️⃣ Get tenant record by email
        const tenantQuery = query(
          collection(db, "tenants"),
          where("email", "==", user.email)
        );
        const tenantSnap = await getDocs(tenantQuery);

        if (tenantSnap.empty) return;

        const t = { id: tenantSnap.docs[0].id, ...tenantSnap.docs[0].data() } as Tenant;
        setTenant(t);

        // 2️⃣ Fetch property
        if (t.propertyId) {
          const propertySnap = await getDocs(
            query(collection(db, "properties"), where("__name__", "==", t.propertyId))
          );
          if (!propertySnap.empty) {
            setProperty({ id: t.propertyId, ...propertySnap.docs[0].data() } as Property);
          }
        }

        // 3️⃣ Fetch unit
        if (t.unitId) {
          const unitSnap = await getDocs(
            query(collection(db, "units"), where("__name__", "==", t.unitId))
          );
          if (!unitSnap.empty) {
            setUnit({ id: t.unitId, ...unitSnap.docs[0].data() } as Unit);
          }
        }

        // ← ADDED: 4️⃣ Count open maintenance requests for this tenant
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

  /* ← ADDED: Wellness status update handler */
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

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );

  // Rent due date — 1st of next month
  const today = new Date();
  const rentDueDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const rentDueFormatted = rentDueDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
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

        {/* Quick Stats Grid */}
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

          {/* ← UPDATED: shows real rent from unit record */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-8 w-8 text-indigo-600" />
              <div>
                <p className="text-sm text-gray-600">Rent Due</p>
                <p className="text-xl font-semibold">
                  {unit?.rent
                    ? `KES ${unit.rent.toLocaleString()} • ${rentDueFormatted}`
                    : "Not assigned"}
                </p>
              </div>
            </div>
          </div>

          {/* ← UPDATED: shows real open request count */}
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

        {/* ← ADDED: Wellness Status Card */}
        <section>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="h-5 w-5 text-rose-500" />
              <h2 className="text-base font-semibold text-gray-900">
                My Payment Wellness
              </h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Let your landlord know your current situation. This helps them
              support you without a phone call.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* GREEN */}
              <button
                onClick={() => handleWellnessUpdate("green")}
                disabled={updatingWellness}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-4 text-left transition-all disabled:opacity-60 ${
                  tenant?.wellnessStatus === "green"
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-green-300 hover:bg-green-50/50"
                }`}
              >
                <span className="h-4 w-4 rounded-full bg-green-500 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">All Good</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    I can pay rent on time
                  </p>
                </div>
                {tenant?.wellnessStatus === "green" && (
                  <CheckCircle className="h-4 w-4 text-green-500 ml-auto shrink-0" />
                )}
              </button>

              {/* YELLOW */}
              <button
                onClick={() => handleWellnessUpdate("yellow")}
                disabled={updatingWellness}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-4 text-left transition-all disabled:opacity-60 ${
                  tenant?.wellnessStatus === "yellow"
                    ? "border-yellow-500 bg-yellow-50"
                    : "border-gray-200 hover:border-yellow-300 hover:bg-yellow-50/50"
                }`}
              >
                <span className="h-4 w-4 rounded-full bg-yellow-400 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Uncertain</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Slight delay possible
                  </p>
                </div>
                {tenant?.wellnessStatus === "yellow" && (
                  <CheckCircle className="h-4 w-4 text-yellow-500 ml-auto shrink-0" />
                )}
              </button>

              {/* RED */}
              <button
                onClick={() => handleWellnessUpdate("red")}
                disabled={updatingWellness}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-4 text-left transition-all disabled:opacity-60 ${
                  tenant?.wellnessStatus === "red"
                    ? "border-red-500 bg-red-50"
                    : "border-gray-200 hover:border-red-300 hover:bg-red-50/50"
                }`}
              >
                <span className="h-4 w-4 rounded-full bg-red-500 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">In Crisis</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Emergency — need support
                  </p>
                </div>
                {tenant?.wellnessStatus === "red" && (
                  <CheckCircle className="h-4 w-4 text-red-500 ml-auto shrink-0" />
                )}
              </button>
            </div>

            {/* Context note when red is selected */}
            {tenant?.wellnessStatus === "red" && (
              <div className="mt-4 flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  Your landlord can see this. They will reach out to discuss
                  options. You do not need to make a call.
                </p>
              </div>
            )}

            {tenant?.wellnessStatus === "yellow" && (
              <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3">
                <p className="text-sm text-yellow-700">
                  Your landlord is aware there may be a delay. No action needed
                  from you right now.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Quick Actions — unchanged from original */}
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

          <Link
            href="/tenant/payments"
            className="rounded-xl border bg-white p-8 shadow-sm hover:shadow-md transition flex items-center gap-4"
          >
            <FileText className="h-10 w-10 text-indigo-600" />
            <div>
              <h3 className="text-lg font-semibold">Rent Payments</h3>
              <p className="text-sm text-gray-600">View history and pay (coming soon)</p>
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}
