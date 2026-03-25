"use client";

/**
 * app/admin/invoice/[tenantId]/[month]/page.tsx
 *
 * Printable / saveable invoice for a specific tenant and month.
 * Open from payments page: /admin/invoice/TENANT_ID/2026-03
 * Click Print / Save as PDF in the browser.
 *
 * The page loads standalone (no admin sidebar) so it prints cleanly.
 * Data is fetched from Firestore on the client — no auth bypass needed
 * because the admin is already signed in when they open the tab.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import { Loader2, Printer, Building2, CheckCircle, Clock, XCircle } from "lucide-react";

/* ─── Types ─────────────────────────────────────────── */

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
  notes?: string;
  status: "pending" | "verified" | "rejected";
  rejectionReason?: string;
  submittedAt?: any;
  verifiedAt?: any;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  unitId?: string | null;
  propertyId?: string | null;
  orgId: string;
}

interface Unit {
  id: string;
  unitNumber: string;
  rentAmount?: number;
  rentDueDay?: number;
  propertyId: string;
}

interface Property {
  id: string;
  name: string;
  location?: string;
}

interface Org {
  name: string;
  adminEmail?: string;
}

/* ─── Helpers ────────────────────────────────────────── */

function formatMonth(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });
}

function formatDate(ts: any) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
}

function fmt(n: number) {
  return n.toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

const METHOD_LABELS: Record<string, string> = {
  mpesa: "M-Pesa",
  bank:  "Bank Transfer",
  cash:  "Cash",
  other: "Other",
};

const ordinal = (n: number) => {
  if (n === 1) return "1st"; if (n === 2) return "2nd"; if (n === 3) return "3rd";
  return `${n}th`;
};

const invoiceNumber = (tenantId: string, month: string) => {
  const id = tenantId.slice(-5).toUpperCase();
  const [y, m] = month.split("-");
  return `INV-${y}${m}-${id}`;
};

/* ─── Page ───────────────────────────────────────────── */

export default function InvoicePage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;
  const month    = params?.month    as string;

  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  const [payment,  setPayment]  = useState<Payment  | null>(null);
  const [tenant,   setTenant]   = useState<Tenant   | null>(null);
  const [unit,     setUnit]     = useState<Unit     | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [org,      setOrg]      = useState<Org      | null>(null);

  useEffect(() => {
    if (!tenantId || !month) {
      setError("Invalid invoice URL.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // 1. Tenant
        const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
        if (!tenantSnap.exists()) { setError("Tenant not found."); return; }
        const t = { id: tenantSnap.id, ...tenantSnap.data() } as Tenant;
        setTenant(t);

        // 2. Payment for this month
        const paySnap = await getDocs(
          query(
            collection(db, "payments"),
            where("tenantId", "==", tenantId),
            where("month",    "==", month)
          )
        );
        const pay = paySnap.empty ? null : { id: paySnap.docs[0].id, ...paySnap.docs[0].data() } as Payment;
        setPayment(pay);

        // 3. Unit
        if (t.unitId) {
          const unitSnap = await getDoc(doc(db, "units", t.unitId));
          if (unitSnap.exists()) setUnit({ id: unitSnap.id, ...unitSnap.data() } as Unit);
        }

        // 4. Property
        if (t.propertyId) {
          const propSnap = await getDoc(doc(db, "properties", t.propertyId));
          if (propSnap.exists()) setProperty({ id: propSnap.id, ...propSnap.data() } as Property);
        }

        // 5. Org
        if (t.orgId) {
          const orgSnap = await getDoc(doc(db, "orgs", t.orgId));
          if (orgSnap.exists()) setOrg(orgSnap.data() as Org);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load invoice data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tenantId, month]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600 text-center px-6">
        <div>
          <p className="text-xl font-semibold mb-2">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const rentAmount  = unit?.rentAmount  ?? payment?.amount ?? 0;
  const amountPaid  = payment?.amount   ?? 0;
  const balance     = rentAmount - amountPaid;
  const invNum      = invoiceNumber(tenantId, month);

  const statusConfig = {
    verified: { label: "PAID",    cls: "bg-green-100 text-green-700 border-green-200",  icon: <CheckCircle className="h-5 w-5" /> },
    pending:  { label: "PENDING", cls: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: <Clock className="h-5 w-5" /> },
    rejected: { label: "REJECTED",cls: "bg-red-100 text-red-700 border-red-200",        icon: <XCircle className="h-5 w-5" /> },
  };
  const statusInfo = payment ? statusConfig[payment.status] : null;

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @page { size: A4; margin: 20mm; }
      `}</style>

      {/* Print button — hidden on print */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 shadow-lg"
        >
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </button>
        <button
          onClick={() => window.close()}
          className="bg-white border text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-lg"
        >
          Close
        </button>
      </div>

      {/* Invoice — this is what prints */}
      <main className="min-h-screen bg-gray-100 p-8 print:bg-white print:p-0">
        <div className="max-w-2xl mx-auto bg-white shadow-lg rounded-2xl overflow-hidden print:shadow-none print:rounded-none">

          {/* Top bar */}
          <div className="bg-indigo-600 px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <Building2 className="h-7 w-7" />
              <div>
                <p className="font-bold text-lg leading-tight">{org?.name ?? "Housify KE"}</p>
                {org?.adminEmail && <p className="text-indigo-200 text-xs">{org.adminEmail}</p>}
              </div>
            </div>
            <div className="text-right text-white">
              <p className="text-xs text-indigo-200 uppercase tracking-wider">Invoice</p>
              <p className="font-mono font-bold text-lg">{invNum}</p>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-6 space-y-6">

            {/* Billing info row */}
            <div className="flex justify-between gap-6">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Billed To</p>
                <p className="font-semibold text-gray-900 text-base">{tenant?.name}</p>
                <p className="text-sm text-gray-500">{tenant?.email}</p>
                {property && <p className="text-sm text-gray-500">{property.name}{property.location ? `, ${property.location}` : ""}</p>}
                {unit && <p className="text-sm text-gray-500">Unit {unit.unitNumber}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Invoice Details</p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Period:</span> {formatMonth(month)}
                </p>
                {unit?.rentDueDay && (
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Due:</span> {ordinal(unit.rentDueDay)} of month
                  </p>
                )}
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Date:</span> {new Date().toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>

            {/* Line item table */}
            <div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 border border-gray-200">Description</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700 border border-gray-200">Amount (KES)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 border border-gray-200 text-gray-800">
                      Monthly Rent — {formatMonth(month)}
                      {unit && <span className="text-gray-500"> · Unit {unit.unitNumber}</span>}
                      {property && <span className="text-gray-500">, {property.name}</span>}
                    </td>
                    <td className="px-4 py-3 border border-gray-200 text-right font-medium text-gray-800">
                      {fmt(rentAmount)}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 border border-gray-200 font-semibold text-gray-700">Total Due</td>
                    <td className="px-4 py-3 border border-gray-200 text-right font-bold text-gray-900">
                      KES {fmt(rentAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Payment details (if payment exists) */}
            {payment && (
              <div className="border rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Details</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Method:</span>{" "}
                    <span className="font-medium text-gray-800">{METHOD_LABELS[payment.method] ?? payment.method}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Amount paid:</span>{" "}
                    <span className="font-medium text-gray-800">KES {fmt(amountPaid)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Reference:</span>{" "}
                    <span className="font-mono font-medium text-gray-800">{payment.transactionCode}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Submitted:</span>{" "}
                    <span className="font-medium text-gray-800">{formatDate(payment.submittedAt)}</span>
                  </div>
                  {payment.verifiedAt && (
                    <div>
                      <span className="text-gray-500">Verified:</span>{" "}
                      <span className="font-medium text-gray-800">{formatDate(payment.verifiedAt)}</span>
                    </div>
                  )}
                  {payment.notes && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Notes:</span>{" "}
                      <span className="text-gray-700">{payment.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Balance */}
            <div className={`rounded-xl p-4 flex items-center justify-between ${payment?.status === "verified" ? "bg-green-50 border border-green-200" : "bg-gray-50 border"}`}>
              <div>
                <p className="text-sm font-semibold text-gray-700">Balance</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {payment?.status === "verified" ? "Payment verified — balance cleared" : "Pending landlord verification"}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${balance <= 0 && payment?.status === "verified" ? "text-green-700" : "text-gray-900"}`}>
                  KES {fmt(Math.abs(balance))}
                </p>
                {balance <= 0 && payment?.status === "verified" && (
                  <p className="text-xs text-green-600 font-semibold mt-0.5">PAID IN FULL</p>
                )}
              </div>
            </div>

            {/* Status badge */}
            {statusInfo && (
              <div className={`flex items-center gap-3 rounded-xl px-5 py-4 border ${statusInfo.cls}`}>
                {statusInfo.icon}
                <div>
                  <p className="font-bold text-sm">{statusInfo.label}</p>
                  {payment?.status === "rejected" && payment.rejectionReason && (
                    <p className="text-xs mt-0.5">Reason: {payment.rejectionReason}</p>
                  )}
                </div>
              </div>
            )}

            {!payment && (
              <div className="flex items-center gap-3 rounded-xl px-5 py-4 border border-gray-200 bg-gray-50 text-gray-500">
                <Clock className="h-5 w-5" />
                <p className="text-sm">No payment submitted for {formatMonth(month)} yet.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-8 py-4 flex justify-between items-center text-xs text-gray-400">
            <p>Generated by Housify KE</p>
            <p>{invNum} · {formatMonth(month)}</p>
          </div>
        </div>
      </main>
    </>
  );
}
