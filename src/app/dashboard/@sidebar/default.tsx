"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, CircleDollarSign, LayoutGrid, Plus, Send } from "lucide-react";

const navItems = [
  { href: "#bounties", full: "Bounties", short: "List", icon: LayoutGrid },
  { href: "#bounty-task-submit", full: "Submit", short: "Send", icon: Send },
  { href: "#bounty-task-verify", full: "Verify", short: "Check", icon: BadgeCheck },
  { href: "#bounty-task-create", full: "Create", short: "New", icon: Plus },
  { href: "#bounty-task-funds", full: "Funds", short: "Pay", icon: CircleDollarSign },
] as const;

export default function DashboardSidebar() {
  const [activeHref, setActiveHref] = useState("#bounties");

  useEffect(() => {
    function syncHash() {
      setActiveHref(window.location.hash || "#bounties");
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <div className="sidebar__nav" aria-label="Dashboard navigation">
      <nav className="sidebar__group" aria-label="Bounty workflow">
        <span className="sidebar__section-label sidebar__label-full">Bounty flow</span>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeHref === item.href || (activeHref === "" && item.href === "#bounties");
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
