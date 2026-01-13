"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { Building2, Users, Home, LogOut, Wrench } from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Auth guard (TS-safe)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(() => {
      if (!auth.currentUser) {
        router.push("/login");
      }
    });

    return unsubscribe;
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const navItems: NavItem[] = [
    { title: "Dashboard", href: "/admin/dashboard", icon: <Home className="h-5 w-5" /> },
    { title: "Properties", href: "/admin/properties", icon: <Building2 className="h-5 w-5" /> },
    { title: "Units", href: "/admin/units", icon: <Users className="h-5 w-5" /> },
    { title: "Maintenance", href: "/admin/maintenance", icon: <Wrench className="h-5 w-5" /> }, // ← NEW: Maintenance nav item
    { title: "Tenants", href: "/admin/tenants", icon: <Users /> }

  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r hidden md:flex flex-col">
        <div className="px-6 py-6 font-bold text-xl border-b">
          Housify KE
        </div>

        <nav className="mt-6 flex-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-6 py-3 ${
                  active ? "bg-gray-100 text-indigo-600 font-medium" : "text-gray-700"
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
            className="flex items-center gap-2 w-full text-gray-700 hover:text-red-600"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="md:hidden bg-white border-b px-4 py-3 flex justify-between">
          <span className="font-bold">Housify KE</span>
          <button onClick={handleLogout} className="text-red-600">
            Logout
         </button>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
