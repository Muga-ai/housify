// app/tenant/layout.tsx
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { Home, Wrench, FileText, LogOut, Building2 } from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (!user) {
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
    { title: "Dashboard", href: "/tenant/dashboard", icon: <Home className="h-5 w-5" /> },
    { title: "Maintenance", href: "/tenant/maintenance", icon: <Wrench className="h-5 w-5" /> },
    { title: "Rent Payments", href: "/tenant/payments", icon: <FileText className="h-5 w-5" /> },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white border-r hidden md:flex flex-col">
        <div className="px-6 py-8 font-bold text-2xl border-b flex items-center gap-3">
          <Building2 className="h-8 w-8 text-indigo-600" />
          Housify KE
        </div>

        <nav className="mt-8 flex-1 px-4">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all mb-2 ${
                  active
                    ? "bg-indigo-50 text-indigo-600 font-medium shadow-sm"
                    : "text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
                }`}
              >
                {item.icon}
                <span className="text-sm font-medium">{item.title}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-4 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center gap-4 w-full text-gray-700 hover:text-red-600 transition-all"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <Building2 className="h-7 w-7 text-indigo-600" />
            <span className="font-bold text-xl">Housify KE</span>
          </div>
          <button onClick={handleLogout} className="text-red-600 hover:text-red-700 transition">
            <LogOut className="h-6 w-6" />
          </button>
        </header>

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}