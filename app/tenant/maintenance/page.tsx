// app/tenant/maintenance/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  Wrench,
  Plus,
  CalendarDays,
  Home,
  Loader2,
} from "lucide-react";

/* ================= TYPES ================= */

type RequestStatus = "open" | "in-progress" | "resolved";

interface MaintenanceRequest {
  id: string;
  property: string;
  unit: string;
  tenant: string;
  tenantId: string;
  title: string;
  description: string;
  status: RequestStatus;
  submittedAt: Date;
}

interface FormState {
  property: string;
  unit: string;
  title: string;
  description: string;
}

/* ================= PAGE ================= */

export default function TenantMaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormState>({
    property: "",
    unit: "",
    title: "",
    description: "",
  });

  const user = auth.currentUser;

  /* ================= FETCH REQUESTS ================= */

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "maintenance_requests"),
      where("tenantId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: MaintenanceRequest[] = snapshot.docs.map((doc) => {
          const d = doc.data();

          return {
            id: doc.id,
            property: d.property ?? "",
            unit: d.unit ?? "",
            tenant: d.tenant ?? "",
            tenantId: d.tenantId ?? "",
            title: d.title ?? "",
            description: d.description ?? "",
            status: (d.status as RequestStatus) ?? "open",
            submittedAt:
              d.submittedAt instanceof Timestamp
                ? d.submittedAt.toDate()
                : new Date(),
          };
        });

        setRequests(
          data.sort(
            (a, b) =>
              b.submittedAt.getTime() - a.submittedAt.getTime()
          )
        );
        setLoading(false);
      },
      (error) => {
        console.error("Error loading maintenance requests:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  /* ================= SUBMIT REQUEST ================= */

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || submitting) return;

    setSubmitting(true);

    try {
      await addDoc(collection(db, "maintenance_requests"), {
        property: formData.property.trim(),
        unit: formData.unit.trim(),
        title: formData.title.trim(),
        description: formData.description.trim(),
        tenant:
          user.displayName ||
          user.email?.split("@")[0] ||
          "Tenant",
        tenantId: user.uid,
        status: "open",
        submittedAt: serverTimestamp(),
      });

      setFormData({
        property: "",
        unit: "",
        title: "",
        description: "",
      });

      setShowForm(false);
    } catch (error) {
      console.error("Submit error:", error);
      alert("Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Maintenance Requests
            </h1>
            <p className="mt-2 text-gray-600">
              Submit and track your property issues
            </p>
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-3 rounded-xl bg-indigo-600 px-6 py-3 text-white font-medium hover:bg-indigo-700 transition shadow-sm"
          >
            <Plus className="h-5 w-5" />
            New Request
          </button>
        </header>

        {/* REQUESTS LIST */}
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-16 flex justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
            </div>
          ) : requests.length === 0 ? (
            <div className="p-16 text-center">
              <Wrench className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                No maintenance requests yet
              </p>
              <p className="text-gray-400 mt-2">
                Click “New Request” to report an issue
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="p-6 hover:bg-gray-50 transition"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Home className="h-5 w-5" />
                      <span className="font-medium">
                        {req.property}
                      </span>
                      <span>• Unit {req.unit}</span>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900">
                      {req.title}
                    </h3>

                    <p className="text-gray-600">
                      {req.description}
                    </p>

                    <div className="flex items-center gap-6 text-sm">
                      <span className="flex items-center gap-2 text-gray-500">
                        <CalendarDays className="h-4 w-4" />
                        {formatDate(req.submittedAt)}
                      </span>
                      <StatusBadge status={req.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">
                New Maintenance Request
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              <div className="grid md:grid-cols-2 gap-6">
                <Input
                  label="Property"
                  value={formData.property}
                  onChange={(v) =>
                    setFormData({ ...formData, property: v })
                  }
                />
                <Input
                  label="Unit Number"
                  value={formData.unit}
                  onChange={(v) =>
                    setFormData({ ...formData, unit: v })
                  }
                />
              </div>

              <Input
                label="Issue Title"
                value={formData.title}
                onChange={(v) =>
                  setFormData({ ...formData, title: v })
                }
              />

              <Textarea
                label="Description"
                value={formData.description}
                onChange={(v) =>
                  setFormData({ ...formData, description: v })
                }
              />

              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-3 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-70"
                >
                  {submitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

/* ================= REUSABLE UI ================= */

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block mb-2 text-sm font-medium">
        {label}
      </label>
      <input
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-indigo-600"
      />
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block mb-2 text-sm font-medium">
        {label}
      </label>
      <textarea
        required
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-indigo-600 resize-none"
      />
    </div>
  );
}

function StatusBadge({ status }: { status: RequestStatus }) {
  const map = {
    open: "bg-red-50 text-red-700 ring-red-200",
    "in-progress":
      "bg-yellow-50 text-yellow-700 ring-yellow-200",
    resolved:
      "bg-green-50 text-green-700 ring-green-200",
  };

  return (
    <span
      className={`px-4 py-2 rounded-full text-sm font-medium ring-1 ${map[status]}`}
    >
      {status.replace("-", " ")}
    </span>
  );
}
