"use client";

/**
 * app/admin/reports/page.tsx
 *
 * Monthly portfolio report. Select a month → see every property's:
 *   - Expected rent (sum of occupied unit rentAmounts)
 *   - Collected rent (verified payments)
 *   - Total expenses (from expenses collection)
 *   - Net income
 *   - Annualised net yield % (if property has estimatedValue set)
 *   - Every tenant's payment status with transaction code
 *
 * Print / Save as PDF via the browser's print dialog.
 * Everything inside #report-root is print-optimised.
 */

import { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useOrgContext } from "@/lib/org-context";
import {
  Printer,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────── */

interface Property {
  id: string;
  name: string;
  location?: string;
  estimatedValue?: number;
}

interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  rentAmount?: number;
  tenantId?: string | null;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  unitId?: string | null;
  propertyId?: string | null;
}

interface Payment {
  id: string;
  tenantId: string;
  tenantUid: string;
  unitId?: string | null;
  propertyId?: string | null;
  amount: number;
  month: string;
  method: string;
  transactionCode: string;
  status: "pending" | "verified" | "rejected";
}

interface Expense {
  id: string;
  propertyId: string;
  category: string;
  description?: string;
  amount: number;
  month: string;
}

interface PropertyReport {
  property: Property;
  units: Unit[];
  occupiedUnits: Unit[];
  vacantCount: number;
  expectedRent: number;
  collectedRent: number;
  pendingRent: number;
  totalExpenses: number;
  netIncome: number;
  annualisedYield: number | null;
  tenantRows: TenantRow[];
  expenses: Expense[];
}

interface TenantRow {
  tenant: Tenant;
  unit: Unit | null;
  payment: Payment | null;
  status: "verified" | "pending" | "rejected" | "not_submitted";
}

/* ─── Helpers ────────────────────────────────────────── */

function fmt(n: number) {
  return n.toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

function formatMonth(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const METHOD_LABELS: Record<string, string> = {
  mpesa: "M-Pesa",
  bank:  "Bank",
  cash:  "Cash",
  other: "Other",
};

const CAT_LABELS: Record<string, string> = {
  garbage: "Garbage", security: "Security", insurance: "Insurance",
  caretaker: "Caretaker", water: "Water", electricity: "Electricity",
  internet: "Internet", maintenance: "Maintenance", land_rates: "Land Rates",
  agent_fee: "Agent Fee", other: "Other",
};

/* ─── Page ───────────────────────────────────────────── */

export default function AdminReportsPage() {
  const { orgId, org } = useOrgContext();
  const [month,   setMonth]   = useState(getCurrentMonth());
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<PropertyReport[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    if (!orgId) return;
    setLoading(true);
    setGenerated(false);
    try {
      const orgFilter = where("orgId", "==", orgId);

      const [propSnap, unitSnap, tenantSnap, paySnap, expSnap] = await Promise.all([
        getDocs(query(collection(db, "properties"), orgFilter)),
        getDocs(query(collection(db, "units"),      orgFilter)),
        getDocs(query(collection(db, "tenants"),    orgFilter)),
        getDocs(query(collection(db, "payments"),   orgFilter, where("month", "==", month))),
        getDocs(query(collection(db, "expenses"),   orgFilter, where("month", "==", month))),
      ]);

      const properties = propSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Property));
      const units      = unitSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Unit));
      const tenants    = tenantSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Tenant));
      const payments   = paySnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));
      const expenses   = expSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));

      const tenantMap  = Object.fromEntries(tenants.map((t) => [t.id, t]));

      const result: PropertyReport[] = properties.map((property) => {
        const pUnits    = units.filter((u) => u.propertyId === property.id);
        const occupied  = pUnits.filter((u) => u.tenantId);
        const vacant    = pUnits.filter((u) => !u.tenantId);
        const expected  = occupied.reduce((s, u) => s + (u.rentAmount ?? 0), 0);
        const pPayments = payments.filter((p) => p.propertyId === property.id);
        const verified  = pPayments.filter((p) => p.status === "verified");
        const pending   = pPayments.filter((p) => p.status === "pending");
        const collected = verified.reduce((s, p) => s + p.amount, 0);
        const pend      = pending.reduce((s, p) => s + p.amount, 0);
        const pExpenses = expenses.filter((e) => e.propertyId === property.id);
        const totalExp  = pExpenses.reduce((s, e) => s + e.amount, 0);
        const net       = collected - totalExp;

        // Annualised net yield = (net income × 12) / estimatedValue × 100
        const annYield = property.estimatedValue && property.estimatedValue > 0
          ? Math.round(((net * 12) / property.estimatedValue) * 1000) / 10
          : null;

        // Build tenant rows for this property
        const tenantRows: TenantRow[] = occupied.map((unit) => {
          const tenant  = unit.tenantId ? tenantMap[unit.tenantId] : null;
          if (!tenant) return null;
          const payment = pPayments.find((p) => p.tenantId === tenant.id) ?? null;
          const status: TenantRow["status"] = payment
            ? (payment.status as any)
            : "not_submitted";
          return { tenant, unit, payment, status };
        }).filter(Boolean) as TenantRow[];

        return {
          property,
          units: pUnits,
          occupiedUnits: occupied,
          vacantCount:   vacant.length,
          expectedRent:  expected,
          collectedRent: collected,
          pendingRent:   pend,
          totalExpenses: totalExp,
          netIncome:     net,
          annualisedYield: annYield,
          tenantRows,
          expenses: pExpenses,
        };
      });

      setReports(result);
      // Auto-expand all properties
      const exp: Record<string, boolean> = {};
      result.forEach((r) => { exp[r.property.id] = true; });
      setExpanded(exp);
      setGenerated(true);
    } catch (err) {
      console.error("Report generation error:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalExpected  = reports.reduce((s, r) => s + r.expectedRent,  0);
  const totalCollected = reports.reduce((s, r) => s + r.collectedRent, 0);
  const totalExpenses  = reports.reduce((s, r) => s + r.totalExpenses, 0);
  const totalNet       = reports.reduce((s, r) => s + r.netIncome,     0);
  const collectionEff  = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-root, #report-root * { visibility: visible; }
          #report-root { position: fixed; inset: 0; padding: 24px; background: white; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #e5e7eb; padding: 6px 10px; font-size: 11px; }
          th { background: #f9fafb; font-weight: 600; }
        }
      `}</style>

      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* Header */}
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Portfolio Report</h1>
              <p className="mt-1 text-sm text-gray-500">
                Rent, expenses, and net income — ready to print or save as PDF
              </p>
            </div>
            {generated && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg hover:bg-gray-700 text-sm font-medium"
              >
                <Printer className="h-4 w-4" />
                Print / Save PDF
              </button>
            )}
          </header>

          {/* Controls */}
          <div className="no-print flex flex-wrap items-center gap-3">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border rounded-lg px-4 py-2.5 text-sm text-gray-700"
            />
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Generating…" : "Generate Report"}
            </button>
          </div>

          {/* Report Output */}
          {generated && (
            <div id="report-root">
              {/* Report Header — visible in print */}
              <div className="rounded-xl border bg-white p-6 shadow-sm mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{org.name}</h2>
                    <p className="text-gray-500 text-sm mt-0.5">Monthly Portfolio Report</p>
                    <p className="text-indigo-700 font-semibold mt-1">{formatMonth(month)}</p>
                  </div>
                  <div className="text-right text-sm text-gray-400">
                    <p>Generated: {new Date().toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</p>
                    <p>{reports.length} propert{reports.length !== 1 ? "ies" : "y"}</p>
                  </div>
                </div>

                {/* Portfolio summary */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SummaryBox label="Expected Rent"  value={`KES ${fmt(totalExpected)}`}  color="gray"   />
                  <SummaryBox label="Collected"       value={`KES ${fmt(totalCollected)}`} color="green"  />
                  <SummaryBox label="Total Expenses"  value={`KES ${fmt(totalExpenses)}`}  color="red"    />
                  <SummaryBox label="Net Income"      value={`KES ${fmt(totalNet)}`}       color={totalNet >= 0 ? "green" : "red"} />
                </div>

                {/* Progress bar */}
                {totalExpected > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Collection efficiency</span>
                      <span>{collectionEff}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-100">
                      <div
                        className={`h-2.5 rounded-full ${collectionEff >= 80 ? "bg-green-500" : collectionEff >= 50 ? "bg-yellow-400" : "bg-red-500"}`}
                        style={{ width: `${Math.min(collectionEff, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Per-property sections */}
              {reports.map((r, idx) => (
                <div key={r.property.id} className={`rounded-xl border bg-white shadow-sm mb-4 ${idx > 0 ? "page-break" : ""}`}>
                  {/* Property header */}
                  <div
                    className="flex items-center justify-between p-5 cursor-pointer select-none no-print"
                    onClick={() => setExpanded((prev) => ({ ...prev, [r.property.id]: !prev[r.property.id] }))}
                  >
                    <div className="flex items-center gap-3">
                      <BarChart3 className="h-5 w-5 text-indigo-600" />
                      <div>
                        <h3 className="font-semibold text-gray-900">{r.property.name}</h3>
                        {r.property.location && <p className="text-xs text-gray-400">{r.property.location}</p>}
                      </div>
                    </div>
                    {expanded[r.property.id] ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>

                  {/* Always-visible print header */}
                  <div className="hidden print:block px-5 pt-4 pb-2">
                    <h3 className="font-bold text-gray-900 text-base">{r.property.name}</h3>
                    {r.property.location && <p className="text-xs text-gray-400">{r.property.location}</p>}
                  </div>

                  {(expanded[r.property.id]) && (
                    <div className="px-5 pb-5 space-y-5 border-t">
                      {/* Property KPIs */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4">
                        <KPI label="Expected"    value={`KES ${fmt(r.expectedRent)}`}  sub={`${r.occupiedUnits.length} occupied`} />
                        <KPI label="Collected"   value={`KES ${fmt(r.collectedRent)}`} sub={r.expectedRent > 0 ? `${Math.round((r.collectedRent / r.expectedRent) * 100)}%` : "—"} green />
                        <KPI label="Expenses"    value={`KES ${fmt(r.totalExpenses)}`} sub={`${r.expenses.length} items`} red />
                        <KPI label="Net Income"  value={`KES ${fmt(r.netIncome)}`}      sub="" green={r.netIncome >= 0} red={r.netIncome < 0} />
                        <KPI
                          label="Net Yield"
                          value={r.annualisedYield !== null ? `${r.annualisedYield}%` : "—"}
                          sub={r.property.estimatedValue ? `Est. KES ${fmt(r.property.estimatedValue)}` : "Set property value"}
                          green={r.annualisedYield !== null && r.annualisedYield >= 7}
                          yellow={r.annualisedYield !== null && r.annualisedYield >= 5 && r.annualisedYield < 7}
                          red={r.annualisedYield !== null && r.annualisedYield < 5}
                        />
                      </div>

                      {/* Tenant payment table */}
                      {r.tenantRows.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tenant Payments</p>
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="border border-gray-200 px-3 py-2 text-left">Tenant</th>
                                <th className="border border-gray-200 px-3 py-2 text-left">Unit</th>
                                <th className="border border-gray-200 px-3 py-2 text-left">Amount</th>
                                <th className="border border-gray-200 px-3 py-2 text-left">Method</th>
                                <th className="border border-gray-200 px-3 py-2 text-left">Ref</th>
                                <th className="border border-gray-200 px-3 py-2 text-left">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.tenantRows.map((row) => (
                                <tr key={row.tenant.id} className="hover:bg-gray-50">
                                  <td className="border border-gray-200 px-3 py-2">{row.tenant.name}</td>
                                  <td className="border border-gray-200 px-3 py-2">{row.unit?.unitNumber ?? "—"}</td>
                                  <td className="border border-gray-200 px-3 py-2">
                                    {row.payment ? `KES ${fmt(row.payment.amount)}` : `KES ${fmt(row.unit?.rentAmount ?? 0)}`}
                                  </td>
                                  <td className="border border-gray-200 px-3 py-2">
                                    {row.payment ? (METHOD_LABELS[row.payment.method] ?? row.payment.method) : "—"}
                                  </td>
                                  <td className="border border-gray-200 px-3 py-2 font-mono">
                                    {row.payment?.transactionCode ?? "—"}
                                  </td>
                                  <td className="border border-gray-200 px-3 py-2">
                                    <StatusPill status={row.status} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Expenses table */}
                      {r.expenses.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Expenses</p>
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="border border-gray-200 px-3 py-2 text-left">Category</th>
                                <th className="border border-gray-200 px-3 py-2 text-left">Description</th>
                                <th className="border border-gray-200 px-3 py-2 text-right">Amount (KES)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.expenses.map((e) => (
                                <tr key={e.id} className="hover:bg-gray-50">
                                  <td className="border border-gray-200 px-3 py-2">{CAT_LABELS[e.category] ?? e.category}</td>
                                  <td className="border border-gray-200 px-3 py-2 text-gray-500">{e.description || "—"}</td>
                                  <td className="border border-gray-200 px-3 py-2 text-right text-red-600 font-medium">{fmt(e.amount)}</td>
                                </tr>
                              ))}
                              <tr className="bg-gray-50 font-semibold">
                                <td colSpan={2} className="border border-gray-200 px-3 py-2">Total Expenses</td>
                                <td className="border border-gray-200 px-3 py-2 text-right text-red-600">{fmt(r.totalExpenses)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Vacancies */}
                      {r.vacantCount > 0 && (
                        <p className="text-xs text-gray-400">
                          {r.vacantCount} vacant unit{r.vacantCount !== 1 ? "s" : ""} — not included in expected rent
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Footer */}
              <div className="text-center text-xs text-gray-400 mt-4 py-4">
                Generated by Housify KE · {org.name} · {formatMonth(month)}
              </div>
            </div>
          )}

          {!generated && !loading && (
            <div className="rounded-xl border border-dashed bg-white p-16 text-center">
              <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Select a month and click Generate Report</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

/* ─── Small Components ───────────────────────────────── */

function SummaryBox({ label, value, color }: { label: string; value: string; color: "gray" | "green" | "red" }) {
  const colors = { gray: "text-gray-800", green: "text-green-700", red: "text-red-600" };
  return (
    <div className="rounded-lg bg-gray-50 border p-3">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${colors[color]}`}>{value}</p>
    </div>
  );
}

function KPI({
  label, value, sub, green, red, yellow,
}: {
  label: string; value: string; sub: string;
  green?: boolean; red?: boolean; yellow?: boolean;
}) {
  const valColor = green ? "text-green-700" : red ? "text-red-600" : yellow ? "text-yellow-600" : "text-gray-800";
  return (
    <div className="rounded-lg bg-gray-50 border p-3">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-base font-bold mt-0.5 ${valColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatusPill({ status }: { status: TenantRow["status"] }) {
  const map = {
    verified:      "bg-green-100 text-green-700",
    pending:       "bg-yellow-100 text-yellow-700",
    rejected:      "bg-red-100 text-red-700",
    not_submitted: "bg-gray-100 text-gray-500",
  };
  const label = {
    verified:      "Verified",
    pending:       "Pending",
    rejected:      "Rejected",
    not_submitted: "Not Submitted",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status]}`}>
      {label[status]}
    </span>
  );
}
