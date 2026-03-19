"use client";

import { useState } from "react";
import { addDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createTenantInvite } from "@/lib/invite";
import { useOrgContext } from "@/lib/org-context"; // ← FIXED: was `import useOrgContext from "../../layout"`
import { ClipboardCopy, Loader2 } from "lucide-react";

export default function AdminTenantInvitePage() {
  const { orgId } = useOrgContext();

  const [email,      setEmail]      = useState("");
  const [name,       setName]       = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  const handleCreateInvite = async () => {
    setError("");

    if (!email || !name) {
      setError("Name and Email are required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Invalid email address");
      return;
    }

    setLoading(true);

    try {
      // Check for duplicate within THIS org only
      const q = query(
        collection(db, "tenants"),
        where("email", "==", email),
        where("orgId", "==", orgId)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        setError("A tenant with this email already exists in your organisation.");
        setLoading(false);
        return;
      }

      // Create tenant record (pending, no unit yet)
      const tenantRef = await addDoc(collection(db, "tenants"), {
        name:       name.trim(),
        email:      email.trim(),
        propertyId: null,
        unitId:     null,
        status:     "pending",
        orgId,
        createdAt:  serverTimestamp(),
      });

      // Create invite token
      const code = await createTenantInvite(tenantRef.id, email, orgId);
      setInviteLink(`${window.location.origin}/signup/${code}`);

    } catch {
      setError("Failed to create invite.");
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

      <p className="text-sm text-gray-600">
        An invite link will be generated. Share it with your tenant so they can
        create their own login and access their unit dashboard.
      </p>

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
        className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white px-6 py-3 rounded hover:bg-indigo-700 disabled:opacity-70"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Create Invite Link
      </button>

      {inviteLink && (
        <div className="bg-green-50 border border-green-200 p-4 rounded space-y-2">
          <p className="font-medium text-green-800">Invite Link Ready</p>
          <p className="text-xs text-green-700">This link expires in 7 days.</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm break-all text-gray-700">{inviteLink}</p>
            <button
              onClick={handleCopyLink}
              className="border px-3 py-1 rounded hover:bg-green-100 flex items-center gap-1 text-green-700 shrink-0"
            >
              <ClipboardCopy className="h-4 w-4" /> Copy
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
