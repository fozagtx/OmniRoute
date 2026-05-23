"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRightLeft, Workflow } from "lucide-react";

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <div className="sidebar__nav" aria-label="Dashboard navigation">
      <nav className="sidebar__group" aria-label="Transfer">
        <Link
          className={`sidebar__link ${pathname === "/dashboard" ? "sidebar__link--active" : ""}`}
          href="/dashboard"
        >
          <ArrowRightLeft className="sidebar__link-icon" aria-hidden size={16} />
          <span className="sidebar__link-title">
            <span className="sidebar__label-full">Transfer</span>
            <span className="sidebar__label-short">Transfer</span>
          </span>
        </Link>
        <Link
          className={`sidebar__link ${pathname === "/dashboard/automations" ? "sidebar__link--active" : ""}`}
          href="/dashboard/automations"
        >
          <Workflow className="sidebar__link-icon" aria-hidden size={16} />
          <span className="sidebar__link-title">
            <span className="sidebar__label-full">Automations</span>
            <span className="sidebar__label-short">Auto</span>
          </span>
        </Link>
      </nav>
    </div>
  );
}
