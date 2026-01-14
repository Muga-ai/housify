"use client";
import Link from "next/link";
import { useCounter } from "@/hooks/useCounter";
import {
  Building2,
  Users,
  Wrench,
  BarChart3,
  ArrowRight,
} from "lucide-react";

export default function Home() {
  //  Set target numbers
const propertiesTarget = 12;
const tenantsTarget = 148;
const rentTarget = 92; // percentage
const requestsTarget = 5;

// Animate the numbers using my custom hook
const propertiesCount = useCounter(propertiesTarget, 50);
const tenantsCount = useCounter(tenantsTarget, 50);
const rentCount = useCounter(rentTarget, 50);
const requestsCount = useCounter(requestsTarget, 50);

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* NAVBAR */}
      <header className="border-b">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Building2 className="h-6 w-6 text-indigo-600" />
            Housify KE
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
          >
            Login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-7xl px-6 py-24 grid gap-12 md:grid-cols-2 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Smart Property Management <br />
            <span className="text-indigo-600">for Modern Cities</span>
          </h1>

          <p className="mt-6 text-lg text-gray-600 max-w-xl">
            Housify KE helps landlords and property managers track tenants, rent
            payments, and maintenance — all in one simple dashboard.
          </p>

          <div className="mt-8 flex gap-4">
            <Link
              href="/login"
              className="rounded-md bg-indigo-600 px-6 py-3 text-white font-medium hover:bg-indigo-700 transition"
            >
              Get Started
            </Link>

            <a
              href="#features"
              className="rounded-md border px-6 py-3 font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Learn More
            </a>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-xl border bg-gray-50 p-8 shadow-sm">
            <div className="grid grid-cols-2 gap-6">
              <StatCard
  icon={<Building2 className="h-6 w-6 text-indigo-600" />}
  title="Properties"
  value={propertiesCount.toString()}
/>
<StatCard
  icon={<Users className="h-6 w-6 text-indigo-600" />}
  title="Tenants"
  value={tenantsCount.toString()}
/>
<StatCard
  icon={<BarChart3 className="h-6 w-6 text-indigo-600" />}
  title="Rent Paid"
  value={`${rentCount}%`}
/>
<StatCard
  icon={<Wrench className="h-6 w-6 text-indigo-600" />}
  title="Requests"
  value={`${requestsCount} Open`}
/>

            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-bold text-center">
            Everything You Need to Manage Real Estate
          </h2>

          <p className="mt-4 text-center text-gray-600 max-w-2xl mx-auto">
            Built for Kenyan landlords, agents, and county housing
            oversight.
          </p>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <FeatureCard
              icon={<Building2 className="h-6 w-6 text-indigo-600" />}
              title="Property & Units"
              description="Manage properties and units with clear tenant assignments and rent values."
            />

            <FeatureCard
              icon={<Users className="h-6 w-6 text-indigo-600" />}
              title="Tenant Management"
              description="Tenants see rent due dates and submit maintenance requests digitally."
            />

            <FeatureCard
              icon={<Wrench className="h-6 w-6 text-indigo-600" />}
              title="Maintenance Tracking"
              description="Track issues from submission to resolution without phone calls."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold">
            Ready to modernize your property management?
          </h2>

          <p className="mt-4 text-gray-600">
            Join early users shaping the future of Real Estate management in Kenya.
          </p>

          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-8 py-4 text-white font-medium hover:bg-indigo-700 transition"
          >
            Launch Dashboard
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t py-6">
        <div className="mx-auto max-w-7xl px-6 text-sm text-gray-500 flex justify-between">
          <span>© {new Date().getFullYear()} Housify KE</span>
          <span>Smart Property Management</span>
        </div>
      </footer>
    </main>
  );
}

/* ---------- Components ---------- */

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm hover:shadow transition">
      <div className="mb-4">{icon}</div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="mt-2 text-gray-600 text-sm">{description}</p>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-white p-4 border">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-gray-600">{title}</span>
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
