"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Loader2 } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Property {
  id: string;
  name: string;
}

interface Tenant {
  id: string;
  name: string;
  active: boolean;
}

interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  rent: number;
  tenantId?: string | null;
  status: "vacant" | "occupied";
}

export default function AdminUnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const [formData, setFormData] = useState({
    propertyId: "",
    unitNumber: "",
    rent: "",
    tenantId: "",
  });

  // 🔹 Load data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [unitSnap, propertySnap, tenantSnap] = await Promise.all([
          getDocs(collection(db, "units")),
          getDocs(collection(db, "properties")),
          getDocs(collection(db, "tenants")),
        ]);

        setUnits(
          unitSnap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as Unit)
          )
        );

        setProperties(
          propertySnap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as Property)
          )
        );

        setTenants(
          tenantSnap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as Tenant)
          )
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 🔹 Create / Update unit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const assignedTenant = formData.tenantId || null;
    const status = assignedTenant ? "occupied" : "vacant";

    try {
      if (editingUnit) {
        const ref = doc(db, "units", editingUnit.id);

        await updateDoc(ref, {
          propertyId: formData.propertyId,
          unitNumber: formData.unitNumber.trim(),
          rent: Number(formData.rent),
          tenantId: assignedTenant,
          status,
        });

        setUnits((prev) =>
          prev.map((u) =>
            u.id === editingUnit.id
              ? {
                  ...u,
                  ...{
                    propertyId: formData.propertyId,
                    unitNumber: formData.unitNumber,
                    rent: Number(formData.rent),
                    tenantId: assignedTenant,
                    status,
                  },
                }
              : u
          )
        );
      } else {
        const ref = await addDoc(collection(db, "units"), {
          propertyId: formData.propertyId,
          unitNumber: formData.unitNumber.trim(),
          rent: Number(formData.rent),
          tenantId: assignedTenant,
          status,
          createdAt: new Date(),
        });

        setUnits((prev) => [
          ...prev,
          {
            id: ref.id,
            propertyId: formData.propertyId,
            unitNumber: formData.unitNumber,
            rent: Number(formData.rent),
            tenantId: assignedTenant,
            status,
          },
        ]);
      }

      setFormData({ propertyId: "", unitNumber: "", rent: "", tenantId: "" });
      setEditingUnit(null);
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save unit");
    }
  };

  // 🔹 Available tenants (not already assigned)
  const availableTenants = tenants.filter(
    (t) => t.active && !units.some((u) => u.tenantId === t.id)
  );

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Units</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white text-sm hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Add Unit
          </button>
        </header>

        {/* TABLE */}
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          {loading ? (
            <div className="flex justify-center p-16">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3">#</th>
                  <th className="px-6 py-3">Property</th>
                  <th className="px-6 py-3">Unit</th>
                  <th className="px-6 py-3">Tenant</th>
                  <th className="px-6 py-3">Rent</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No units added yet.
                    </td>
                  </tr>
                ) : (
                  units.map((unit, index) => {
                    const property = properties.find(
                      (p) => p.id === unit.propertyId
                    );
                    const tenant = tenants.find(
                      (t) => t.id === unit.tenantId
                    );

                    return (
                      <tr key={unit.id} className="border-t hover:bg-gray-50">
                        <td className="px-6 py-3">{index + 1}</td>
                        <td className="px-6 py-3">{property?.name || "-"}</td>
                        <td className="px-6 py-3 font-medium">
                          {unit.unitNumber}
                        </td>
                        <td className="px-6 py-3">
                          {tenant?.name || "Unassigned"}
                        </td>
                        <td className="px-6 py-3">KES {unit.rent}</td>
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
                                propertyId: unit.propertyId,
                                unitNumber: unit.unitNumber,
                                rent: String(unit.rent),
                                tenantId: unit.tenantId || "",
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
              <select
                required
                value={formData.propertyId}
                onChange={(e) =>
                  setFormData({ ...formData, propertyId: e.target.value })
                }
                className="w-full rounded-lg border px-4 py-3"
              >
                <option value="">Select Property</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <input
                required
                placeholder="Unit Number"
                value={formData.unitNumber}
                onChange={(e) =>
                  setFormData({ ...formData, unitNumber: e.target.value })
                }
                className="w-full rounded-lg border px-4 py-3"
              />

              <input
                required
                type="number"
                placeholder="Rent"
                value={formData.rent}
                onChange={(e) =>
                  setFormData({ ...formData, rent: e.target.value })
                }
                className="w-full rounded-lg border px-4 py-3"
              />

              <select
                value={formData.tenantId}
                onChange={(e) =>
                  setFormData({ ...formData, tenantId: e.target.value })
                }
                className="w-full rounded-lg border px-4 py-3"
              >
                <option value="">Unassigned</option>
                {availableTenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="border px-6 py-3 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-6 py-3 rounded-lg"
                >
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
