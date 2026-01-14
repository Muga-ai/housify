"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useParams, useRouter } from "next/navigation";

export default function TenantSignupPage() {
  const { code } = useParams();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchInvite = async () => {
      const q = query(
        collection(db, "invites"),
        where("code", "==", code),
        where("used", "==", false)
      );

      const snap = await getDocs(q);
      if (snap.empty) {
        setError("Invalid or expired invite");
        return;
      }

      setInvite({ id: snap.docs[0].id, ...snap.docs[0].data() });
    };

    fetchInvite();
  }, [code]);

  const handleSignup = async () => {
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        invite.email,
        password
      );

      // 1️⃣ Activate tenant
      await updateDoc(doc(db, "tenants", invite.tenantId), {
        status: "active",
        authUid: cred.user.uid,
      });

      // 2️⃣ Mark invite used
      await updateDoc(doc(db, "invites", invite.id), {
        used: true,
      });

      router.push("/tenant");
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (error) {
    return <p className="p-8 text-red-600">{error}</p>;
  }

  if (!invite) {
    return <p className="p-8">Loading...</p>;
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md space-y-6 p-8 border rounded-xl">
        <h1 className="text-xl font-bold">Complete Signup</h1>
        <p className="text-sm text-gray-600">
          Account for {invite.email}
        </p>

        <input
          type="password"
          placeholder="Set Password"
          className="w-full border px-4 py-3 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleSignup}
          className="w-full bg-indigo-600 text-white py-3 rounded"
        >
          Create Account
        </button>
      </div>
    </main>
  );
}
