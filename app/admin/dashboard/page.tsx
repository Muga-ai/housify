"use client";

/**
 * app/admin/dashboard/page.tsx
 *
 * Changes from previous:
 * - Units now fetched with rentAmount field included
 * - Expected rent calculated from sum of occupied unit rentAmounts
 * - Collection efficiency = verified revenue / expected rent
 * - Payment summary panel now shows expected vs collected vs pending
 * - Added FindAHome vacant listings CTA section
 * - Everything else identical
 */

import { useEffect, useState } from "react";
import {
  Building2, Users, Wrench, BarChart3, ArrowUpRight,
  Heart, AlertTriangle, CheckCircle, Minus, Hammer,
  Receipt, TrendingUp, Home, ExternalLink,
} from "lucide-react";
import {
  collection, getDocs, orderBy, limit, query, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useOrgContext } from "@/lib/org-context";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import Link from "next/link";

/* ================= TYPES ================= */

interface Property { id: string; name: string; location?: string; }

// ← UPDATED: added rentAmount so we can calculate expected rent
interface Unit {
  id: string;
  tenantId?: string;
  rentAmount?: number;
  status?: string;
}

interface Tenant {
  id: string; name: string; email: string;
  unitId?: string | null; propertyId?: string | null;
  wellnessStatus?: "green" | "yellow" | "red";
}
interface MaintenanceRequest { id: string; status: string; }

interface Payment {
  id: string;
  tenantId: string;
  amount: number;
  month: string;
  status: "pending" | "verified" | "rejected";
  tenantName?: string;
}

/* ================= PAGE ================= */

export default function AdminDashboard() {
  const { orgId } = useOrgContext();
  const [loading, setLoading] = useState(true);

  const [propertyCount,    setPropertyCount]    = useState(0);
  const [unitCount,        setUnitCount]        = useState(0);
  const [tenantCount,      setTenantCount]      = useState(0);
  const [openIssues,       setOpenIssues]       = useState(0);
  const [occupiedUnits,    setOccupiedUnits]    = useState(0);
  const [vacantCount,      setVacantCount]      = useState(0);         // ← ADDED
  const [expectedRent,     setExpectedRent]     = useState(0);         // ← ADDED
  const [recentProperties, setRecentProperties] = useState<Property[]>([]);
  const [recentTenants,    setRecentTenants]    = useState<Tenant[]>([]);
  const [allTenants,       setAllTenants]       = useState<Tenant[]>([]);
  const [payments,         setPayments]         = useState<Payment[]>([]);

  useEffect(() => {
    if (!orgId) return;

    const fetchDashboardData = async () => {
      try {
        const orgFilter    = where("orgId", "==", orgId);
        const currentMonth = `${new Date().getFullYear()}-${String(
          new Date().getMonth() + 1
        ).padStart(2, "0")}`;

        const [propSnap, unitSnap, tenantSnap, maintSnap, paymentSnap] =
          await Promise.all([
            getDocs(query(collection(db, "properties"),           orgFilter)),
            getDocs(query(collection(db, "units"),                orgFilter)),
            getDocs(query(collection(db, "tenants"),              orgFilter)),
            getDocs(query(collection(db, "maintenance_requests"), orgFilter)),
            getDocs(
              query(
                collection(db, "payments"),
                orgFilter,
                where("month", "==", currentMonth)
              )
            ),
          ]);

        setPropertyCount(propSnap.size);

        // ← UPDATED: extract rentAmount for expected rent calculation
        const unitsArr = unitSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Unit)
        );
        setUnitCount(unitsArr.length);

        const occupied = unitsArr.filter((u) => u.tenantId);
        const vacant   = unitsArr.filter((u) => !u.tenantId);
        setOccupiedUnits(occupied.length);
        setVacantCount(vacant.length);                                 // ← ADDED

        // ← ADDED: sum rentAmount across occupied units only
        const totalExpected = occupied.reduce(
          (sum, u) => sum + (u.rentAmount ?? 0),
          0
        );
        setExpectedRent(totalExpected);

        setTenantCount(tenantSnap.size);

        const tenantsArr = tenantSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Tenant)
        );
        setAllTenants(tenantsArr);

        const maintArr = maintSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as MaintenanceRequest)
        );
        setOpenIssues(maintArr.filter((m) => m.status !== "resolved").length);

        const tenantMap = Object.fromEntries(
          tenantsArr.map((t) => [t.id, t.name])
        );
        setPayments(
          paymentSnap.docs.map(
            (d) =>
              ({
                id: d.id,
                ...d.data(),
                tenantName: tenantMap[d.data().tenantId] ?? "Unknown",
              } as Payment)
          )
        );

        const recentPropSnap = await getDocs(
          query(
            collection(db, "properties"),
            orgFilter,
            orderBy("createdAt", "desc"),
            limit(5)
          )
        );
        setRecentProperties(
          recentPropSnap.docs.map((d) => ({
            id:       d.id,
            name:     d.data().name     as string,
            location: d.data().location as string | undefined,
          }))
        );

        const recentTenantSnap = await getDocs(
          query(
            collection(db, "tenants"),
            orgFilter,
            orderBy("createdAt", "desc"),
            limit(5)
          )
        );
        setRecentTenants(
          recentTenantSnap.docs.map((d) => ({
            id:    d.id,
            name:  d.data().name  as string,
            email: d.data().email as string,
          }))
        );
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [orgId]);

  /* ── Derived values ── */
  const occupancyRate = unitCount === 0
    ? 0
    : Math.round((occupiedUnits / unitCount) * 100);

  const occupancyData = [
    { name: "Occupied", value: occupiedUnits },
    { name: "Vacant",   value: vacantCount   },
  ];
  const COLORS = ["#4F46E5", "#E5E7EB"];

  const wellnessGreen  = allTenants.filter((t) => t.wellnessStatus === "green").length;
  const wellnessYellow = allTenants.filter((t) => t.wellnessStatus === "yellow").length;
  const wellnessRed    = allTenants.filter((t) => t.wellnessStatus === "red").length;
  const wellnessUnset  = allTenants.filter((t) => !t.wellnessStatus).length;

  const tenantsNeedingAttention = allTenants
    .filter((t) => t.wellnessStatus === "red" || t.wellnessStatus === "yellow")
    .sort((a, b) =>
      a.wellnessStatus === "red" && b.wellnessStatus !== "red" ? -1 : 1
    );

  const verifiedPayments  = payments.filter((p) => p.status === "verified");
  const pendingPayments   = payments.filter((p) => p.status === "pending");
  const monthlyRevenue    = verifiedPayments.reduce((sum, p) => sum + p.amount, 0);
  const collectionRate    = tenantCount === 0
    ? 0
    : Math.round((verifiedPayments.length / tenantCount) * 100);

  // ← ADDED: what % of expected rent has been verified
  const revenueEfficiency = expectedRent === 0
    ? 0
    : Math.round((monthlyRevenue / expectedRent) * 100);

  // ← ADDED: outstanding = expected - verified revenue
  const outstandingRent = Math.max(0, expectedRent - monthlyRevenue);

  /* ── FindAHome listing URL with utm tracking ── */
  const findAHomeUrl =
    `https://www.findahome.co.ke/?utm_source=housify&utm_medium=dashboard&utm_campaign=vacant_units`;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">

        {/* HEADER */}
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">
            Real-time overview of your properties and tenants
          </p>
        </header>

        {/* STAT CARDS */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Properties"  value={propertyCount.toString()} trend="Live"    icon={<Building2 className="h-6 w-6 text-indigo-600" />} />
          <StatCard title="Tenants"     value={tenantCount.toString()}   trend="Active"  icon={<Users     className="h-6 w-6 text-indigo-600" />} />
          <StatCard title="Occupancy"   value={`${occupancyRate}%`}      trend={`${occupiedUnits}/${unitCount}`} icon={<BarChart3 className="h-6 w-6 text-indigo-600" />} />
          <StatCard title="Open Issues" value={openIssues.toString()}    trend="Pending" icon={<Wrench    className="h-6 w-6 text-indigo-600" />} />
        </section>

        {/* ── PAYMENT SUMMARY PANEL ── */}
        <section>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-indigo-600" />
                <h2 className="text-base font-semibold text-gray-900">
                  This Month Rent Collection
                </h2>
              </div>
              <Link
                href="/admin/payments"
                className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            {/* ← UPDATED: 5-card summary including expected rent */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
              <div className="rounded-lg bg-gray-50 border p-4">
                <p className="text-xs text-gray-500 font-medium">Expected</p>
                <p className="text-lg font-bold text-gray-800 mt-1">
                  KES {expectedRent.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {occupiedUnits} occupied unit{occupiedUnits !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="rounded-lg bg-indigo-50 p-4">
                <p className="text-xs text-indigo-600 font-medium">Collected</p>
                <p className="text-lg font-bold text-indigo-700 mt-1">
                  KES {monthlyRevenue.toLocaleString()}
                </p>
                <p className="text-xs text-indigo-400 mt-0.5">
                  {revenueEfficiency}% of expected
                </p>
              </div>
              <div className="rounded-lg bg-red-50 p-4">
                <p className="text-xs text-red-500 font-medium">Outstanding</p>
                <p className="text-lg font-bold text-red-700 mt-1">
                  KES {outstandingRent.toLocaleString()}
                </p>
                <p className="text-xs text-red-400 mt-0.5">
                  Not yet verified
                </p>
              </div>
              <div className="rounded-lg bg-green-50 p-4">
                <p className="text-xs text-green-600 font-medium">Paid Tenants</p>
                <p className="text-lg font-bold text-green-700 mt-1">
                  {verifiedPayments.length} / {tenantCount}
                </p>
                <p className="text-xs text-green-400 mt-0.5">
                  {collectionRate}% collection rate
                </p>
              </div>
              <div className="rounded-lg bg-yellow-50 p-4">
                <p className="text-xs text-yellow-600 font-medium">Pending</p>
                <p className="text-lg font-bold text-yellow-700 mt-1">
                  {pendingPayments.length}
                </p>
                <p className="text-xs text-yellow-400 mt-0.5">
                  Awaiting verification
                </p>
              </div>
            </div>

            {/* Progress bar: collected vs expected */}
            {expectedRent > 0 && (
              <div className="mb-5">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Collection progress</span>
                  <span>{revenueEfficiency}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-100">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      revenueEfficiency >= 80
                        ? "bg-green-500"
                        : revenueEfficiency >= 50
                        ? "bg-yellow-400"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(revenueEfficiency, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Pending payments list */}
            {pendingPayments.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Awaiting verification
                </p>
                <div className="space-y-2">
                  {pendingPayments.slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border bg-yellow-50 px-4 py-3"
                    >
                      <p className="text-sm font-medium text-gray-800">
                        {p.tenantName}
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">
                          KES {p.amount.toLocaleString()}
                        </span>
                        <Link
                          href="/admin/payments"
                          className="text-xs text-indigo-600 hover:underline font-medium"
                        >
                          Verify →
                        </Link>
                      </div>
                    </div>
                  ))}
                  {pendingPayments.length > 5 && (
                    <Link
                      href="/admin/payments"
                      className="block text-center text-sm text-indigo-600 hover:underline pt-1"
                    >
                      + {pendingPayments.length - 5} more pending
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-gray-50 py-6 text-center">
                <TrendingUp className="h-7 w-7 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {verifiedPayments.length > 0
                    ? "No pending verifications — you are all caught up!"
                    : "No payments submitted yet this month."}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── FINDAHOME VACANT LISTINGS CTA ── */}
        {vacantCount > 0 && (
          <section>
            <div className="rounded-xl border-2 border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-indigo-600 p-3 shrink-0">
                    <Home className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-bold text-gray-900">
                        {vacantCount} Vacant Unit{vacantCount !== 1 ? "s" : ""} Needs a Tenant
                      </h2>
                      <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {vacantCount} empty
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 max-w-lg">
                      Every vacant unit is lost revenue. List your vacancies on{" "}
                      <span className="font-semibold text-indigo-700">FindAHome.co.ke</span>{" "}
                      to reach thousands of Kenyan house hunters actively searching right now.
                    </p>
                    <p className="text-xs text-gray-400 mt-1.5">
                      Lost revenue this month:{" "}
                      <span className="font-semibold text-red-500">
                        KES{" "}
                        {/* Estimate based on average rent of occupied units */}
                        {occupiedUnits > 0 && expectedRent > 0
                          ? Math.round(
                              (expectedRent / occupiedUnits) * vacantCount
                            ).toLocaleString()
                          : "—"}
                      </span>{" "}
                      (estimated at average rent)
                    </p>
                  </div>
                </div>

                <a
                  href={findAHomeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition shadow-md hover:shadow-lg"
                >
                  List on FindAHome
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </section>
        )}

        {/* ── TENANT WELLNESS PANEL ── */}
        <section>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-rose-500" />
                <h2 className="text-base font-semibold text-gray-900">
                  Tenant Payment Wellness
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <WellnessSummaryBadge color="green"  count={wellnessGreen}  label="Good"      />
                <WellnessSummaryBadge color="yellow" count={wellnessYellow} label="Uncertain"  />
                <WellnessSummaryBadge color="red"    count={wellnessRed}    label="Crisis"    />
              </div>
            </div>

            {wellnessRed > 0 && (
              <div className="mb-4 flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                <p className="text-sm text-red-700 font-medium">
                  {wellnessRed} tenant{wellnessRed > 1 ? "s are" : " is"} reporting a
                  crisis. Consider reaching out directly.
                </p>
              </div>
            )}

            {tenantsNeedingAttention.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Needs attention
                </p>
                {tenantsNeedingAttention.map((tenant) => (
                  <TenantWellnessRow key={tenant.id} tenant={tenant} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-gray-50 py-8 text-center">
                <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  All tenants are reporting good payment health
                </p>
              </div>
            )}

            {allTenants.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-indigo-600 hover:underline select-none">
                  View all {allTenants.length} tenants
                </summary>
                <div className="mt-3 space-y-2">
                  {allTenants.map((tenant) => (
                    <TenantWellnessRow key={tenant.id} tenant={tenant} />
                  ))}
                </div>
              </details>
            )}
          </div>
        </section>

        {/* ── FUNDIPLUS CTA ── */}
        <section>
          <div className="rounded-3xl border bg-white p-8 shadow-sm overflow-hidden relative">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 px-5 py-1.5 text-sm font-semibold text-amber-700 mb-4">
                  <Hammer className="h-4 w-4" />
                  POWERED BY FUNDIPLUS
                </div>
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-3">
                  Need repairs or maintenance?
                </h2>
                <p className="text-lg text-gray-600 max-w-lg">
                  Instantly hire trusted fundis in Nairobi. Vetted professionals
                  • Transparent pricing.
                </p>
              </div>
              <a
                href="https://fundiplus.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex-shrink-0 flex items-center justify-center gap-3 bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white font-semibold text-xl px-12 py-5 rounded-3xl shadow-2xl transition-all active:scale-[0.97] hover:-translate-y-0.5"
              >
                Hire a Fundi Now
                <ArrowUpRight className="h-6 w-6 group-hover:rotate-45 transition-transform" />
              </a>
            </div>
            <div className="absolute -bottom-12 -right-12 h-48 w-48 bg-gradient-to-br from-amber-200/20 to-transparent rounded-full blur-3xl" />
          </div>
        </section>

        {/* ── PANELS ── */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Panel title="Recent Properties">
              {recentProperties.length === 0 ? (
                <EmptyState message="No properties yet." />
              ) : (
                <ul className="space-y-3 text-sm">
                  {recentProperties.map((p) => (
                    <li key={p.id} className="font-medium text-gray-700">
                      {p.name} {p.location ? `(${p.location})` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Recent Tenants">
              {recentTenants.length === 0 ? (
                <EmptyState message="No tenants yet." />
              ) : (
                <ul className="space-y-3 text-sm">
                  {recentTenants.map((t) => (
                    <li key={t.id}>
                      <p className="font-medium text-gray-700">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.email}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="Occupancy Chart">
              {unitCount === 0 ? (
                <EmptyState message="No units yet." />
              ) : (
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={occupancyData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={5}
                        label
                      >
                        {occupancyData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="mt-2 text-center text-sm text-gray-600">
                    {occupiedUnits} occupied / {vacantCount} vacant —{" "}
                    {occupancyRate}%
                  </p>
                </div>
              )}
            </Panel>

            <Panel title="Quick Insights">
              <ul className="space-y-3 text-sm text-gray-600">
                <li>• Total units: {unitCount}</li>
                <li>• Occupied: {occupiedUnits}</li>
                <li>• Vacant: {vacantCount}</li>
                <li>• Occupancy rate: {occupancyRate}%</li>
                <li>• Open maintenance: {openIssues}</li>
                <li className="pt-2 border-t">
                  <span className="font-medium text-gray-700">
                    Rent this month:
                  </span>
                </li>
                <li>• Expected: KES {expectedRent.toLocaleString()}</li>
                <li>• Collected: KES {monthlyRevenue.toLocaleString()}</li>
                <li>• Outstanding: KES {outstandingRent.toLocaleString()}</li>
                <li>• Efficiency: {revenueEfficiency}%</li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  Verified: {verifiedPayments.length}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  Pending: {pendingPayments.length}
                </li>
                <li className="pt-2 border-t">
                  <span className="font-medium text-gray-700">Wellness:</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  Good: {wellnessGreen}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  Uncertain: {wellnessYellow}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  Crisis: {wellnessRed}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                  Not set: {wellnessUnset}
                </li>
              </ul>
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ================= COMPONENTS ================= */

function TenantWellnessRow({ tenant }: { tenant: Tenant }) {
  const status  = tenant.wellnessStatus;
  const config  = {
    green:  { dot: "bg-green-500",  badge: "bg-green-100 text-green-700",   label: "All Good"  },
    yellow: { dot: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-700", label: "Uncertain" },
    red:    { dot: "bg-red-500",    badge: "bg-red-100 text-red-700",       label: "In Crisis" },
  };
  const current = status ? config[status] : null;
  return (
    <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className={`h-3 w-3 rounded-full shrink-0 ${
            current ? current.dot : "bg-gray-300"
          }`}
        />
        <div>
          <p className="text-sm font-medium text-gray-800">{tenant.name}</p>
          <p className="text-xs text-gray-500">{tenant.email}</p>
        </div>
      </div>
      {current ? (
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${current.badge}`}
        >
          {current.label}
        </span>
      ) : (
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-400 flex items-center gap-1">
          <Minus className="h-3 w-3" /> Not set
        </span>
      )}
    </div>
  );
}

function WellnessSummaryBadge({
  color,
  count,
  label,
}: {
  color: "green" | "yellow" | "red";
  count: number;
  label: string;
}) {
  const colors = {
    green:  "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red:    "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colors[color]}`}>
      {count} {label}
    </span>
  );
}

function StatCard({
  title, value, trend, icon,
}: {
  title: string; value: string; trend: string; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        {icon}
      </div>
      <div className="mt-4 flex items-end justify-between">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        <span className="flex items-center gap-1 text-xs font-medium text-green-600">
          {trend} <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

function Panel({
  title, children,
}: {
  title: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-gray-50 p-6 text-center text-sm text-gray-500">
      {message}
    </div>
  );
}
