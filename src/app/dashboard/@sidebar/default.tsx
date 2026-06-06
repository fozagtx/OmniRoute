"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, BadgeCheck, LayoutGrid, Plus, ShieldCheck } from "lucide-react";

const navItems = [
  { href: "#markets", full: "Markets", short: "Mkt", icon: LayoutGrid },
  { href: "#market-task-trade", full: "Trade", short: "Trade", icon: ArrowRightLeft },
  { href: "#market-task-resolve", full: "Resolve", short: "Settle", icon: BadgeCheck },
  { href: "#market-task-policy", full: "Policy", short: "Policy", icon: ShieldCheck },
  { href: "#market-task-create", full: "Create", short: "New", icon: Plus },
] as const;

export default function DashboardSidebar() {
  const [activeHref, setActiveHref] = useState("#markets");

  useEffect(() => {
    function syncHash() {
      setActiveHref(window.location.hash || "#markets");
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <div className="sidebar__nav" aria-label="Dashboard navigation">
      <nav className="sidebar__group" aria-label="Market workflow">
        <span className="sidebar__section-label sidebar__label-full">Workflow</span>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeHref === item.href || (activeHref === "" && item.href === "#markets");
          return (
            <a
              className={`sidebar__link ${active ? "sidebar__link--active" : ""}`}
              href={item.href}
              key={item.href}
              onClick={() => setActiveHref(item.href)}
            >
              <Icon className="sidebar__link-icon" aria-hidden size={16} />
              <span className="sidebar__link-title">
                <span className="sidebar__label-full">{item.full}</span>
                <span className="sidebar__label-short">{item.short}</span>
              </span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
