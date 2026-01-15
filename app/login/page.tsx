"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, AuthError } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Building2, Loader2, ArrowRight } from "lucide-react";

type UserRole = "admin" | "tenant";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1️⃣ Sign in with Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // 2️⃣ Fetch role from Firestore
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) {
        throw new Error("Account not configured. Contact support.");
      }

      const data = snap.data();
      const role = data?.role as UserRole | undefined;
      if (!role) throw new Error("Invalid account role.");

      // 3️⃣ Redirect based on role
      switch (role) {
        case "admin":
          router.replace("/admin/dashboard");
          break;
        case "tenant":
          router.replace("/tenant/dashboard");
          break;
      }
    } catch (err) {
      console.error(err);

      // Type-safe error handling
      if (err instanceof Error) {
        // Firebase Auth errors may have 'code'
        const authError = err as AuthError;
        if (authError.code === "auth/invalid-credential") {
          setError("Invalid email or password.");
        } else if (authError.code === "auth/user-not-found") {
          setError("Account not found.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-2 text-xl font-bold">
            <Building2 className="h-6 w-6 text-indigo-600" />
            Housify KE
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your dashboard
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 transition disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
