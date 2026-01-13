"use client";

import { useEffect, useState } from "react";
import { Plus, User, Home, Loader2, Link2Off } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ---------------- TYPES ---------------- */

interface Property {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  tenantId?: string | null;
  status: "vacant" | "occupied";
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  propertyId?: string | null;
  unitId?: string | null;
  active: boolean;
}

/* ---------------- PAGE ---------------- */

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    propertyId: "",
    unitId: "",
    active: true,
  });

  /* ---------------- FETCH DATA ---------------- */

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tenantSnap, propertySnap, unitSnap] = await Promise.all([
          getDocs(collection(db, "tenants")),
          getDocs(collection(db, "properties")),
          getDocs(collection(db, "units")),
        ]);

        setTenants(
          tenantSnap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as Tenant)
          )
        );

        setProperties(
          propertySnap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as Property)
          )
        );

        setUnits(
          unitSnap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as Unit)
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

  /* ---------------- ADD TENANT ---------------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // 1️⃣ Create tenant
      const tenantRef = await addDoc(collection(db, "tenants"), {
        name: formData.name.trim(),
        email: formData.email.trim(),
        propertyId: formData.propertyId || null,
        unitId: formData.unitId || null,
        active: formData.active,
        createdAt: new Date(),
      });

      // 2️⃣ Assign unit (if selected)
      if (formData.unitId) {
        const unitRef = doc(db, "units", formData.unitId);
        await updateDoc(unitRef, {
          tenantId: tenantRef.id,
          status: "occupied",
        });
      }

      // 3️⃣ Update UI state
      setTenants((prev) => [
        ...prev,
        {
          id: tenantRef.id,
          ...formData,
        },
      ]);

      setUnits((prev) =>
        prev.map((u) =>
          u.id === formData.unitId
            ? { ...u, tenantId: tenantRef.id, status: "occupied" }
            : u
        )
      );

      setFormData({
        name: "",
        email: "",
        propertyId: "",
        unitId: "",
        active: true,
      });
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert("Failed to add tenant");
    }
  };

  /* ---------------- TOGGLE ACTIVE ---------------- */

  const toggleTenantStatus = async (tenant: Tenant) => {
    try {
      await updateDoc(doc(db, "tenants", tenant.id), {
        active: !tenant.active,
      });

      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenant.id ? { ...t, active: !t.active } : t
        )
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update tenant status");
    }
  };

  /* ---------------- REMOVE FROM UNIT ---------------- */

  const removeFromUnit = async (tenant: Tenant) => {
    if (!tenant.unitId) return;

    try {
      // Update unit
      await updateDoc(doc(db, "units", tenant.unitId), {
        tenantId: null,
        status: "vacant",
      });

      // Update tenant
      await updateDoc(doc(db, "tenants", tenant.id), {
        unitId: null,
        propertyId: null,
      });

      // Update UI
      setUnits((prev) =>
        prev.map((u) =>
          u.id === tenant.unitId
            ? { ...u, tenantId: null, status: "vacant" }
            : u
        )
      );

      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenant.id
            ? { ...t, unitId: null, propertyId: null }
            : t
        )
      );
    } catch (err) {
      console.error(err);
      alert("Failed to remove tenant from unit");
    }
  };

  /* ---------------- HELPERS ---------------- */

  const availableUnits = units.filter(
    (u) =>
      u.propertyId === formData.propertyId && u.status === "vacant"
  );

  /* ---------------- UI ---------------- */

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <header className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Tenants</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Add Tenant
          </button>
        </header>

        {/* TABLE */}
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          {loading ? (
            <div className="p-16 flex justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3">#</th>
                  <th className="px-6 py-3">Tenant</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Property / Unit</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500">
                      No tenants added yet.
                    </td>
                  </tr>
                ) : (
                  tenants.map((tenant, index) => {
                    const property = properties.find(
                      (p) => p.id === tenant.propertyId
                    );
                    const unit = units.find(
                      (u) => u.id === tenant.unitId
                    );

                    return (
                      <tr key={tenant.id} className="border-t hover:bg-gray-50">
                        <td className="px-6 py-3">{index + 1}</td>
                        <td className="px-6 py-3 flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          {tenant.name}
                        </td>
                        <td className="px-6 py-3">{tenant.email}</td>
                        <td className="px-6 py-3 flex items-center gap-2">
                          <Home className="h-4 w-4 text-gray-500" />
                          {property?.name || "-"} / {unit?.unitNumber || "-"}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              tenant.active
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {tenant.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-3 flex gap-3">
                          <button
                            onClick={() => toggleTenantStatus(tenant)}
                            className="text-indigo-600 hover:underline"
                          >
                            {tenant.active ? "Deactivate" : "Activate"}
                          </button>

                          {tenant.unitId && (
                            <button
                              onClick={() => removeFromUnit(tenant)}
                              className="text-red-600 hover:underline flex items-center gap-1"
                            >
                              <Link2Off className="h-4 w-4" />
                              Remove
                            </button>
                          )}
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

      {/* ADD TENANT MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-8 space-y-6">
            <h2 className="text-xl font-bold">Add Tenant</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                required
                placeholder="Full name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full border rounded-lg px-4 py-3"
              />

              <input
                required
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full border rounded-lg px-4 py-3"
              />

              <select
                value={formData.propertyId}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    propertyId: e.target.value,
                    unitId: "",
                  })
                }
                className="w-full border rounded-lg px-4 py-3"
              >
                <option value="">Select Property</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={formData.unitId}
                onChange={(e) =>
                  setFormData({ ...formData, unitId: e.target.value })
                }
                className="w-full border rounded-lg px-4 py-3"
              >
                <option value="">Select Unit</option>
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitNumber}
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
                  Add Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
