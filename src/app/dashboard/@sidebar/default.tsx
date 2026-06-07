"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, CircleDollarSign, LayoutGrid, Plus } from "lucide-react";

const navItems = [
  { href: "/dashboard/clippers", full: "Clippers", short: "Join", icon: LayoutGrid },
  { href: "/dashboard/verify", full: "Verify views", short: "Views", icon: BadgeCheck },
  { href: "/dashboard/brands", full: "Brands", short: "Make", icon: Plus },
  { href: "/dashboard/funds", full: "Escrow funds", short: "STT", icon: CircleDollarSign },
] as const;

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <div className="sidebar__nav" aria-label="Reel workspace navigation">
      <nav className="sidebar__group" aria-label="Reel workspace">
        <span className="sidebar__section-label sidebar__label-full">Workspace</span>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (pathname === "/dashboard" && item.href === "/dashboard/clippers");
          return (
            <Link
              className={`sidebar__link ${active ? "sidebar__link--active" : ""}`}
              href={item.href}
              key={item.href}
            >
              <Icon className="sidebar__link-icon" aria-hidden size={16} />
              <span className="sidebar__link-title">
                <span className="sidebar__label-full">{item.full}</span>
                <span className="sidebar__label-short">{item.short}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
