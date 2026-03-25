"use client";

/**
 * app/admin/payments/page.tsx
 *
 * Updated: Added "Invoice" link next to each payment row.
 * Opens /admin/invoice/TENANT_ID/MONTH in a new tab.
 * Everything else identical to previous version.
 */

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useOrgContext } from "@/lib/org-context";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Filter,
  Receipt,
  AlertTriangle,
  FileText,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────── */

type PaymentStatus = "pending" | "verified" | "rejected";
type PaymentMethod = "mpesa" | "bank" | "cash" | "other";
type FilterStatus  = "all" | PaymentStatus;

interface Payment {
  id: string;
  tenantId: string;
  tenantUid: string;
  unitId?: string;
  propertyId?: string;
  amount: number;
  month: string;
  method: PaymentMethod;
  transactionCode: string;
  notes?: string;
  status: PaymentStatus;
  rejectionReason?: string;
  submittedAt: any;
  verifiedAt?: any;
  verifiedBy?: string;
  // Joined
  tenantName?: string;
  tenantEmail?: string;
  unitNumber?: string;
  propertyName?: string;
}

/* ─── Helpers ────────────────────────────────────────── */

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}

function formatDate(ts: any): string {
  if (!ts) return "-";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString("en-KE", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  mpesa: "M-Pesa",
  bank:  "Bank Transfer",
  cash:  "Cash",
  other: "Other",
};

const STATUS_CONFIG: Record<PaymentStatus, { label: string; icon: React.ReactNode; className: string }> = {
  pending:  { label: "Pending",  icon: <Clock       className="h-4 w-4" />, className: "bg-yellow-100 text-yellow-700" },
  verified: { label: "Verified", icon: <CheckCircle className="h-4 w-4" />, className: "bg-green-100 text-green-700"  },
  rejected: { label: "Rejected", icon: <XCircle     className="h-4 w-4" />, className: "bg-red-100 text-red-700"     },
};

/* ─── Page ───────────────────────────────────────────── */

export default function AdminPaymentsPage() {
  const { orgId } = useOrgContext();
  const user = auth.currentUser;

  const [payments,      setPayments]      = useState<Payment[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filterStatus,  setFilterStatus]  = useState<FilterStatus>("pending");
  const [filterMonth,   setFilterMonth]   = useState("");

  // Rejection modal
  const [rejectingId,      setRejectingId]      = useState<string | null>(null);
  const [rejectionReason,  setRejectionReason]  = useState("");
  const [actionLoading,    setActionLoading]    = useState(false);

  /* ─── Fetch ── */
  useEffect(() => {
    if (!orgId) return;

    const fetchPayments = async () => {
      try {
        const paymentsSnap = await getDocs(
          query(collection(db, "payments"), where("orgId", "==", orgId), orderBy("submittedAt", "desc"))
        );
        const rawPayments = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));

        const [tenantSnap, unitSnap, propertySnap] = await Promise.all([
          getDocs(query(collection(db, "tenants"),    where("orgId", "==", orgId))),
          getDocs(query(collection(db, "units"),      where("orgId", "==", orgId))),
          getDocs(query(collection(db, "properties"), where("orgId", "==", orgId))),
        ]);

        const tenantMap   = Object.fromEntries(tenantSnap.docs.map((d) => [d.id, d.data()]));
        const unitMap     = Object.fromEntries(unitSnap.docs.map((d) => [d.id, d.data()]));
        const propertyMap = Object.fromEntries(propertySnap.docs.map((d) => [d.id, d.data()]));

        const enriched = rawPayments.map((p) => ({
          ...p,
          tenantName:   tenantMap[p.tenantId]?.name     ?? "Unknown tenant",
          tenantEmail:  tenantMap[p.tenantId]?.email    ?? "",
          unitNumber:   p.unitId   ? unitMap[p.unitId]?.unitNumber       : undefined,
          propertyName: p.propertyId ? propertyMap[p.propertyId]?.name   : undefined,
        }));

        setPayments(enriched);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [orgId]);

  /* ─── Verify ── */
  const handleVerify = async (paymentId: string) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "payments", paymentId), {
        status:          "verified",
        verifiedAt:      serverTimestamp(),
        verifiedBy:      user?.uid ?? "",
        rejectionReason: null,
      });
      setPayments((prev) =>
        prev.map((p) =>
          p.id === paymentId
            ? { ...p, status: "verified", verifiedAt: new Date(), verifiedBy: user?.uid ?? "" }
            : p
        )
      );
    } catch (err) {
      console.error(err);
      alert("Failed to verify payment.");
    } finally {
      setActionLoading(false);
    }
  };

  /* ─── Reject ── */
  const handleReject = async () => {
    if (!rejectingId) return;
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason so the tenant can resubmit.");
      return;
    }
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "payments", rejectingId), {
        status:          "rejected",
        verifiedAt:      serverTimestamp(),
        verifiedBy:      user?.uid ?? "",
        rejectionReason: rejectionReason.trim(),
      });
      setPayments((prev) =>
        prev.map((p) =>
          p.id === rejectingId
            ? { ...p, status: "rejected", rejectionReason: rejectionReason.trim() }
            : p
        )
      );
      setRejectingId(null);
      setRejectionReason("");
    } catch (err) {
      console.error(err);
      alert("Failed to reject payment.");
    } finally {
      setActionLoading(false);
    }
  };

  /* ─── Filter ── */
  const filtered = payments.filter((p) => {
    const statusMatch = filterStatus === "all" || p.status === filterStatus;
    const monthMatch  = !filterMonth || p.month === filterMonth;
    return statusMatch && monthMatch;
  });

  const pendingCount = payments.filter((p) => p.status === "pending").length;

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const thisMonthPayments = payments.filter((p) => p.month === currentMonth);
  const thisMonthVerified = thisMonthPayments.filter((p) => p.status === "verified");
  const thisMonthRevenue  = thisMonthVerified.reduce((sum, p) => sum + p.amount, 0);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <header>
          <h1 className="text-3xl font-bold text-gray-900">Rent Payments</h1>
          <p className="text-gray-500 text-sm mt-1">Verify tenant payment submissions</p>
        </header>

        {/* Alert */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
            <p className="text-sm text-yellow-800 font-medium">
              {pendingCount} payment{pendingCount > 1 ? "s" : ""} waiting for your verification
            </p>
          </div>
        )}

        {/* Summary */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="This Month Revenue" value={`KES ${thisMonthRevenue.toLocaleString()}`}           sub="Verified payments only"              color="indigo" />
          <SummaryCard label="Verified"            value={thisMonthVerified.length.toString()}                 sub={`of ${thisMonthPayments.length} submitted`} color="green"  />
          <SummaryCard label="Pending Review"      value={pendingCount.toString()}                             sub="Needs your action"                  color="yellow" />
          <SummaryCard label="Rejected"            value={payments.filter((p) => p.month === currentMonth && p.status === "rejected").length.toString()} sub="This month" color="red" />
        </section>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <div className="flex gap-2">
            {(["pending", "all", "verified", "rejected"] as FilterStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition ${
                  filterStatus === s
                    ? "bg-indigo-600 text-white"
                    : "bg-white border text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s === "all" ? "All" : STATUS_CONFIG[s as PaymentStatus].label}
                {s === "pending" && pendingCount > 0 && (
                  <span className="ml-1.5 bg-yellow-400 text-yellow-900 rounded-full px-1.5 py-0.5 text-xs">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm text-gray-700"
          />
          {filterMonth && (
            <button onClick={() => setFilterMonth("")} className="text-xs text-gray-400 hover:text-gray-600">
              Clear month
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-x-auto">
          {loading ? (
            <div className="p-16 flex justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No payments found.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-6 py-3 font-medium text-gray-600">Tenant</th>
                  <th className="px-6 py-3 font-medium text-gray-600">Month</th>
                  <th className="px-6 py-3 font-medium text-gray-600">Amount</th>
                  <th className="px-6 py-3 font-medium text-gray-600">Method</th>
                  <th className="px-6 py-3 font-medium text-gray-600">Transaction Code</th>
                  <th className="px-6 py-3 font-medium text-gray-600">Submitted</th>
                  <th className="px-6 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-6 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((payment) => {
                  const config = STATUS_CONFIG[payment.status];
                  return (
                    <tr key={payment.id} className="border-t hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-800">{payment.tenantName}</p>
                        <p className="text-xs text-gray-400">{payment.tenantEmail}</p>
                        {payment.unitNumber && (
                          <p className="text-xs text-gray-400">
                            Unit {payment.unitNumber}{payment.propertyName ? ` · ${payment.propertyName}` : ""}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-700">{formatMonth(payment.month)}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        KES {payment.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-gray-700">{METHOD_LABELS[payment.method]}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {payment.transactionCode}
                        </span>
                        {payment.notes && (
                          <p className="text-xs text-gray-400 mt-1 max-w-[160px] truncate">{payment.notes}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">{formatDate(payment.submittedAt)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.className}`}>
                          {config.icon}
                          {config.label}
                        </span>
                        {payment.status === "rejected" && payment.rejectionReason && (
                          <p className="text-xs text-red-500 mt-1 max-w-[140px]">{payment.rejectionReason}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          {/* ← NEW: Invoice link */}
                          <a
                            href={`/admin/invoice/${payment.tenantId}/${payment.month}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:underline font-medium"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Invoice
                          </a>

                          {payment.status === "pending" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleVerify(payment.id)}
                                disabled={actionLoading}
                                className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-green-700 disabled:opacity-50"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Verify
                              </button>
                              <button
                                onClick={() => { setRejectingId(payment.id); setRejectionReason(""); }}
                                disabled={actionLoading}
                                className="flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs hover:bg-red-100 disabled:opacity-50"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject
                              </button>
                            </div>
                          )}
                          {payment.status !== "pending" && (
                            <p className="text-xs text-gray-400">{formatDate(payment.verifiedAt)}</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Rejection Modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 space-y-5">
            <h2 className="text-xl font-bold text-gray-900">Reject Payment</h2>
            <p className="text-sm text-gray-500">
              Provide a reason so the tenant knows what to correct when resubmitting.
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Transaction code not found on M-Pesa statement. Please check and resubmit."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 text-sm resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setRejectingId(null); setRejectionReason(""); }}
                className="border px-5 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="bg-red-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ─── Components ─────────────────────────────────────── */

function SummaryCard({ label, value, sub, color }: {
  label: string; value: string; sub: string;
  color: "indigo" | "green" | "yellow" | "red";
}) {
  const colors = { indigo: "text-indigo-600", green: "text-green-600", yellow: "text-yellow-600", red: "text-red-600" };
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colors[color]}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}
