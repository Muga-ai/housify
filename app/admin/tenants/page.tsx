"use client";

/**
 * app/admin/tenants/page.tsx
 *
 * Changes:
 * - REMOVED "Add Tenant" button and modal — use Invite Tenant only
 *   (inviting already creates the tenant record, adding manually created duplicates)
 * - ADDED delete button per tenant row with confirmation
 * - ADDED delete clears unit assignment if tenant had one
 * - Everything else identical
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  User, Home, Loader2, Link2Off,
  CheckCircle, PauseCircle, Clock, Trash2,
} from "lucide-react";
import {
  collection, getDocs, updateDoc, deleteDoc,
  doc, query, where, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useOrgContext } from "@/lib/org-context";

/* ================= TYPES ================= */

type TenantStatus = "pending" | "active" | "disabled";

interface Property { id: string; name: string; }
interface Unit     { id: string; propertyId: string; unitNumber: string; tenantId?: string | null; status: "vacant" | "occupied"; }
interface Tenant   { id: string; name: string; email: string; propertyId?: string | null; unitId?: string | null; status: TenantStatus; }

/* ================= PAGE ================= */

export default function AdminTenantsPage() {
  const { orgId } = useOrgContext();

  const [tenants,    setTenants]    = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units,      setUnits]      = useState<Unit[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ── FETCH ── */

  useEffect(() => {
    if (!orgId) return;
    const fetchData = async () => {
      try {
        const orgFilter = where("orgId", "==", orgId);
        const [tenantSnap, propertySnap, unitSnap] = await Promise.all([
          getDocs(query(collection(db, "tenants"),    orgFilter)),
          getDocs(query(collection(db, "properties"), orgFilter)),
          getDocs(query(collection(db, "units"),      orgFilter)),
        ]);
        setTenants(tenantSnap.docs.map((d) => ({
          id: d.id, status: d.data().status ?? "active", ...d.data(),
        })) as Tenant[]);
        setProperties(propertySnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Property));
        setUnits(unitSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Unit));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orgId]);

  /* ── STATUS TOGGLE ── */

  const toggleTenantStatus = async (tenant: Tenant) => {
    const newStatus: TenantStatus =
      tenant.status === "active" ? "disabled" : "active";
    try {
      await updateDoc(doc(db, "tenants", tenant.id), { status: newStatus });
      setTenants((prev) =>
        prev.map((t) => t.id === tenant.id ? { ...t, status: newStatus } : t)
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update tenant status");
    }
  };

  /* ── REMOVE FROM UNIT ── */

  const removeFromUnit = async (tenant: Tenant) => {
    if (!tenant.unitId) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "units", tenant.unitId), {
        tenantId: null, status: "vacant",
      });
      batch.update(doc(db, "tenants", tenant.id), {
        unitId: null, propertyId: null,
      });
      await batch.commit();

      setUnits((prev) =>
        prev.map((u) =>
          u.id === tenant.unitId ? { ...u, tenantId: null, status: "vacant" } : u
        )
      );
      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenant.id ? { ...t, unitId: null, propertyId: null } : t
        )
      );
    } catch (err) {
      console.error(err);
      alert("Failed to remove tenant from unit");
    }
  };

  /* ── DELETE TENANT ── */

  const deleteTenant = async (tenant: Tenant) => {
    if (!confirm(`Delete ${tenant.name}? This cannot be undone.`)) return;
    setDeletingId(tenant.id);
    try {
      const batch = writeBatch(db);

      // Clear unit assignment if tenant had one
      if (tenant.unitId) {
        batch.update(doc(db, "units", tenant.unitId), {
          tenantId: null, status: "vacant",
        });
      }

      // Delete tenant document
      batch.delete(doc(db, "tenants", tenant.id));

      await batch.commit();

      setTenants((prev) => prev.filter((t) => t.id !== tenant.id));
      if (tenant.unitId) {
        setUnits((prev) =>
          prev.map((u) =>
            u.id === tenant.unitId ? { ...u, tenantId: null, status: "vacant" } : u
          )
        );
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete tenant");
    } finally {
      setDeletingId(null);
    }
  };

  /* ── STATUS UI ── */

  const statusUI = {
    pending:  { label: "Pending",  icon: <Clock       className="h-4 w-4" />, className: "bg-yellow-100 text-yellow-700" },
    active:   { label: "Active",   icon: <CheckCircle className="h-4 w-4" />, className: "bg-green-100 text-green-700"  },
    disabled: { label: "Disabled", icon: <PauseCircle className="h-4 w-4" />, className: "bg-red-100 text-red-700"     },
  };

  /* ── RENDER ── */

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tenants</h1>
            <p className="text-sm text-gray-500 mt-1">
              Invite tenants via link — each invite creates one tenant record automatically
            </p>
          </div>
          {/* Only Invite Tenant — no Add Tenant button */}
          <Link
            href="/admin/tenants/invite"
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium"
          >
            Invite Tenant
          </Link>
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
                  <th className="px-6 py-3 text-left">#</th>
                  <th className="px-6 py-3 text-left">Tenant</th>
                  <th className="px-6 py-3 text-left">Email</th>
                  <th className="px-6 py-3 text-left">Property / Unit</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500">
                      No tenants yet. Use Invite Tenant to add your first tenant.
                    </td>
                  </tr>
                ) : (
                  tenants.map((tenant, i) => {
                    const property = properties.find((p) => p.id === tenant.propertyId);
                    const unit     = units.find((u) => u.id === tenant.unitId);
                    const status   = statusUI[tenant.status];
                    const isDeleting = deletingId === tenant.id;

                    return (
                      <tr key={tenant.id} className="border-t hover:bg-gray-50">
                        <td className="px-6 py-3 text-gray-500">{i + 1}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400 shrink-0" />
                            <span className="font-medium text-gray-800">{tenant.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-gray-600">{tenant.email}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4 text-gray-400 shrink-0" />
                            <span className="text-gray-700">
                              {property?.name || "—"} / {unit?.unitNumber || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${status.className}`}>
                            {status.icon}
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            {/* Activate / Disable */}
                            <button
                              onClick={() => toggleTenantStatus(tenant)}
                              className="text-indigo-600 hover:underline text-xs"
                            >
                              {tenant.status === "active" ? "Disable" : "Activate"}
                            </button>

                            {/* Remove from unit */}
                            {tenant.unitId && (
                              <button
                                onClick={() => removeFromUnit(tenant)}
                                className="text-orange-500 hover:underline flex items-center gap-1 text-xs"
                              >
                                <Link2Off className="h-3.5 w-3.5" />
                                Unassign
                              </button>
                            )}

                            {/* Delete tenant */}
                            <button
                              onClick={() => deleteTenant(tenant)}
                              disabled={isDeleting}
                              className="text-red-500 hover:text-red-700 flex items-center gap-1 text-xs disabled:opacity-50"
                            >
                              {isDeleting
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />
                              }
                              Delete
                            </button>
                          </div>
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
    </main>
  );
}
