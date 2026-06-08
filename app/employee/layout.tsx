"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [employee, setEmployee] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/"); return; }
      supabase.from("employees").select("*").eq("email", user.email).single()
        .then(({ data }) => { if (!data) router.push("/"); else setEmployee(data); });
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const navItems = [
    { href: "/employee/dashboard", icon: "ti-home", label: "Dashboard" },
    { href: "/employee/history", icon: "ti-calendar-stats", label: "History" },
  ];

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex">
      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-60 bg-[#12122a] border-r border-white/[0.08] z-30 flex flex-col transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.08]">
          <div className="text-sm font-semibold text-purple-300">NarrativeX</div>
          <div className="text-xs text-purple-300/40">Tracker</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, icon, label }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${active ? "bg-purple-600/20 text-purple-300" : "text-white/50 hover:text-white hover:bg-white/[0.06]"}`}>
                <i className={`ti ${icon} text-base`} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Employee info + logout */}
        <div className="px-4 py-4 border-t border-white/[0.08]">
          <div className="text-xs text-white/40 mb-0.5">{employee?.full_name}</div>
          <div className="text-xs text-white/25 mb-3">{employee?.department || "—"}</div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors">
            <i className="ti ti-logout text-sm" /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:ml-60">
        {/* Topbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-[#12122a] border-b border-white/[0.08]">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-white/50 hover:text-white">
            <i className="ti ti-menu-2 text-xl" />
          </button>
          <div className="text-sm font-medium text-white/60 hidden lg:block">
            {navItems.find(n => n.href === pathname)?.label}
          </div>
          <div className="text-sm text-white/40">{employee?.full_name}</div>
        </div>

        {/* Page content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}