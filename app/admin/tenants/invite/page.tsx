"use client";

import { useState } from "react";
import {
  addDoc, collection, query, where, getDocs, serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createTenantInvite } from "@/lib/invite";
import { useOrgContext } from "@/lib/org-context";
import {
  ClipboardCopy, Loader2, CheckCircle, MessageCircle
} from "lucide-react";

export default function AdminTenantInvitePage() {
  const { orgId } = useOrgContext();

  const [email,      setEmail]      = useState("");
  const [name,       setName]       = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [copied,     setCopied]     = useState(false);
  const [toast,      setToast]      = useState<string | null>(null);

  /* ── TOAST ── */
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  /* ── CREATE INVITE ── */
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

      const tenantRef = await addDoc(collection(db, "tenants"), {
        name:       name.trim(),
        email:      email.trim(),
        propertyId: null,
        unitId:     null,
        status:     "pending",
        orgId,
        createdAt:  serverTimestamp(),
      });

      const code = await createTenantInvite(tenantRef.id, email, orgId);

      setInviteLink(`${window.location.origin}/signup/${code}`);
      setCopied(false);

    } catch {
      setError("Failed to create invite.");
    } finally {
      setLoading(false);
    }
  };

  /* ── COPY ── */
  const handleCopyLink = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      showToast("Link copied. Share with your tenant");

      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt("Copy this link:", inviteLink);
    }
  };

  /* ── WHATSAPP ── */
  const handleWhatsAppShare = () => {
    if (!inviteLink) return;

    const message = encodeURIComponent(
      `Hi${name ? ` ${name}` : ""},\n\n` +
      `You’ve been invited to join Housify.\n\n` +
      `Create your account here:\n${inviteLink}`
    );

    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  /* ── UI ── */
  return (
    <main className="p-8 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Invite Tenant</h1>

      <p className="text-sm text-gray-600">
        Generate an invite link and share it with your tenant via WhatsApp or copy link.
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
        <div className="bg-green-50 border border-green-200 p-4 rounded space-y-3">
          <p className="font-medium text-green-800 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Invite Link Ready
          </p>

          <p className="text-xs text-green-700">
            This link expires in 7 days.
          </p>

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm break-all text-gray-700">{inviteLink}</p>

            <button
              onClick={handleCopyLink}
              className={`border px-3 py-1 rounded flex items-center gap-1 shrink-0 transition ${
                copied
                  ? "bg-green-600 text-white border-green-600"
                  : "hover:bg-green-100 text-green-700"
              }`}
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-4 w-4" /> Copy
                </>
              )}
            </button>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleWhatsAppShare}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm font-medium"
            >
              <MessageCircle className="h-4 w-4" />
              Share via WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-black text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}