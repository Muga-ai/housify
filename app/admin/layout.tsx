"use client";

/**
 * app/admin/layout.tsx
 *
 * Updated: Added Expenses and Reports to the nav items.
 * Everything else identical to previous version.
 */

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useOrg, Org } from "@/lib/org";
import { OrgContext } from "@/lib/org-context";
import Link from "next/link";
import {
  Building2, Users, Home, LogOut, Wrench,
  Menu, X, Loader2, AlertTriangle, Receipt,
  TrendingDown, BarChart3,
} from "lucide-react";

const NAV_ITEMS = [
  { title: "Dashboard",   href: "/admin/dashboard",   icon: <Home        className="h-5 w-5" /> },
  { title: "Properties",  href: "/admin/properties",  icon: <Building2   className="h-5 w-5" /> },
  { title: "Units",       href: "/admin/units",       icon: <Building2   className="h-5 w-5" /> },
  { title: "Tenants",     href: "/admin/tenants",     icon: <Users       className="h-5 w-5" /> },
  { title: "Maintenance", href: "/admin/maintenance", icon: <Wrench      className="h-5 w-5" /> },
  { title: "Payments",    href: "/admin/payments",    icon: <Receipt     className="h-5 w-5" /> },
  { title: "Expenses",    href: "/admin/expenses",    icon: <TrendingDown className="h-5 w-5" /> },  // ← NEW
  { title: "Reports",     href: "/admin/reports",     icon: <BarChart3   className="h-5 w-5" /> },  // ← NEW
];

const PLAN_BADGE: Record<string, string> = {
  starter: "bg-gray-100 text-gray-600",
  growth:  "bg-indigo-100 text-indigo-700",
  pro:     "bg-amber-100 text-amber-700",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { orgId, org, loading, error } = useOrg();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) router.push("/login");
    });
    return unsubscribe;
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !orgId || !org) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 px-6">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Account issue</h2>
          <p className="text-gray-600">{error || "Could not load your organisation."}</p>
          <button
            onClick={handleLogout}
            className="rounded-md bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (org.status === "inactive") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 px-6">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold">Subscription inactive</h2>
          <p className="text-gray-600">
            Your Tunza Property KE subscription has expired. Please renew to continue.
          </p>
          <button onClick={handleLogout} className="text-sm text-gray-500 underline">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <OrgContext.Provider value={{ orgId, org }}>
      <div className="flex min-h-screen bg-gray-50 relative">

        {isOpen && (
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
          />
        )}

        <aside
          className={`
            fixed z-50 inset-y-0 left-0 w-64 bg-white border-r
            transform transition-transform duration-300
            ${isOpen ? "translate-x-0" : "-translate-x-full"}
            md:translate-x-0 md:static md:flex md:flex-col
          `}
        >
          <div className="px-6 py-6 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-lg">
                <Building2 className="h-5 w-5 text-indigo-600" />
                Tunza Property KE
              </div>
              <button className="md:hidden" onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-800 truncate">{org.name}</p>
              <span
                className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 capitalize ${
                  PLAN_BADGE[org.plan] ?? PLAN_BADGE.starter
                }`}
              >
                {org.plan}{org.status === "trial" ? " · Trial" : ""}
              </span>
            </div>
          </div>

          <nav className="mt-4 flex-1 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2 px-6 py-3 transition ${
                    active
                      ? "bg-indigo-50 text-indigo-600 font-medium border-r-2 border-indigo-600"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {item.icon}
                  {item.title}
                </Link>
              );
            })}
          </nav>

          <div className="px-6 py-4 border-t">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full text-gray-700 hover:text-red-600 transition"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col w-full">
          <header className="bg-white border-b px-4 py-3 flex justify-between items-center md:hidden">
            <button onClick={() => setIsOpen(true)}>
              <Menu />
            </button>
            <span className="font-bold">Tunza Property KE</span>
            <button onClick={handleLogout} className="text-red-600 text-sm">
              Logout
            </button>
          </header>

          <main className="flex-1 p-6 overflow-y-auto">{children}</main>
        </div>
      </div>
    </OrgContext.Provider>
  );
}
