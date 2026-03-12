"use client";

/**
 * app/signup/pending/page.tsx  (NEW)
 *
 * Shown right after company signup.
 * Currently routes straight to dashboard (trial mode).
 * Later: swap the CTA to a Pesapal payment link.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, CheckCircle, ArrowRight } from "lucide-react";

export default function SignupPendingPage() {
  const router = useRouter();

  // Auto-redirect to dashboard after 4 seconds
  useEffect(() => {
    const t = setTimeout(() => router.replace("/admin/dashboard"), 4000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-8">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-indigo-600/20 border border-indigo-500/40 mx-auto">
          <CheckCircle className="h-10 w-10 text-indigo-400" />
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-3">You are all set!</h1>
          <p className="text-white/50 leading-relaxed">
            Your 14-day free trial has started. Explore the dashboard, add your
            properties, and invite your tenants — no limits during your trial.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left space-y-3">
          <p className="text-sm font-semibold text-white/70 uppercase tracking-wide">
            What is next
          </p>
          <Step num={1} text="Add your first property" />
          <Step num={2} text="Create units and assign rent amounts" />
          <Step num={3} text="Invite tenants via email" />
          <Step num={4} text="Track maintenance requests" />
        </div>

        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition px-8 py-4 rounded-xl font-semibold"
        >
          Go to Dashboard
          <ArrowRight className="h-5 w-5" />
        </Link>

        <p className="text-xs text-white/20">
          Redirecting automatically in a few seconds…
        </p>
      </div>
    </main>
  );
}

function Step({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-6 w-6 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
        {num}
      </div>
      <p className="text-sm text-white/70">{text}</p>
    </div>
  );
}
