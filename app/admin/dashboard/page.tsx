"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  Wrench,
  BarChart3,
  ArrowUpRight,
} from "lucide-react";
import {
  collection,
  getDocs,
  orderBy,
  limit,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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

interface Tenant {
  id: string;
  name: string;
  email: string;
}

interface MaintenanceRequest {
  id: string;
  status: string;
  title?: string;
}

/* ================= PAGE ================= */

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);

  const [propertyCount, setPropertyCount] = useState(0);
  const [unitCount, setUnitCount] = useState(0);
  const [tenantCount, setTenantCount] = useState(0);
  const [openIssues, setOpenIssues] = useState(0);

  const [occupiedUnits, setOccupiedUnits] = useState(0);
  const [recentProperties, setRecentProperties] = useState<Property[]>([]);
  const [recentTenants, setRecentTenants] = useState<Tenant[]>([]);
  const [unitsData, setUnitsData] = useState<Unit[]>([]);
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceRequest[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        /* ---- PROPERTIES ---- */
        const propSnap = await getDocs(collection(db, "properties"));
        setPropertyCount(propSnap.size);

        /* ---- UNITS ---- */
        const unitSnap = await getDocs(collection(db, "units"));
        setUnitCount(unitSnap.size);
        const unitsArr = unitSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Unit));
        setUnitsData(unitsArr);

        const occupied = unitsArr.filter((u) => u.tenantId).length;
        setOccupiedUnits(occupied);

        /* ---- TENANTS ---- */
        const tenantSnap = await getDocs(collection(db, "tenants"));
        setTenantCount(tenantSnap.size);

        /* ---- MAINTENANCE ---- */
        const maintSnap = await getDocs(collection(db, "maintenance_requests"));
        const maintArr = maintSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MaintenanceRequest));
        setMaintenanceData(maintArr);
        const open = maintArr.filter((m) => m.status !== "resolved").length;
        setOpenIssues(open);

        /* ---- RECENT PROPERTIES ---- */
        const recentPropQuery = query(
          collection(db, "properties"),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const recentPropSnap = await getDocs(recentPropQuery);
        setRecentProperties(
          recentPropSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
        );

        /* ---- RECENT TENANTS ---- */
        const recentTenantQuery = query(
          collection(db, "tenants"),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const recentTenantSnap = await getDocs(recentTenantQuery);
        setRecentTenants(
          recentTenantSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
        );
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const occupancyRate =
    unitCount === 0 ? 0 : Math.round((occupiedUnits / unitCount) * 100);

  const occupancyData = [
    { name: "Occupied", value: occupiedUnits },
    { name: "Vacant", value: unitCount - occupiedUnits },
  ];
  const COLORS = ["#4F46E5", "#E5E7EB"]; // Indigo / Gray

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* HEADER */}
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-900">
            Admin Dashboard
          </h1>
          <p className="text-gray-600">
            Real-time overview of your properties and tenants
          </p>
        </header>

        {/* STATS */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Properties"
            value={propertyCount.toString()}
            trend="Live"
            icon={<Building2 className="h-6 w-6 text-indigo-600" />}
          />
          <StatCard
            title="Tenants"
            value={tenantCount.toString()}
            trend="Active"
            icon={<Users className="h-6 w-6 text-indigo-600" />}
          />
          <StatCard
            title="Occupancy"
            value={`${occupancyRate}%`}
            trend={`${occupiedUnits}/${unitCount}`}
            icon={<BarChart3 className="h-6 w-6 text-indigo-600" />}
          />
          <StatCard
            title="Open Issues"
            value={openIssues.toString()}
            trend="Pending"
            icon={<Wrench className="h-6 w-6 text-indigo-600" />}
          />
        </section>

        {/* PANELS */}
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
                        {occupancyData.map((entry, index) => (
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
                    {occupiedUnits} occupied / {unitCount - occupiedUnits} vacant —{" "}
                    {occupancyRate}%
                  </p>
                </div>
              )}
            </Panel>

            <Panel title="Quick Insights">
              <ul className="space-y-3 text-sm text-gray-600">
                <li>• Total units: {unitCount}</li>
                <li>• Occupied units: {occupiedUnits}</li>
                <li>• Vacant units: {unitCount - occupiedUnits}</li>
                <li>• Average occupancy: {occupancyRate}%</li>
                <li>
                  • Open maintenance issues:{" "}
                  {maintenanceData.filter((m) => m.status !== "resolved").length}
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

function StatCard({
  title,
  value,
  trend,
  icon,
}: {
  title: string;
  value: string;
  trend: string;
  icon: React.ReactNode;
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
