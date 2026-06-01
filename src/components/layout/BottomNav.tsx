"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Map, Truck, Settings } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      label: "Wajib Pajak",
      href: "/wajib-pajak",
      icon: Users,
    },
    {
      label: "Peta",
      href: "/peta",
      icon: Map,
    },
    {
      label: "Distribusi",
      href: "/distribusi",
      icon: Truck,
    },
    {
      label: "Pengaturan",
      href: "/settings",
      icon: Settings,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-white/10 bg-brand-dark/90 backdrop-blur-lg px-2 pb-safe shadow-[0_-8px_30px_rgb(0,0,0,0.12)] md:max-w-md md:mx-auto md:rounded-t-2xl md:shadow-[0_-4px_24px_rgba(15,45,56,0.15)]">
      <div className="flex h-full items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          // Cek active path
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all duration-300 relative group`}
            >
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 ${
                  isActive
                    ? "bg-white/10 text-white scale-110 shadow-inner"
                    : "text-brand-teal group-hover:text-white/80 group-hover:scale-105"
                }`}
              >
                <Icon size={20} className={isActive ? "stroke-[2.5px]" : "stroke-[1.8px]"} />
              </div>
              <span
                className={`text-[9px] font-semibold mt-0.5 tracking-wider transition-colors duration-300 ${
                  isActive ? "text-white font-bold" : "text-brand-teal/80 group-hover:text-white/60"
                }`}
              >
                {item.label}
              </span>

              {/* Indicator dot */}
              {isActive && (
                <div className="absolute top-1 w-1.5 h-1.5 rounded-full bg-status-sawah animate-pulse shadow-[0_0_8px_#F0A500]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
