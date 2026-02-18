"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import {
  Building2,
  Users,
  Home,
  LogOut,
  Wrench,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

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
    { title: "Maintenance", href: "/admin/maintenance", icon: <Wrench className="h-5 w-5" /> },
    { title: "Tenants", href: "/admin/tenants", icon: <Users className="h-5 w-5" /> },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 relative">
      {/* Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed z-50 inset-y-0 left-0 w-64 bg-white border-r
          transform transition-transform duration-300
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:static md:flex md:flex-col
        `}
      >
        <div className="px-6 py-6 font-bold text-xl border-b flex justify-between items-center">
          Housify KE
          <button
            className="md:hidden"
            onClick={() => setIsOpen(false)}
          >
            <X />
          </button>
        </div>

        <nav className="mt-6 flex-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-2 px-6 py-3 transition ${
                  active
                    ? "bg-gray-100 text-indigo-600 font-medium"
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
            className="flex items-center gap-2 w-full text-gray-700 hover:text-red-600"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col w-full">
        <header className="bg-white border-b px-4 py-3 flex justify-between items-center md:hidden">
          <button onClick={() => setIsOpen(true)}>
            <Menu />
          </button>
          <span className="font-bold">Housify KE</span>
          <button onClick={handleLogout} className="text-red-600 text-sm">
            Logout
          </button>
        </header>

        <main className="flex-1 p-6 overflow-y-auto md:ml-64">
          {children}
        </main>
      </div>
    </div>
  );
}
