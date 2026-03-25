"use client";

/**
 * app/admin/expenses/page.tsx
 *
 * Property expense tracker. Log costs against properties or specific units.
 * Categories: garbage, security, insurance, caretaker, water, electricity,
 * internet, maintenance, land_rates, agent_fee, other.
 * Frequency: monthly, quarterly, annual, one_off.
 * Each expense is tagged to a month (YYYY-MM) and an orgId.
 */

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useOrgContext } from "@/lib/org-context";
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  TrendingDown,
  Filter,
  X,
  AlertCircle,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────── */

type ExpenseCategory =
  | "garbage"
  | "security"
  | "insurance"
  | "caretaker"
  | "water"
  | "electricity"
  | "internet"
  | "maintenance"
  | "land_rates"
  | "agent_fee"
  | "other";

type ExpenseFrequency = "monthly" | "quarterly" | "annual" | "one_off";

interface Expense {
  id: string;
  orgId: string;
  propertyId: string;
  unitId?: string | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  frequency: ExpenseFrequency;
  month: string; // YYYY-MM
  createdAt?: any;
}

interface Property {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
}

/* ─── Constants ──────────────────────────────────────── */

const CATEGORIES: { value: ExpenseCategory; label: string; emoji: string }[] = [
  { value: "garbage",     label: "Garbage Collection", emoji: "🗑️" },
  { value: "security",    label: "Security",           emoji: "🔒" },
  { value: "insurance",   label: "Insurance",          emoji: "🛡️" },
  { value: "caretaker",   label: "Caretaker",          emoji: "🧹" },
  { value: "water",       label: "Water",              emoji: "💧" },
  { value: "electricity", label: "Electricity",        emoji: "⚡" },
  { value: "internet",    label: "Internet",           emoji: "📡" },
  { value: "maintenance", label: "Maintenance",        emoji: "🔧" },
  { value: "land_rates",  label: "Land Rates",         emoji: "🏛️" },
  { value: "agent_fee",   label: "Agent Fee",          emoji: "🤝" },
  { value: "other",       label: "Other",              emoji: "📋" },
];

const FREQUENCIES: { value: ExpenseFrequency; label: string }[] = [
  { value: "monthly",   label: "Monthly"   },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual",    label: "Annual"    },
  { value: "one_off",   label: "One-off"   },
];

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });
}

function categoryLabel(c: ExpenseCategory) {
  return CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

function categoryEmoji(c: ExpenseCategory) {
  return CATEGORIES.find((x) => x.value === c)?.emoji ?? "📋";
}

/* ─── Page ───────────────────────────────────────────── */

export default function AdminExpensesPage() {
  const { orgId } = useOrgContext();

  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units,      setUnits]      = useState<Unit[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Filters
  const [filterMonth,    setFilterMonth]    = useState(getCurrentMonth());
  const [filterProperty, setFilterProperty] = useState("");

  // Modal
  const [showForm,     setShowForm]     = useState(false);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState({
    propertyId:  "",
    unitId:      "",
    category:    "garbage" as ExpenseCategory,
    description: "",
    amount:      "",
    frequency:   "monthly" as ExpenseFrequency,
    month:       getCurrentMonth(),
  });

  /* ── Fetch ── */
  useEffect(() => {
  if (!orgId) return;
  const fetchAll = async () => {
    try {
      const orgFilter = where("orgId", "==", orgId);

      // ← Split into separate try/catches so a failing expenses query
      //   doesn't also wipe out properties and units
      const [propSnap, unitSnap] = await Promise.all([
        getDocs(query(collection(db, "properties"), orgFilter)),
        getDocs(query(collection(db, "units"),      orgFilter)),
      ]);
      setProperties(propSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Property)));
      setUnits(unitSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Unit)));

      // Fetch expenses separately — orderBy("createdAt") needs a composite
      // index in Firestore. If it fails, properties still load fine.
      try {
        const expSnap = await getDocs(
          query(collection(db, "expenses"), orgFilter, orderBy("createdAt", "desc"))
        );
        setExpenses(expSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense)));
      } catch (expErr: any) {
        console.error("Expenses query failed (check Firestore composite index):", expErr?.message);
        // Fall back — fetch without ordering so the modal still works
        const expSnap = await getDocs(query(collection(db, "expenses"), orgFilter));
        setExpenses(expSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense)));
      }

    } catch (err) {
      console.error("Properties/units load error:", err);
    } finally {
      setLoading(false);
    }
  };
  fetchAll();
}, [orgId]);

  /* ── Save (add / edit) ── */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.propertyId || !form.amount) return;
    setSaving(true);
    try {
      const payload = {
        orgId,
        propertyId:  form.propertyId,
        unitId:      form.unitId || null,
        category:    form.category,
        description: form.description.trim(),
        amount:      parseFloat(form.amount),
        frequency:   form.frequency,
        month:       form.month,
      };

      if (editingId) {
        await updateDoc(doc(db, "expenses", editingId), payload);
        setExpenses((prev) =>
          prev.map((e) => (e.id === editingId ? { ...e, ...payload } : e))
        );
      } else {
        const ref = await addDoc(collection(db, "expenses"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setExpenses((prev) => [{ id: ref.id, ...payload } as Expense, ...prev]);
      }
      closeForm();
    } catch (err) {
      console.error(err);
      alert("Failed to save expense.");
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "expenses", id));
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete expense.");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const openEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setForm({
      propertyId:  expense.propertyId,
      unitId:      expense.unitId || "",
      category:    expense.category,
      description: expense.description,
      amount:      String(expense.amount),
      frequency:   expense.frequency,
      month:       expense.month,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({
      propertyId: "", unitId: "", category: "garbage",
      description: "", amount: "", frequency: "monthly",
      month: getCurrentMonth(),
    });
  };

  /* ── Derived ── */
  const filtered = expenses.filter((e) => {
    const monthMatch    = !filterMonth    || e.month === filterMonth;
    const propertyMatch = !filterProperty || e.propertyId === filterProperty;
    return monthMatch && propertyMatch;
  });

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);

  // Group by property for the summary
  const byProperty = properties.map((p) => {
    const pExpenses = filtered.filter((e) => e.propertyId === p.id);
    return { property: p, total: pExpenses.reduce((s, e) => s + e.amount, 0), count: pExpenses.length };
  }).filter((x) => x.count > 0);

  const availableUnits = units.filter((u) => u.propertyId === form.propertyId);

  const propertyName = (id: string) => properties.find((p) => p.id === id)?.name ?? "-";
  const unitNumber   = (id?: string | null) => id ? (units.find((u) => u.id === id)?.unitNumber ?? "") : "";

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
            <p className="mt-1 text-sm text-gray-500">
              Track property running costs — security, garbage, insurance, and more
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Add Expense
          </button>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm text-gray-700"
          />
          <select
            value={filterProperty}
            onChange={(e) => setFilterProperty(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm text-gray-700"
          >
            <option value="">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {(filterMonth || filterProperty) && (
            <button
              onClick={() => { setFilterMonth(""); setFilterProperty(""); }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {/* Summary cards */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-white p-5 shadow-sm col-span-1 sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600 mt-1">KES {totalFiltered.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-0.5">{filtered.length} entries{filterMonth ? ` · ${formatMonth(filterMonth)}` : ""}</p>
            </div>
            {byProperty.slice(0, 3).map(({ property, total, count }) => (
              <div key={property.id} className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{property.name}</p>
                <p className="text-xl font-bold text-gray-800 mt-1">KES {total.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">{count} expense{count !== 1 ? "s" : ""}</p>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-x-auto">
          {loading ? (
            <div className="p-16 flex justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <TrendingDown className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No expenses found. Add your first expense above.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-6 py-3 font-medium text-gray-600">Category</th>
                  <th className="px-6 py-3 font-medium text-gray-600">Property / Unit</th>
                  <th className="px-6 py-3 font-medium text-gray-600">Description</th>
                  <th className="px-6 py-3 font-medium text-gray-600">Frequency</th>
                  <th className="px-6 py-3 font-medium text-gray-600">Month</th>
                  <th className="px-6 py-3 font-medium text-gray-600">Amount (KES)</th>
                  <th className="px-6 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((expense) => (
                  <tr key={expense.id} className="border-t hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2">
                        <span className="text-lg">{categoryEmoji(expense.category)}</span>
                        <span className="font-medium text-gray-800">{categoryLabel(expense.category)}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      <p className="font-medium">{propertyName(expense.propertyId)}</p>
                      {expense.unitId && (
                        <p className="text-xs text-gray-400">Unit {unitNumber(expense.unitId)}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate">
                      {expense.description || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize text-gray-600">{expense.frequency.replace("_", "-")}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatMonth(expense.month)}</td>
                    <td className="px-6 py-4 font-semibold text-red-600">
                      {expense.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEdit(expense)}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(expense.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50">
                  <td colSpan={5} className="px-6 py-3 text-sm font-semibold text-gray-700">Total</td>
                  <td className="px-6 py-3 font-bold text-red-600">
                    KES {totalFiltered.toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingId ? "Edit Expense" : "Add Expense"}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Property */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property *</label>
                <select
                  required
                  value={form.propertyId}
                  onChange={(e) => setForm({ ...form, propertyId: e.target.value, unitId: "" })}
                  className="w-full border rounded-lg px-4 py-3 text-sm"
                >
                  <option value="">Select property</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Unit (optional) */}
              {availableUnits.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit <span className="text-gray-400 font-normal">(optional — leave blank for whole property)</span>
                  </label>
                  <select
                    value={form.unitId}
                    onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                    className="w-full border rounded-lg px-4 py-3 text-sm"
                  >
                    <option value="">Whole property</option>
                    {availableUnits.map((u) => (
                      <option key={u.id} value={u.id}>Unit {u.unitNumber}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setForm({ ...form, category: cat.value })}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition ${
                        form.category === cat.value
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300"
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span className="truncate">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly guard payment to SecureGuard Ltd"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border rounded-lg px-4 py-3 text-sm"
                />
              </div>

              {/* Amount + Frequency row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES) *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="e.g. 5000"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full border rounded-lg px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency *</label>
                  <select
                    value={form.frequency}
                    onChange={(e) => setForm({ ...form, frequency: e.target.value as ExpenseFrequency })}
                    className="w-full border rounded-lg px-4 py-3 text-sm"
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Month */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month *</label>
                <input
                  required
                  type="month"
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: e.target.value })}
                  className="w-full border rounded-lg px-4 py-3 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="border px-5 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? "Save Changes" : "Add Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-8 space-y-4 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h3 className="text-lg font-bold text-gray-900">Delete Expense?</h3>
            <p className="text-sm text-gray-500">This cannot be undone.</p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="border px-5 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="bg-red-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
