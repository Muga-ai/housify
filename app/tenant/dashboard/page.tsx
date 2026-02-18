"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Home, Wrench, FileText, CalendarDays, Loader2 } from "lucide-react";
import Link from "next/link";

/* ---------------- TYPES ---------------- */

interface Tenant {
  id: string;
  name: string;
  email: string;
  propertyId?: string | null;
  unitId?: string | null;
  status: "pending" | "active" | "disabled";
}

interface Property {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
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
      } catch (err) {
        console.error("Error fetching tenant data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTenantData();
  }, [user]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );

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
                  {unit?.unitNumber || "-"} - {property?.name || "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-8 w-8 text-indigo-600" />
              <div>
                <p className="text-sm text-gray-600">Rent Due</p>
                <p className="text-xl font-semibold">KES 45,000 • Jan 31</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Wrench className="h-8 w-8 text-indigo-600" />
              <div>
                <p className="text-sm text-gray-600">Open Requests</p>
                <p className="text-xl font-semibold">0</p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
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
