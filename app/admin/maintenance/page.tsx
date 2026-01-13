"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  updateDoc,
  doc,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Wrench, Search, CalendarDays, Home, User } from "lucide-react";

interface MaintenanceRequest {
  id: string;
  property: string;
  unit: string;
  tenant: string;
  title: string;
  description: string;
  status: "open" | "in-progress" | "resolved";
  submitted: string; // YYYY-MM-DD format
}

const filterOptions = ["all", "open", "in-progress", "resolved"] as const;
type FilterType = typeof filterOptions[number];

export default function AdminMaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MaintenanceRequest | null>(null);
  const [loading, setLoading] = useState(true);

  /* ================= FETCH REQUESTS ================= */
  useEffect(() => {
    const q = query(
      collection(db, "maintenance_requests"),
      orderBy("submittedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            property: d.property ?? "",
            unit: d.unit ?? "",
            tenant: d.tenant ?? "",
            title: d.title ?? "",
            description: d.description ?? "",
            status: d.status ?? "open",
            submitted: d.submittedAt instanceof Timestamp
              ? d.submittedAt.toDate().toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0],
          } as MaintenanceRequest;
        });
        setRequests(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching maintenance requests:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /* ================= UPDATE STATUS ================= */
  const updateStatus = async (id: string, newStatus: MaintenanceRequest["status"]) => {
    try {
      await updateDoc(doc(db, "maintenance_requests", id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      // Optimistic UI update
      setRequests((prev) =>
        prev.map((req) => (req.id === id ? { ...req, status: newStatus } : req))
      );
      if (selected?.id === id) setSelected({ ...selected, status: newStatus });
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Failed to update status. Please try again.");
    }
  };

  /* ================= FILTER & SEARCH ================= */
  const filteredRequests = requests.filter((req) => {
    const matchesFilter = filter === "all" || req.status === filter;
    const matchesSearch =
      req.title.toLowerCase().includes(search.toLowerCase()) ||
      req.unit.toLowerCase().includes(search.toLowerCase()) ||
      req.tenant.toLowerCase().includes(search.toLowerCase()) ||
      req.property.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  /* ================= UI ================= */
  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Maintenance Requests</h1>
            <p className="mt-1 text-sm text-gray-600">
              View and manage all tenant-reported issues
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by title, unit, tenant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-full sm:w-80 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
        </header>

        {/* FILTER TABS */}
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                filter === option
                  ? "bg-indigo-600 text-white"
                  : "bg-white border text-gray-700 hover:bg-gray-50"
              }`}
            >
              {option.charAt(0).toUpperCase() + option.slice(1).replace("-", " ")}
            </button>
          ))}
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full table-auto text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-600">#</th>
                <th className="px-6 py-3 font-medium text-gray-600">Property / Unit</th>
                <th className="px-6 py-3 font-medium text-gray-600">Tenant</th>
                <th className="px-6 py-3 font-medium text-gray-600">Issue</th>
                <th className="px-6 py-3 font-medium text-gray-600">Status</th>
                <th className="px-6 py-3 font-medium text-gray-600">Submitted</th>
                <th className="px-6 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {search || filter !== "all"
                      ? "No matching requests found."
                      : "No maintenance requests yet."}
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req, index) => (
                  <tr key={req.id} className="border-t hover:bg-gray-50">
                    <td className="px-6 py-3">{index + 1}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4 text-gray-500" />
                        <div>
                          <div className="font-medium text-gray-900">{req.property}</div>
                          <div className="text-xs text-gray-500">Unit {req.unit}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        {req.tenant}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="max-w-xs">
                        <div className="font-medium text-gray-900">{req.title}</div>
                        <div className="text-xs text-gray-500 truncate">{req.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarDays className="h-4 w-4 text-gray-500" />
                        {req.submitted}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => setSelected(req)}
                        className="text-indigo-600 hover:underline text-sm font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILS MODAL */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-screen overflow-y-auto p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selected.title}</h2>
                <p className="mt-1 text-sm text-gray-600">Request ID: {selected.id}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
              <div>
                <span className="font-medium text-gray-600">Property:</span>
                <p className="mt-1">{selected.property}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Unit:</span>
                <p className="mt-1">{selected.unit}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Tenant:</span>
                <p className="mt-1">{selected.tenant}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Submitted:</span>
                <p className="mt-1">{selected.submitted}</p>
              </div>
            </div>

            <div>
              <span className="block font-medium text-gray-600 mb-2">Description</span>
              <p className="text-gray-700 whitespace-pre-wrap">{selected.description}</p>
            </div>

            <div>
              <label className="block font-medium text-gray-600 mb-2">Update Status</label>
              <select
                value={selected.status}
                onChange={(e) =>
                  updateStatus(selected.id, e.target.value as MaintenanceRequest["status"])
                }
                className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelected(null)}
                className="rounded-md bg-indigo-600 px-6 py-2 text-white font-medium hover:bg-indigo-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ================= STATUS BADGE ================= */
function StatusBadge({ status }: { status: string }) {
  let bgColor = "";
  let textColor = "";

  switch (status) {
    case "open":
      bgColor = "bg-red-100";
      textColor = "text-red-700";
      break;
    case "in-progress":
      bgColor = "bg-yellow-100";
      textColor = "text-yellow-700";
      break;
    case "resolved":
      bgColor = "bg-green-100";
      textColor = "text-green-700";
      break;
  }

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
      {status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ")}
    </span>
  );
}
