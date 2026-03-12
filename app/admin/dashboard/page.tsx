"use client";

/**
 * app/admin/dashboard/page.tsx  (UPDATED)
 *
 * Changes from previous version:
 * - Added Tenant Wellness panel showing each tenant's self-reported status
 * - Wellness counts added to Quick Insights
 * - Added prominent FundiPlus CTA section (after Wellness panel) so landlords
 *   and house admins can hire vetted fundis (plumbers, electricians, etc.)
 *   directly from the dashboard — links to https://fundiplus.vercel.app/
 * - Everything else identical and production-ready
 */

import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  Wrench,
  BarChart3,
  ArrowUpRight,
  Heart,
  AlertTriangle,
  CheckCircle,
  Minus,
  Hammer, // ← ADDED for FundiPlus section
} from "lucide-react";
import {
  collection,
  getDocs,
  orderBy,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useOrgContext } from "../layout";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

/* ================= TYPES ================= */

interface Property {
  id: string;
  name: string;
  location?: string;
}
interface Unit {
  id: string;
  tenantId?: string;
}

// ← UPDATED: added wellnessStatus to Tenant type
interface Tenant {
  id: string;
  name: string;
  email: string;
  unitId?: string | null;
  propertyId?: string | null;
  wellnessStatus?: "green" | "yellow" | "red";
  wellnessUpdatedAt?: any;
}

interface MaintenanceRequest {
  id: string;
  status: string;
  title?: string;
}

/* ================= PAGE ================= */

export default function AdminDashboard() {
  const { orgId } = useOrgContext();
  const [loading, setLoading] = useState(true);

  const [propertyCount, setPropertyCount] = useState(0);
  const [unitCount, setUnitCount] = useState(0);
  const [tenantCount, setTenantCount] = useState(0);
  const [openIssues, setOpenIssues] = useState(0);
  const [occupiedUnits, setOccupiedUnits] = useState(0);
  const [recentProperties, setRecentProperties] = useState<Property[]>([]);
  const [recentTenants, setRecentTenants] = useState<Tenant[]>([]);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]); // ← ADDED
  const [unitsData, setUnitsData] = useState<Unit[]>([]);
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceRequest[]>([]);

  useEffect(() => {
    if (!orgId) return;

    const fetchDashboardData = async () => {
      try {
        const orgFilter = where("orgId", "==", orgId);

        const [propSnap, unitSnap, tenantSnap, maintSnap] = await Promise.all([
          getDocs(query(collection(db, "properties"), orgFilter)),
          getDocs(query(collection(db, "units"), orgFilter)),
          getDocs(query(collection(db, "tenants"), orgFilter)),
          getDocs(query(collection(db, "maintenance_requests"), orgFilter)),
        ]);

        setPropertyCount(propSnap.size);

        const unitsArr = unitSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Unit));
        setUnitCount(unitsArr.length);
        setUnitsData(unitsArr);
        setOccupiedUnits(unitsArr.filter((u) => u.tenantId).length);

        setTenantCount(tenantSnap.size);

        // ← ADDED: store all tenants for wellness panel
        const tenantsArr = tenantSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        } as Tenant));
        setAllTenants(tenantsArr);

        const maintArr = maintSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MaintenanceRequest));
        setMaintenanceData(maintArr);
        setOpenIssues(maintArr.filter((m) => m.status !== "resolved").length);

        // Recent properties (last 5)
        const recentPropSnap = await getDocs(
          query(collection(db, "properties"), orgFilter, orderBy("createdAt", "desc"), limit(5))
        );
        setRecentProperties(
          recentPropSnap.docs.map((d) => ({
            id: d.id,
            name: d.data().name as string,
            location: d.data().location as string | undefined,
          }))
        );

        // Recent tenants (last 5)
        const recentTenantSnap = await getDocs(
          query(collection(db, "tenants"), orgFilter, orderBy("createdAt", "desc"), limit(5))
        );
        setRecentTenants(
          recentTenantSnap.docs.map((d) => ({
            id: d.id,
            name: d.data().name as string,
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

  const occupancyRate = unitCount === 0 ? 0 : Math.round((occupiedUnits / unitCount) * 100);
  const occupancyData = [
    { name: "Occupied", value: occupiedUnits },
    { name: "Vacant", value: unitCount - occupiedUnits },
  ];
  const COLORS = ["#4F46E5", "#E5E7EB"];

  // ← ADDED: wellness counts for Quick Insights
  const wellnessGreen = allTenants.filter((t) => t.wellnessStatus === "green").length;
  const wellnessYellow = allTenants.filter((t) => t.wellnessStatus === "yellow").length;
  const wellnessRed = allTenants.filter((t) => t.wellnessStatus === "red").length;
  const wellnessUnset = allTenants.filter((t) => !t.wellnessStatus).length;

  // ← ADDED: tenants needing attention (red first, then yellow)
  const tenantsNeedingAttention = allTenants
    .filter((t) => t.wellnessStatus === "red" || t.wellnessStatus === "yellow")
    .sort((a, b) => {
      if (a.wellnessStatus === "red" && b.wellnessStatus !== "red") return -1;
      if (b.wellnessStatus === "red" && a.wellnessStatus !== "red") return 1;
      return 0;
    });

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">

        {/* HEADER — unchanged */}
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Real-time overview of your properties and tenants</p>
        </header>

        {/* STAT CARDS — unchanged */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Properties" value={propertyCount.toString()} trend="Live" icon={<Building2 className="h-6 w-6 text-indigo-600" />} />
          <StatCard title="Tenants" value={tenantCount.toString()} trend="Active" icon={<Users className="h-6 w-6 text-indigo-600" />} />
          <StatCard title="Occupancy" value={`${occupancyRate}%`} trend={`${occupiedUnits}/${unitCount}`} icon={<BarChart3 className="h-6 w-6 text-indigo-600" />} />
          <StatCard title="Open Issues" value={openIssues.toString()} trend="Pending" icon={<Wrench className="h-6 w-6 text-indigo-600" />} />
        </section>

        {/* ← ADDED: TENANT WELLNESS PANEL */}
        <section>
          <div className="rounded-xl border bg-white p-6 shadow-sm">

            {/* Panel header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-rose-500" />
                <h2 className="text-base font-semibold text-gray-900">
                  Tenant Payment Wellness
                </h2>
              </div>

              {/* Summary badges */}
              <div className="flex items-center gap-2">
                <WellnessSummaryBadge color="green" count={wellnessGreen} label="Good" />
                <WellnessSummaryBadge color="yellow" count={wellnessYellow} label="Uncertain" />
                <WellnessSummaryBadge color="red" count={wellnessRed} label="Crisis" />
              </div>
            </div>

            {/* Alert banner if any red statuses */}
            {wellnessRed > 0 && (
              <div className="mb-4 flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                <p className="text-sm text-red-700 font-medium">
                  {wellnessRed} tenant{wellnessRed > 1 ? "s are" : " is"} reporting a crisis.
                  Consider reaching out directly.
                </p>
              </div>
            )}

            {/* Tenants needing attention */}
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

            {/* All tenants wellness — collapsed list */}
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

        {/* ← NEW: FUNDIPLUS HIRE SECTION */}
        {/* Landlords & house admins can now hire vetted fundis directly */}
        <section>
          <div className="rounded-3xl border bg-white p-8 shadow-sm overflow-hidden relative">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              {/* Left content */}
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 px-5 py-1.5 text-sm font-semibold text-amber-700 mb-4">
                  <Hammer className="h-4 w-4" />
                  POWERED BY FUNDIPLUS
                </div>

                <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-3">
                  Need repairs or maintenance?
                </h2>
                <p className="text-lg text-gray-600 max-w-lg">
                  Instantly hire trusted fundis (plumbers, electricians, carpenters, painters &amp; more) in Nairobi. 
                  Vetted professionals • Transparent pricing • Secure payments.
                </p>
              </div>

              {/* CTA Button */}
              <a
                href="https://fundiplus.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex-shrink-0 flex items-center justify-center gap-3 bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white font-semibold text-xl px-12 py-5 rounded-3xl shadow-2xl hover:shadow-3xl transition-all active:scale-[0.97] hover:-translate-y-0.5"
              >
                Hire a Fundi Now
                <ArrowUpRight className="h-6 w-6 group-hover:rotate-45 transition-transform" />
              </a>
            </div>

            {/* Subtle background accent */}
            <div className="absolute -bottom-12 -right-12 h-48 w-48 bg-gradient-to-br from-amber-200/20 to-transparent rounded-full blur-3xl" />
          </div>
        </section>

        {/* PANELS — unchanged */}
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
                      <Pie data={occupancyData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={5} label>
                        {occupancyData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="mt-2 text-center text-sm text-gray-600">
                    {occupiedUnits} occupied / {unitCount - occupiedUnits} vacant — {occupancyRate}%
                  </p>
                </div>
              )}
            </Panel>

            {/* ← UPDATED: Quick Insights now includes wellness counts */}
            <Panel title="Quick Insights">
              <ul className="space-y-3 text-sm text-gray-600">
                <li>• Total units: {unitCount}</li>
                <li>• Occupied units: {occupiedUnits}</li>
                <li>• Vacant units: {unitCount - occupiedUnits}</li>
                <li>• Average occupancy: {occupancyRate}%</li>
                <li>• Open maintenance issues: {openIssues}</li>
                <li className="pt-2 border-t">
                  <span className="font-medium text-gray-700">Wellness:</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  Good: {wellnessGreen} tenant{wellnessGreen !== 1 ? "s" : ""}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  Uncertain: {wellnessYellow} tenant{wellnessYellow !== 1 ? "s" : ""}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  Crisis: {wellnessRed} tenant{wellnessRed !== 1 ? "s" : ""}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                  Not set: {wellnessUnset} tenant{wellnessUnset !== 1 ? "s" : ""}
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

// ← ADDED: row showing one tenant's wellness status
function TenantWellnessRow({ tenant }: { tenant: Tenant }) {
  const status = tenant.wellnessStatus;

  const config = {
    green: {
      dot: "bg-green-500",
      badge: "bg-green-100 text-green-700",
      label: "All Good",
    },
    yellow: {
      dot: "bg-yellow-400",
      badge: "bg-yellow-100 text-yellow-700",
      label: "Uncertain",
    },
    red: {
      dot: "bg-red-500",
      badge: "bg-red-100 text-red-700",
      label: "In Crisis",
    },
  };

  const current = status ? config[status] : null;

  return (
    <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-3">
        {current ? (
          <span className={`h-3 w-3 rounded-full shrink-0 ${current.dot}`} />
        ) : (
          <span className="h-3 w-3 rounded-full shrink-0 bg-gray-300" />
        )}
        <div>
          <p className="text-sm font-medium text-gray-800">{tenant.name}</p>
          <p className="text-xs text-gray-500">{tenant.email}</p>
        </div>
      </div>

      {current ? (
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${current.badge}`}>
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

// ← ADDED: small summary badge for the panel header
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
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colors[color]}`}>
      {count} {label}
    </span>
  );
}

// Unchanged components below
function StatCard({ title, value, trend, icon }: { title: string; value: string; trend: string; icon: React.ReactNode }) {
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
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