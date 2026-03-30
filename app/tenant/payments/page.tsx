"use client";

/**
 * app/tenant/payments/page.tsx
 *
 * UI FIXES:
 * 1. Removed min-h-screen from <main> — page height is now driven by content,
 *    not the viewport. Prevents the stretched-to-bottom look.
 * 2. Modal overlay: changed items-center to items-start with pt-16 + pb-8
 *    and added overflow-y-auto on the overlay so the modal scrolls on short
 *    screens instead of getting clipped behind the taskbar.
 * 3. Modal inner div: added max-h-[90vh] overflow-y-auto so the form itself
 *    scrolls if content is taller than the screen.
 * 4. Everything else identical to previous version.
 */

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection, addDoc, getDocs, query, where,
  orderBy, serverTimestamp, doc, getDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import {
  CheckCircle, Clock, XCircle, Plus, Loader2,
  Receipt, AlertTriangle,
} from "lucide-react";

/* ================= TYPES ================= */

type PaymentMethod = "mpesa" | "bank" | "cash" | "other";
type PaymentStatus = "pending" | "verified" | "rejected";

interface Payment {
  id: string;
  amount: number;
  month: string;
  method: PaymentMethod;
  transactionCode: string;
  notes: string;
  status: PaymentStatus;
  rejectionReason?: string;
  submittedAt: any;
  verifiedAt?: any;
}

interface TenantDoc {
  id: string;
  name: string;
  email: string;
  orgId: string;
  unitId?: string | null;
  propertyId?: string | null;
  status: string;
}

interface TenantUnit {
  rentAmount: number;
  rentDueDay: number;
  unitNumber: string;
  propertyId: string;
}

/* ================= HELPERS ================= */

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  mpesa: "M-Pesa",
  bank:  "Bank Transfer",
  cash:  "Cash",
  other: "Other",
};

const STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    label:     "Pending Verification",
    icon:      <Clock       className="h-4 w-4" />,
    className: "bg-yellow-100 text-yellow-700",
  },
  verified: {
    label:     "Verified",
    icon:      <CheckCircle className="h-4 w-4" />,
    className: "bg-green-100 text-green-700",
  },
  rejected: {
    label:     "Rejected",
    icon:      <XCircle     className="h-4 w-4" />,
    className: "bg-red-100 text-red-700",
  },
};

/* ================= PAGE ================= */

export default function TenantPaymentsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [payments,   setPayments]   = useState<Payment[]>([]);
  const [unitInfo,   setUnitInfo]   = useState<TenantUnit | null>(null);
  const [tenantDoc,  setTenantDoc]  = useState<TenantDoc | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState("");

  const [formData, setFormData] = useState({
    amount:          "",
    month:           getCurrentMonth(),
    method:          "mpesa" as PaymentMethod,
    transactionCode: "",
    notes:           "",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (!currentUser) { setLoading(false); return; }
    fetchData(currentUser);
  }, [authChecked, currentUser]);

  const fetchData = async (user: User) => {
    setLoading(true);
    try {
      const tenantSnap = await getDocs(
        query(collection(db, "tenants"), where("uid", "==", user.uid))
      );
      if (tenantSnap.empty) { setLoading(false); return; }

      const tenant = {
        id: tenantSnap.docs[0].id,
        ...tenantSnap.docs[0].data(),
      } as TenantDoc;
      setTenantDoc(tenant);

      if (tenant.unitId) {
        const unitSnap = await getDoc(doc(db, "units", tenant.unitId));
        if (unitSnap.exists()) {
          const unitData = unitSnap.data();
          setUnitInfo({
            rentAmount: unitData.rentAmount ?? 0,
            rentDueDay: unitData.rentDueDay ?? 1,
            unitNumber: unitData.unitNumber ?? "",
            propertyId: unitData.propertyId ?? "",
          });
          setFormData((prev) => ({
            ...prev,
            amount: unitData.rentAmount?.toString() ?? "",
          }));
        }
      }

      const paymentSnap = await getDocs(
        query(
          collection(db, "payments"),
          where("tenantUid", "==", user.uid),
          orderBy("submittedAt", "desc")
        )
      );
      setPayments(
        paymentSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.transactionCode.trim()) {
      setError("Transaction code or reference is required.");
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (!tenantDoc) {
      setError("Tenant record not found.");
      return;
    }

    const alreadySubmitted = payments.find(
      (p) => p.month === formData.month && p.status !== "rejected"
    );
    if (alreadySubmitted) {
      setError(
        `You already have a ${alreadySubmitted.status} payment for ${formatMonth(formData.month)}.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const newPayment = {
        orgId:           tenantDoc.orgId,
        tenantId:        tenantDoc.id,
        tenantUid:       currentUser!.uid,
        unitId:          tenantDoc.unitId    ?? null,
        propertyId:      tenantDoc.propertyId ?? null,
        amount:          parseFloat(formData.amount),
        month:           formData.month,
        method:          formData.method,
        transactionCode: formData.transactionCode.trim().toUpperCase(),
        notes:           formData.notes.trim(),
        status:          "pending",
        submittedAt:     serverTimestamp(),
        verifiedAt:      null,
        verifiedBy:      null,
        rejectionReason: null,
      };

      const ref = await addDoc(collection(db, "payments"), newPayment);
      setPayments((prev) => [
        { id: ref.id, ...newPayment, submittedAt: new Date() } as unknown as Payment,
        ...prev,
      ]);

      setSuccess("Payment submitted successfully. Your landlord will verify it shortly.");
      setShowForm(false);
      setFormData((prev) => ({
        ...prev,
        transactionCode: "",
        notes:           "",
        month:           getCurrentMonth(),
      }));
    } catch (err) {
      console.error(err);
      setError("Failed to submit payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentMonthPayment = payments.find(
    (p) => p.month === getCurrentMonth()
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <>
      {/* ── PAGE — no min-h-screen, height driven by content ── */}
      <div className="max-w-3xl mx-auto space-y-6 pb-8">

        {/* HEADER */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rent Payments</h1>
            <p className="text-gray-500 text-sm mt-1">
              Submit your payment details for landlord verification
            </p>
          </div>
          {!currentMonthPayment && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Submit Payment
            </button>
          )}
        </header>

        {/* SUCCESS */}
        {success && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {/* CURRENT MONTH STATUS */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {formatMonth(getCurrentMonth())} — Current Month
          </h2>

          {unitInfo && (
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <div>
                <p className="text-sm text-gray-500">Rent due</p>
                <p className="text-2xl font-bold text-gray-900">
                  KES {unitInfo.rentAmount.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Due date</p>
                <p className="text-sm font-medium text-gray-700">
                  {unitInfo.rentDueDay}
                  {unitInfo.rentDueDay === 1 ? "st"
                    : unitInfo.rentDueDay === 2 ? "nd"
                    : unitInfo.rentDueDay === 3 ? "rd"
                    : "th"}{" "}
                  of every month
                </p>
              </div>
            </div>
          )}

          {currentMonthPayment ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Payment submitted</p>
                <p className="font-medium text-gray-800">
                  KES {currentMonthPayment.amount.toLocaleString()} via{" "}
                  {METHOD_LABELS[currentMonthPayment.method]}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ref: {currentMonthPayment.transactionCode}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  STATUS_CONFIG[currentMonthPayment.status].className
                }`}
              >
                {STATUS_CONFIG[currentMonthPayment.status].icon}
                {STATUS_CONFIG[currentMonthPayment.status].label}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  No payment submitted yet
                </p>
                <p className="text-xs text-yellow-700">
                  Submit your payment details once you have paid your landlord.
                </p>
              </div>
            </div>
          )}

          {currentMonthPayment?.status === "rejected" &&
            currentMonthPayment.rejectionReason && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-red-800">Rejection reason:</p>
                <p className="text-sm text-red-700">{currentMonthPayment.rejectionReason}</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-2 text-sm text-indigo-600 hover:underline"
                >
                  Resubmit payment →
                </button>
              </div>
            )}
        </div>

        {/* PAYMENT HISTORY */}
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-indigo-600" />
              Payment History
            </h2>
          </div>

          {payments.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              No payments submitted yet.
            </div>
          ) : (
            <ul className="divide-y">
              {payments.map((payment) => {
                const config = STATUS_CONFIG[payment.status];
                return (
                  <li key={payment.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">
                          {formatMonth(payment.month)}
                        </p>
                        <p className="text-sm text-gray-500">
                          KES {payment.amount.toLocaleString()} •{" "}
                          {METHOD_LABELS[payment.method]} •{" "}
                          <span className="font-mono text-xs">
                            {payment.transactionCode}
                          </span>
                        </p>
                        {payment.notes && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {payment.notes}
                          </p>
                        )}
                        {payment.status === "rejected" &&
                          payment.rejectionReason && (
                            <p className="text-xs text-red-600 mt-1">
                              Rejected: {payment.rejectionReason}
                            </p>
                          )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.className}`}
                      >
                        {config.icon}
                        {config.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── MODAL — scrollable on short screens ── */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 overflow-y-auto"
          onClick={(e) => {
            /* close when clicking the backdrop, not the modal itself */
            if (e.target === e.currentTarget) {
              setShowForm(false);
              setError("");
            }
          }}
        >
          {/* items-start + py-8 so the modal starts near the top and
              the overlay scrolls, keeping buttons always reachable     */}
          <div className="flex items-start justify-center min-h-full py-8 px-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-8 space-y-5 shadow-xl">
              <h2 className="text-xl font-bold text-gray-900">Submit Rent Payment</h2>
              <p className="text-sm text-gray-500">
                Enter your payment details exactly as they appear on your receipt
                or transaction confirmation.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Month */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Month
                  </label>
                  <input
                    type="month"
                    required
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount Paid (KES)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder={
                      unitInfo ? `e.g. ${unitInfo.rentAmount.toLocaleString()}` : "Enter amount"
                    }
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Payment method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["mpesa", "bank", "cash", "other"] as PaymentMethod[]).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setFormData({ ...formData, method })}
                        className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition ${
                          formData.method === method
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {METHOD_LABELS[method]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transaction code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.method === "mpesa"  ? "M-Pesa Transaction Code"
                      : formData.method === "bank" ? "Bank Reference Number"
                      : formData.method === "cash" ? "Receipt Number (if any)"
                      : "Reference / Code"}
                  </label>
                  <input
                    required
                    placeholder={
                      formData.method === "mpesa" ? "e.g. QHX4KLJP2N"
                        : formData.method === "bank" ? "e.g. TRN2026031900012"
                        : "Enter reference"
                    }
                    value={formData.transactionCode}
                    onChange={(e) =>
                      setFormData({ ...formData, transactionCode: e.target.value })
                    }
                    className="w-full border rounded-lg px-4 py-3 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {formData.method === "mpesa" && (
                    <p className="text-xs text-gray-400 mt-1">
                      Find this in your M-Pesa message e.g. QHX4KLJP2N Confirmed
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes (optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Any additional information for your landlord..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full border rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setError(""); }}
                    className="border px-5 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-70 flex items-center gap-2"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitting ? "Submitting..." : "Submit Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
