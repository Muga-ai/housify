"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { verifyInvite, markInviteUsed, InviteData } from "@/lib/invite";
import { doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore"; // ← ADDED setDoc, serverTimestamp
import { db, auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { Loader2 } from "lucide-react";

export default function TenantSignupPage() {
  const router = useRouter();
  const params = useParams();
  const code = params?.code as string;

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const checkInvite = async () => {
      if (!code) {
        setError("Invalid invite link.");
        setLoading(false);
        return;
      }

      try {
        const data = await verifyInvite(code);
        if (!data) {
          setError("Invalid or expired invite link.");
        } else {
          setInvite(data);
        }
      } catch {
        setError("Failed to verify invite.");
      } finally {
        setLoading(false);
      }
    };

    checkInvite();
  }, [code]);

  const handleSignup = async () => {
    setError("");

    if (!name || !password) {
      setError("Name and password are required.");
      return;
    }

    if (!invite) {
      setError("Invite not found.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      // Step 1 — Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        invite.email,
        password
      );
      const uid = userCredential.user.uid;

      // Step 2 — Create users/{uid} document so rules can read role + orgId
      // ← ADDED: this was completely missing, causing all post-login permission errors
      await setDoc(doc(db, "users", uid), {
        role: "tenant",
        orgId: invite.orgId,   // ← comes from the invite record
        email: invite.email,
        createdAt: serverTimestamp(),
      });

      // Step 3 — Stamp uid onto the tenants record and activate it
      await updateDoc(doc(db, "tenants", invite.tenantId), {
        name: name.trim(),
        status: "active",
        uid,
        updatedAt: serverTimestamp(), // ← CHANGED: was new Date()
      });

      // Step 4 — Mark invite as used so the link can't be reused
      await markInviteUsed(code);

      setSuccess("Account created successfully! Redirecting...");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: any) {
      // Surface Firebase auth errors clearly
      if (err.code === "auth/email-already-in-use") {
        setError("An account with this email already exists. Please log in instead.");
      } else if (err.code === "auth/weak-password") {
        setError("Password must be at least 6 characters.");
      } else {
        setError(err.message || "Signup failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600 text-center px-6">
        {error}
      </div>
    );
  }

  return (
    <main className="p-8 max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Complete Your Signup</h1>

      {success && (
        <div className="text-green-600 bg-green-50 border border-green-200 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {error && (
        <div className="text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {!success && invite && (
        <>
          <p className="text-sm text-gray-700">
            Signing up as: <span className="font-medium">{invite.email}</span>
          </p>

          <input
            placeholder="Full Name"
            className="w-full border px-4 py-3 rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            placeholder="Password (min. 6 characters)"
            type="password"
            className="w-full border px-4 py-3 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-indigo-600 text-white px-6 py-3 rounded hover:bg-indigo-700 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Creating account..." : "Complete Signup"}
          </button>

          <p className="text-xs text-center text-gray-500">
            Already have an account?{" "}
            <a href="/login" className="text-indigo-600 hover:underline">
              Log in
            </a>
          </p>
        </>
      )}
    </main>
  );
}
