"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  User,
  Home,
  Loader2,
  Link2Off,
  CheckCircle,
  PauseCircle,
  Clock,
} from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ================= TYPES ================= */

type TenantStatus = "pending" | "active" | "disabled";

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
  status: TenantStatus;
}

/* ================= PAGE ================= */

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
  });

  /* ================= FETCH DATA ================= */

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tenantSnap, propertySnap, unitSnap] = await Promise.all([
          getDocs(collection(db, "tenants")),
          getDocs(collection(db, "properties")),
          getDocs(collection(db, "units")),
        ]);

        setTenants(
          tenantSnap.docs.map((d) => ({
            id: d.id,
            status: d.data().status ?? "active", // backward safe
            ...d.data(),
          })) as Tenant[]
        );

        setProperties(
          propertySnap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as Property
          )
        );

        setUnits(
          unitSnap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as Unit
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

  /* ================= ADD TENANT ================= */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const tenantRef = await addDoc(collection(db, "tenants"), {
        name: formData.name.trim(),
        email: formData.email.trim(),
        propertyId: formData.propertyId || null,
        unitId: formData.unitId || null,
        status: "pending",
        createdAt: new Date(),
      });

      if (formData.unitId) {
        await updateDoc(doc(db, "units", formData.unitId), {
          tenantId: tenantRef.id,
          status: "occupied",
        });
      }

      setTenants((prev) => [
        ...prev,
        {
          id: tenantRef.id,
          ...formData,
          status: "pending",
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
      });
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert("Failed to add tenant");
    }
  };

  /* ================= STATUS TOGGLE ================= */

  const toggleTenantStatus = async (tenant: Tenant) => {
    const newStatus: TenantStatus =
      tenant.status === "active" ? "disabled" : "active";

    try {
      await updateDoc(doc(db, "tenants", tenant.id), {
        status: newStatus,
      });

      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenant.id ? { ...t, status: newStatus } : t
        )
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update tenant status");
    }
  };

  /* ================= REMOVE FROM UNIT ================= */

  const removeFromUnit = async (tenant: Tenant) => {
    if (!tenant.unitId) return;

    try {
      await updateDoc(doc(db, "units", tenant.unitId), {
        tenantId: null,
        status: "vacant",
      });

      await updateDoc(doc(db, "tenants", tenant.id), {
        unitId: null,
        propertyId: null,
      });

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

  /* ================= HELPERS ================= */

  const availableUnits = units.filter(
    (u) =>
      u.propertyId === formData.propertyId && u.status === "vacant"
  );

  const statusUI = {
    pending: {
      label: "Pending",
      icon: <Clock className="h-4 w-4" />,
      className: "bg-yellow-100 text-yellow-700",
    },
    active: {
      label: "Active",
      icon: <CheckCircle className="h-4 w-4" />,
      className: "bg-green-100 text-green-700",
    },
    disabled: {
      label: "Disabled",
      icon: <PauseCircle className="h-4 w-4" />,
      className: "bg-red-100 text-red-700",
    },
  };

  /* ================= UI ================= */

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
       <header className="flex justify-between items-center">
  <h1 className="text-3xl font-bold text-gray-900">Tenants</h1>

  <div className="flex items-center gap-3">
    {/* Invite Tenant */}
    <Link
      href="/admin/tenants/invite"
      className="flex items-center gap-2 border border-indigo-600 text-indigo-600 px-4 py-2 rounded-md hover:bg-indigo-50"
    >
      Invite Tenant
    </Link>

    {/* Manual Add Tenant */}
    <button
      onClick={() => setShowForm(true)}
      className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
    >
      <Plus className="h-4 w-4" /> Add Tenant
    </button>
  </div>
</header>


        {/* TABLE */}
        <div className="rounded-xl border bg-white shadow-sm overflow-x-auto">
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
                {tenants.map((tenant, i) => {
                  const property = properties.find(
                    (p) => p.id === tenant.propertyId
                  );
                  const unit = units.find(
                    (u) => u.id === tenant.unitId
                  );
                  const status = statusUI[tenant.status];

                  return (
                    <tr key={tenant.id} className="border-t hover:bg-gray-50">
                      <td className="px-6 py-3">{i + 1}</td>
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
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${status.className}`}
                        >
                          {status.icon}
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 flex gap-4">
                        <button
                          onClick={() => toggleTenantStatus(tenant)}
                          className="text-indigo-600 hover:underline"
                        >
                          {tenant.status === "active"
                            ? "Disable"
                            : "Activate"}
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
                })}
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
