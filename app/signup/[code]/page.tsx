"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { verifyInvite, markInviteUsed, InviteData } from "@/lib/invite";
import { doc, updateDoc } from "firebase/firestore";
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

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        invite.email,
        password
      );

      const uid = userCredential.user.uid;

      const tenantRef = doc(db, "tenants", invite.tenantId);

      await updateDoc(tenantRef, {
        name,
        status: "active",
        uid,
        updatedAt: new Date(),
      });

      await markInviteUsed(code);

      setSuccess("Account created successfully! Redirecting...");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: any) {
      setError(err.message || "Signup failed.");
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

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600">
        {error}
      </div>
    );
  }

  return (
    <main className="p-8 max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Complete Your Signup</h1>

      {success && <div className="text-green-600">{success}</div>}

      {!success && invite && (
        <>
          <p className="text-sm text-gray-700">
            Invite Email: {invite.email}
          </p>

          <input
            placeholder="Full Name"
            className="w-full border px-4 py-3 rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            placeholder="Password"
            type="password"
            className="w-full border px-4 py-3 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-indigo-600 text-white px-6 py-3 rounded hover:bg-indigo-700"
          >
            {loading ? "Signing Up..." : "Complete Signup"}
          </button>
        </>
      )}
    </main>
  );
}
