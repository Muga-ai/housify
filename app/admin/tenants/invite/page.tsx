"use client";

import { useState } from "react";
import {
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createTenantInvite } from "@/lib/invite";
import { useOrgContext } from "@/lib/org-context";
import {
  ClipboardCopy,
  Loader2,
  CheckCircle,
  MessageCircle,
  Mail,
} from "lucide-react";

export default function AdminTenantInvitePage() {
  const { orgId } = useOrgContext();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
        setError(
          "A tenant with this email already exists in your organisation."
        );
        setLoading(false);
        return;
      }

      const tenantRef = await addDoc(collection(db, "tenants"), {
        name: name.trim(),
        email: email.trim(),
        propertyId: null,
        unitId: null,
        status: "pending",
        orgId,
        createdAt: serverTimestamp(),
      });

      const code = await createTenantInvite(
        tenantRef.id,
        email,
        orgId
      );

      setInviteLink(`${window.location.origin}/signup/${code}`);
      setCopied(false);
      showToast("Invite link created");

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

  /* ── EMAIL ── */
  const handleEmailShare = () => {
    if (!inviteLink) return;

    const subject = encodeURIComponent(
      "You're invited to join Housify"
    );

    const body = encodeURIComponent(
      `Hi${name ? ` ${name}` : ""},\n\n` +
        `You’ve been invited to join Housify.\n\n` +
        `Create your account here:\n${inviteLink}\n\n` +
        `If you didn’t expect this, you can ignore this message.\n\n` +
        `— Housify`
    );

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  /* ── RESET ── */
  const handleReset = () => {
    setName("");
    setEmail("");
    setInviteLink("");
    setCopied(false);
    setError("");
  };

  /* ── UI ── */
  return (
    <main className="p-8 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Invite Tenant</h1>

      <p className="text-sm text-gray-600">
        Create a secure invite link and share it via WhatsApp, email, or copy it manually.
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
        <div className="bg-green-50 border border-green-200 p-4 rounded space-y-4">
          <p className="font-medium text-green-800 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Invite Link Ready
          </p>

          <div className="text-xs text-green-800 space-y-1">
            <p><strong>Name:</strong> {name}</p>
            <p><strong>Email:</strong> {email}</p>
            <p><strong>Status:</strong> Pending</p>
            <p><strong>Expires:</strong> 7 days</p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm break-all text-gray-700">
              {inviteLink}
            </p>

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

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleWhatsAppShare}
              disabled={!inviteLink}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm font-medium disabled:opacity-50"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </button>

            <button
              onClick={handleEmailShare}
              disabled={!inviteLink}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-800 text-white px-4 py-2 rounded hover:bg-black text-sm font-medium disabled:opacity-50"
            >
              <Mail className="h-4 w-4" />
              Email
            </button>
          </div>

          <button
            onClick={handleReset}
            className="w-full text-sm text-gray-600 hover:text-black pt-2"
          >
            + Create another invite
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-black text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}