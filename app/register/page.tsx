"use client";

/**
 * app/signup/page.tsx  (NEW)
 *
 * Company self-signup page. Creates:
 *  1. Firebase Auth user
 *  2. orgs/{orgId} document
 *  3. users/{uid} document with role: "admin" and orgId
 *
 * After signup → redirects to /signup/pending (billing gate placeholder)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  AuthError,
} from "firebase/auth";
import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Building2, ArrowRight, Loader2, CheckCircle } from "lucide-react";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "KES 1,500",
    period: "/mo billed yearly",
    units: "Up to 20 units",
    features: ["1 property", "Tenant portal", "Maintenance tracking"],
    highlight: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: "KES 3,500",
    period: "/mo billed yearly",
    units: "Up to 100 units",
    features: ["Up to 10 properties", "Tenant portal", "Maintenance tracking", "Reports"],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "KES 7,000",
    period: "/mo billed yearly",
    units: "Unlimited units",
    features: ["Unlimited properties", "Tenant portal", "Maintenance tracking", "Reports", "Priority support"],
    highlight: false,
  },
] as const;

type PlanId = typeof PLANS[number]["id"];

export default function CompanySignupPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("growth");

  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handlePlanNext = () => {
    setStep(2);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!formData.companyName.trim()) {
      setError("Company name is required.");
      return;
    }

    setLoading(true);

    try {
      // 1. Create Firebase Auth user
      const cred = await createUserWithEmailAndPassword(
        auth,
        formData.email.trim(),
        formData.password
      );
      const uid = cred.user.uid;

      await updateProfile(cred.user, {
        displayName: formData.companyName.trim(),
      });

      // 2. Create org document
      const orgRef = await addDoc(collection(db, "orgs"), {
        name: formData.companyName.trim(),
        adminEmail: formData.email.trim(),
        adminUid: uid,
        plan: selectedPlan,
        status: "trial",            // starts as trial; flip to "active" after payment
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        createdAt: serverTimestamp(),
      });

      // 3. Create user record with role + orgId
      await setDoc(doc(db, "users", uid), {
        role: "admin",
        orgId: orgRef.id,
        email: formData.email.trim(),
        createdAt: serverTimestamp(),
      });

      router.replace("/register/pending");
    } catch (err) {
      const authError = err as AuthError;
      if (authError.code === "auth/email-already-in-use") {
        setError("An account with this email already exists.");
      } else if (authError.code === "auth/weak-password") {
        setError("Password is too weak.");
      } else {
        setError("Signup failed. Please try again.");
      }
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Building2 className="h-5 w-5 text-indigo-400" />
          Tunza Property KE
        </Link>
        <Link href="/login" className="text-sm text-white/60 hover:text-white transition">
          Already have an account? Sign in
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-12 justify-center">
          <StepDot active={step === 1} done={step === 2} label="Choose plan" num={1} />
          <div className="h-px w-16 bg-white/20" />
          <StepDot active={step === 2} done={false} label="Create account" num={2} />
        </div>

        {/* STEP 1 — Plan selection */}
        {step === 1 && (
          <div>
            <h1 className="text-4xl font-bold text-center mb-3">
              Start managing smarter
            </h1>
            <p className="text-center text-white/50 mb-12">
              Choose a plan. No credit card required for your 14-day trial.
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative text-left rounded-2xl border p-6 transition-all ${
                    selectedPlan === plan.id
                      ? "border-indigo-500 bg-indigo-950/60 shadow-lg shadow-indigo-500/20"
                      : "border-white/10 bg-white/5 hover:border-white/30"
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </span>
                  )}

                  {selectedPlan === plan.id && (
                    <CheckCircle className="absolute top-4 right-4 h-5 w-5 text-indigo-400" />
                  )}

                  <p className="text-lg font-bold mb-1">{plan.name}</p>
                  <p className="text-sm text-white/50 mb-4">{plan.units}</p>
                  <p className="text-3xl font-bold mb-1">
                    {plan.price}
                    <span className="text-sm font-normal text-white/40 ml-1">
                      {plan.period}
                    </span>
                  </p>

                  <ul className="mt-5 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                        <CheckCircle className="h-4 w-4 text-indigo-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            <div className="flex justify-center mt-10">
              <button
                onClick={handlePlanNext}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition px-8 py-4 rounded-xl font-semibold text-lg"
              >
                Continue with {PLANS.find((p) => p.id === selectedPlan)?.name}
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — Account creation */}
        {step === 2 && (
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setStep(1)}
              className="text-white/40 hover:text-white text-sm mb-8 transition"
            >
              ← Back to plan selection
            </button>

            <h2 className="text-3xl font-bold mb-2">Create your account</h2>
            <p className="text-white/50 mb-8">
              Plan:{" "}
              <span className="text-indigo-400 font-semibold">
                {PLANS.find((p) => p.id === selectedPlan)?.name}
              </span>{" "}
              — 14-day free trial
            </p>

            {error && (
              <div className="mb-6 rounded-xl bg-red-900/40 border border-red-700/50 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
              <Field
                label="Company / Organisation name"
                type="text"
                value={formData.companyName}
                onChange={(v) => updateField("companyName", v)}
                placeholder="Sunrise Properties Ltd"
              />
              <Field
                label="Work email"
                type="email"
                value={formData.email}
                onChange={(v) => updateField("email", v)}
                placeholder="you@company.com"
              />
              <Field
                label="Password"
                type="password"
                value={formData.password}
                onChange={(v) => updateField("password", v)}
                placeholder="Min. 8 characters"
              />
              <Field
                label="Confirm password"
                type="password"
                value={formData.confirmPassword}
                onChange={(v) => updateField("confirmPassword", v)}
                placeholder="Repeat password"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-60 py-4 rounded-xl font-semibold text-base mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  <>
                    Start free trial
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-white/30">
              By signing up, you agree to our Terms of Service and Privacy Policy.
              <br />
              Your 14-day trial starts today — no credit card required.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

/* ── Small reusable components ── */

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/60 mb-1.5">{label}</label>
      <input
        required
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-3 text-white placeholder-white/20 transition"
      />
    </div>
  );
}

function StepDot({
  active,
  done,
  label,
  num,
}: {
  active: boolean;
  done: boolean;
  label: string;
  num: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition ${
          done
            ? "bg-indigo-600 text-white"
            : active
            ? "bg-indigo-600 text-white"
            : "bg-white/10 text-white/30"
        }`}
      >
        {done ? "✓" : num}
      </div>
      <span
        className={`text-sm ${active || done ? "text-white" : "text-white/30"}`}
      >
        {label}
      </span>
    </div>
  );
}
