"use client";

/**
 * app/admin/units/page.tsx
 *
 * Changes from previous:
 * - Renamed `rent` → `rentAmount` to match payment system expectations
 * - Added `rentDueDay` field (day of month rent is due, 1–28)
 * - Both fields saved to Firestore and displayed in the table
 * - Everything else identical
 */

import { useEffect, useState } from "react";
import { Plus, Pencil, Loader2 } from "lucide-react";
import {
  collection, getDocs, addDoc, updateDoc, doc, query, where, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useOrgContext } from "@/lib/org-context";

interface Property { id: string; name: string; }
interface Tenant   { id: string; name: string; status: string; }
interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  rentAmount: number;      // ← RENAMED from `rent`
  rentDueDay: number;      // ← ADDED
  tenantId?: string | null;
  status: "vacant" | "occupied";
}

export default function AdminUnitsPage() {
  const { orgId } = useOrgContext();
  const [units,      setUnits]      = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants,    setTenants]    = useState<Tenant[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const [formData, setFormData] = useState({
    propertyId: "",
    unitNumber: "",
    rentAmount: "",   // ← RENAMED
    rentDueDay: "1",  // ← ADDED: default 1st of month
    tenantId: "",
  });

  useEffect(() => {
    if (!orgId) return;
    const fetchData = async () => {
      try {
        const orgFilter = where("orgId", "==", orgId);
        const [unitSnap, propertySnap, tenantSnap] = await Promise.all([
          getDocs(query(collection(db, "units"),      orgFilter)),
          getDocs(query(collection(db, "properties"), orgFilter)),
          getDocs(query(collection(db, "tenants"),    orgFilter)),
        ]);
        setUnits(unitSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Unit)));
        setProperties(propertySnap.docs.map((d) => ({ id: d.id, ...d.data() } as Property)));
        setTenants(tenantSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Tenant)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orgId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const assignedTenant = formData.tenantId || null;
    const status = assignedTenant ? "occupied" : "vacant";

    try {
      if (editingUnit) {
        await updateDoc(doc(db, "units", editingUnit.id), {
          propertyId:  formData.propertyId,
          unitNumber:  formData.unitNumber.trim(),
          rentAmount:  Number(formData.rentAmount),   // ← RENAMED
          rentDueDay:  Number(formData.rentDueDay),   // ← ADDED
          tenantId:    assignedTenant,
          status,
        });
        setUnits((prev) =>
          prev.map((u) =>
            u.id === editingUnit.id
              ? {
                  ...u,
                  propertyId:  formData.propertyId,
                  unitNumber:  formData.unitNumber,
                  rentAmount:  Number(formData.rentAmount),
                  rentDueDay:  Number(formData.rentDueDay),
                  tenantId:    assignedTenant,
                  status,
                }
              : u
          )
        );
      } else {
        const ref = await addDoc(collection(db, "units"), {
          propertyId:  formData.propertyId,
          unitNumber:  formData.unitNumber.trim(),
          rentAmount:  Number(formData.rentAmount),   // ← RENAMED
          rentDueDay:  Number(formData.rentDueDay),   // ← ADDED
          tenantId:    assignedTenant,
          status,
          orgId,
          createdAt:   serverTimestamp(),
        });
        setUnits((prev) => [
          ...prev,
          {
            id:          ref.id,
            propertyId:  formData.propertyId,
            unitNumber:  formData.unitNumber,
            rentAmount:  Number(formData.rentAmount),
            rentDueDay:  Number(formData.rentDueDay),
            tenantId:    assignedTenant,
            status,
          },
        ]);
      }
      setFormData({ propertyId: "", unitNumber: "", rentAmount: "", rentDueDay: "1", tenantId: "" });
      setEditingUnit(null);
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save unit");
    }
  };

  const availableTenants = tenants.filter(
    (t) =>
      (t.status === "active" || t.status === "pending") &&
      !units.some((u) => u.tenantId === t.id && u.id !== editingUnit?.id)
  );

  /* ── Ordinal suffix helper ── */
  const ordinal = (n: number) => {
    if (n === 1) return "1st";
    if (n === 2) return "2nd";
    if (n === 3) return "3rd";
    return `${n}th`;
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Units</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white text-sm hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Add Unit
          </button>
        </header>

        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          {loading ? (
            <div className="flex justify-center p-16">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">#</th>
                  <th className="px-6 py-3 text-left">Property</th>
                  <th className="px-6 py-3 text-left">Unit</th>
                  <th className="px-6 py-3 text-left">Tenant</th>
                  <th className="px-6 py-3 text-left">Rent (KES)</th>
                  <th className="px-6 py-3 text-left">Due Day</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      No units added yet.
                    </td>
                  </tr>
                ) : (
                  units.map((unit, index) => {
                    const property = properties.find((p) => p.id === unit.propertyId);
                    const tenant   = tenants.find((t) => t.id === unit.tenantId);
                    return (
                      <tr key={unit.id} className="border-t hover:bg-gray-50">
                        <td className="px-6 py-3">{index + 1}</td>
                        <td className="px-6 py-3">{property?.name || "-"}</td>
                        <td className="px-6 py-3 font-medium">{unit.unitNumber}</td>
                        <td className="px-6 py-3">{tenant?.name || "Unassigned"}</td>
                        <td className="px-6 py-3">
                          {unit.rentAmount?.toLocaleString() ?? "-"}
                        </td>
                        <td className="px-6 py-3 text-gray-500">
                          {unit.rentDueDay ? ordinal(unit.rentDueDay) : "-"}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              unit.status === "occupied"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {unit.status}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <button
                            onClick={() => {
                              setEditingUnit(unit);
                              setFormData({
                                propertyId:  unit.propertyId,
                                unitNumber:  unit.unitNumber,
                                rentAmount:  String(unit.rentAmount ?? ""),
                                rentDueDay:  String(unit.rentDueDay ?? 1),
                                tenantId:    unit.tenantId || "",
                              });
                              setShowForm(true);
                            }}
                            className="text-indigo-600 hover:underline"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-8 space-y-6">
            <h2 className="text-xl font-bold">
              {editingUnit ? "Edit Unit" : "Add Unit"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Property */}
              <select
                required
                value={formData.propertyId}
                onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
                className="w-full rounded-lg border px-4 py-3"
              >
                <option value="">Select Property</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              {/* Unit number */}
              <input
                required
                placeholder="Unit Number (e.g. A1, 101)"
                value={formData.unitNumber}
                onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                className="w-full rounded-lg border px-4 py-3"
              />

              {/* Rent amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Rent (KES)
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="e.g. 25000"
                  value={formData.rentAmount}
                  onChange={(e) => setFormData({ ...formData, rentAmount: e.target.value })}
                  className="w-full rounded-lg border px-4 py-3"
                />
              </div>

              {/* Rent due day */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rent Due Day (day of month)
                </label>
                <select
                  required
                  value={formData.rentDueDay}
                  onChange={(e) => setFormData({ ...formData, rentDueDay: e.target.value })}
                  className="w-full rounded-lg border px-4 py-3"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {ordinal(d)} of every month
                    </option>
                  ))}
                </select>
              </div>

              {/* Assign tenant */}
              <select
                value={formData.tenantId}
                onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                className="w-full rounded-lg border px-4 py-3"
              >
                <option value="">Unassigned</option>
                {availableTenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingUnit(null); }}
                  className="border px-6 py-3 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="bg-indigo-600 text-white px-6 py-3 rounded-lg">
                  Save Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
