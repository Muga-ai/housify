"use client";

import { auth } from "@/lib/firebase";
import { Home, Wrench, FileText, CalendarDays } from "lucide-react";
import Link from "next/link";

export default function TenantDashboard() {
  const user = auth.currentUser;
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Tenant";

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <header>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {displayName}!
          </h1>
          <p className="mt-1 text-gray-600">
            Manage your tenancy in one place
          </p>
        </header>

        {/* Quick Stats Grid */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Home className="h-8 w-8 text-indigo-600" />
              <div>
                <p className="text-sm text-gray-600">Your Unit</p>
                <p className="text-xl font-semibold">A4 - Green Apartments</p>
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
                <p className="text-xl font-semibold">2</p>
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