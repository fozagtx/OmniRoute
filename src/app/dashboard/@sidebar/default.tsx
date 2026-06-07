"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, CircleDollarSign, LayoutGrid, Plus } from "lucide-react";

const navItems = [
  { href: "#clippers", full: "Clippers", short: "Join", icon: LayoutGrid },
  { href: "#verify", full: "Verify views", short: "Views", icon: BadgeCheck },
  { href: "#brands", full: "Brands", short: "Make", icon: Plus },
  { href: "#funds", full: "Escrow funds", short: "STT", icon: CircleDollarSign },
] as const;

export default function DashboardSidebar() {
  const [activeHref, setActiveHref] = useState("#clippers");

  useEffect(() => {
    function syncHash() {
      setActiveHref(window.location.hash || "#clippers");
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <div className="sidebar__nav" aria-label="Reel workspace navigation">
      <nav className="sidebar__group" aria-label="Reel workspace">
        <span className="sidebar__section-label sidebar__label-full">Workspace</span>
        {navItems.map((item) => {
          const Icon = item.icon;
          const normalizedHref =
            activeHref === "#bounty-task-submit" || activeHref === "#bounties"
              ? "#clippers"
              : activeHref === "#bounty-task-create"
                ? "#brands"
                : activeHref === "#bounty-task-verify"
                  ? "#verify"
                  : activeHref === "#bounty-task-funds"
                    ? "#funds"
                    : activeHref;
          const active = normalizedHref === item.href || (normalizedHref === "" && item.href === "#clippers");
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
