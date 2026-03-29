"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Home, Gift, Loader2, CheckCircle, AlertTriangle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

type Stage = "loading" | "form" | "submitting" | "done" | "invalid";

interface ReferrerInfo {
  tenantId: string;
  tenantName: string;
  orgId: string;
}

export default function JoinPageClient() {
  const searchParams = useSearchParams();
  const refCode = searchParams?.get("ref") ?? "";

  const [stage, setStage] = useState<Stage>("loading");
  const [referrer, setReferrer] = useState<ReferrerInfo | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const validate = async () => {
      if (!refCode) { setStage("invalid"); return; }
      try {
        const snap = await getDocs(
          query(collection(db, "tenants"), where("__name__", "==", refCode))
        );
        if (snap.empty) { setStage("invalid"); return; }

        const data = snap.docs[0].data();
        if (data.status !== "active") { setStage("invalid"); return; }

        setReferrer({
          tenantId: snap.docs[0].id,
          tenantName: data.name ?? "A tenant",
          orgId: data.orgId,
        });
        setStage("form");
      } catch {
        setStage("invalid");
      }
    };

    validate();
  }, [refCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referrer) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) { setError("Please enter your name."); return; }
    if (!trimmedEmail) { setError("Please enter your email."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address."); return;
    }

    const existing = await getDocs(
      query(
        collection(db, "referrals"),
        where("referredEmail", "==", trimmedEmail),
        where("orgId", "==", referrer.orgId)
      )
    );
    if (!existing.empty) {
      setError("This email has already submitted an interest for this property. The landlord will be in touch.");
      return;
    }

    setError("");
    setStage("submitting");

    try {
      await addDoc(collection(db, "referrals"), {
        referrerTenantId: referrer.tenantId,
        referredName: trimmedName,
        referredEmail: trimmedEmail,
        orgId: referrer.orgId,
        status: "submitted",
        commissionAmount: null,
        unitId: null,
        unitNumber: null,
        createdAt: serverTimestamp(),
      });

      setStage("done");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      setStage("form");
    }
  };

  // ---------------- UI ----------------

  if (stage === "loading") {
    return (
      <CenteredCard>
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
        <p className="text-sm text-gray-500 mt-3 text-center">Verifying referral link…</p>
      </CenteredCard>
    );
  }

  if (stage === "invalid") {
    return (
      <CenteredCard>
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900 text-center">Invalid referral link</h2>
        <p className="text-sm text-gray-500 text-center mt-2">
          This link may have expired or is incorrect. Ask the person who sent it to share it again.
        </p>
      </CenteredCard>
    );
  }

  if (stage === "done") {
    return (
      <CenteredCard>
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-green-100 p-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 text-center">Interest submitted!</h2>
        <p className="text-sm text-gray-500 text-center mt-2 leading-relaxed">
          Thanks, <span className="font-medium text-gray-700">{name}</span>.
          Your interest has been sent to the property manager.
        </p>
        <div className="mt-5 rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-4">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-indigo-800">What happens next?</p>
              <p className="text-sm text-indigo-600 mt-1 leading-relaxed">
                The landlord will review your interest. If there is a unit that suits you,
                they will send you a personal invite link to create your tenant account.
                Keep an eye on <span className="font-medium">{email.trim().toLowerCase()}</span>.
              </p>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center mt-5">
          You do not need to do anything else. You will not receive spam.
        </p>
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <div className="flex items-center justify-center gap-2 mb-6">
        <Home className="h-7 w-7 text-indigo-600" />
        <span className="text-xl font-bold text-gray-900">Tunzaprop</span>
      </div>

      <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 mb-6">
        <Gift className="h-5 w-5 text-indigo-600 shrink-0" />
        <p className="text-sm text-indigo-800 leading-relaxed">
          <span className="font-semibold">{referrer?.tenantName}</span> thinks you would be a great fit for a vacant unit in their building.
        </p>
      </div>

      <h1 className="text-xl font-bold text-gray-900 mb-1">Express your interest</h1>
      <p className="text-sm text-gray-500 mb-5 leading-relaxed">
        Leave your details below. The property manager will review your interest and reach out if there is a suitable unit for you. You will not be registered until the landlord personally invites you.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Wanjiru"
            className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        <button
          type="submit"
          disabled={stage === "submitting"}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition"
        >
          {stage === "submitting"
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
            : "Submit my interest"
          }
        </button>
      </form>

      <p className="mt-5 text-xs text-gray-400 text-center">
        Submitting this form does not create an account. The property manager will contact you directly if a unit is available.
      </p>
    </CenteredCard>
  );
}

// ---------------- CenteredCard ----------------
function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl border shadow-sm p-8">{children}</div>
    </div>
  );
}