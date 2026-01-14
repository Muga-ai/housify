"use client";

import { useState } from "react";
import { addDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createTenantInvite } from "@/lib/invite";
import { ClipboardCopy, Loader2 } from "lucide-react";

export default function AdminTenantInvitePage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreateInvite = async () => {
    setError("");
    if (!email || !name) {
      setError("Name and Email are required");
      return;
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Invalid email address");
      return;
    }

    setLoading(true);

    try {
      // 1️⃣ Check if tenant with email already exists
      const q = query(collection(db, "tenants"), where("email", "==", email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setError("A tenant with this email already exists");
        setLoading(false);
        return;
      }

      // 2️⃣ Create tenant record (pending)
      const tenantRef = await addDoc(collection(db, "tenants"), {
        name: name.trim(),
        email: email.trim(),
        propertyId: null,
        unitId: null,
        status: "pending",
        createdAt: new Date(),
      });

      // 3️⃣ Create invite code
      const code = await createTenantInvite(tenantRef.id, email);

      // 4️⃣ Generate invite link
      setInviteLink(`${window.location.origin}/signup/${code}`);
    } catch (err) {
      console.error(err);
      setError("Failed to create invite. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) navigator.clipboard.writeText(inviteLink);
  };

  return (
    <main className="p-8 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Invite Tenant</h1>

      {error && (
        <div className="text-red-600 border border-red-200 bg-red-50 px-4 py-2 rounded">
          {error}
        </div>
      )}

      <input
        placeholder="Tenant Name"
        className="w-full border px-4 py-3 rounded"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        placeholder="Tenant Email"
        type="email"
        className="w-full border px-4 py-3 rounded"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <button
        onClick={handleCreateInvite}
        disabled={loading}
        className={`flex items-center justify-center gap-2 w-full bg-indigo-600 text-white px-6 py-3 rounded hover:bg-indigo-700 ${
          loading ? "opacity-70 cursor-not-allowed" : ""
        }`}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Create Invite
      </button>

      {inviteLink && (
        <div className="bg-green-50 border border-green-200 p-4 rounded space-y-2">
          <p className="font-medium">Invite Link</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm break-all">{inviteLink}</p>
            <button
              onClick={handleCopyLink}
              className="border px-3 py-1 rounded hover:bg-green-100 flex items-center gap-1 text-green-700"
            >
              <ClipboardCopy className="h-4 w-4" /> Copy
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
