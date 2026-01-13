"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Property {
  id: string;
  name: string;
  location: string;
}

interface Unit {
  id: string;
  propertyId: string;
}

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    location: "",
  });

  // 🔹 Fetch properties + units
  useEffect(() => {
    const fetchData = async () => {
      try {
        const propertySnap = await getDocs(collection(db, "properties"));
        const unitSnap = await getDocs(collection(db, "units"));

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
        console.error("Failed to load properties", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 🔹 Create or Update property
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingProperty) {
        const ref = doc(db, "properties", editingProperty.id);
        await updateDoc(ref, {
          name: formData.name.trim(),
          location: formData.location.trim(),
        });

        setProperties((prev) =>
          prev.map((p) =>
            p.id === editingProperty.id
              ? { ...p, ...formData }
              : p
          )
        );
      } else {
        const ref = await addDoc(collection(db, "properties"), {
          name: formData.name.trim(),
          location: formData.location.trim(),
          createdAt: new Date(),
        });

        setProperties((prev) => [
          ...prev,
          { id: ref.id, ...formData },
        ]);
      }

      setFormData({ name: "", location: "" });
      setEditingProperty(null);
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save property");
    }
  };

  // 🔹 Delete property (only if no units)
  const deleteProperty = async (propertyId: string) => {
    const propertyUnits = units.filter(
      (u) => u.propertyId === propertyId
    );

    if (propertyUnits.length > 0) {
      alert("Cannot delete property with existing units.");
      return;
    }

    if (!confirm("Delete this property?")) return;

    try {
      await deleteDoc(doc(db, "properties", propertyId));
      setProperties((prev) => prev.filter((p) => p.id !== propertyId));
    } catch (err) {
      console.error(err);
      alert("Failed to delete property");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Properties</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white text-sm font-medium hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Add Property
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
                  <th className="px-6 py-3 text-left">#</th>
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Location</th>
                  <th className="px-6 py-3 text-left">Units</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-500">
                      No properties added yet.
                    </td>
                  </tr>
                ) : (
                  properties.map((property, index) => {
                    const unitCount = units.filter(
                      (u) => u.propertyId === property.id
                    ).length;

                    return (
                      <tr key={property.id} className="border-t hover:bg-gray-50">
                        <td className="px-6 py-3">{index + 1}</td>
                        <td className="px-6 py-3 font-medium">
                          {property.name}
                        </td>
                        <td className="px-6 py-3">{property.location}</td>
                        <td className="px-6 py-3">{unitCount}</td>
                        <td className="px-6 py-3 flex gap-3">
                          <button
                            onClick={() => {
                              setEditingProperty(property);
                              setFormData({
                                name: property.name,
                                location: property.location,
                              });
                              setShowForm(true);
                            }}
                            className="text-indigo-600 hover:underline"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteProperty(property.id)}
                            className="text-red-600 hover:underline"
                          >
                            <Trash2 className="h-4 w-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl p-8 space-y-6">
            <h2 className="text-xl font-bold">
              {editingProperty ? "Edit Property" : "Add Property"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                required
                placeholder="Property Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full rounded-lg border px-4 py-3"
              />

              <input
                required
                placeholder="Location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className="w-full rounded-lg border px-4 py-3"
              />

              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingProperty(null);
                  }}
                  className="px-6 py-3 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
