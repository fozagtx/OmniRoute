"use client";

import { ConnectKitButton } from "connectkit";
import { usePathname } from "next/navigation";

export default function StatusBar() {
  const pathname = usePathname();
  const onLanding = pathname === "/";

  return (
    <div className="status-bar">
      <a className="brand" href="/">
        <span className="brand__mark" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="3.5" cy="3.5" r="2" fill="#fff" />
            <circle cx="12.5" cy="12.5" r="2" fill="#fff" />
            <path
              d="M3.5 5.5v2.5a3 3 0 0 0 3 3h3"
              stroke="#fff"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="brand__name">Somnia Markets</span>
      </a>

      {onLanding && (
        <nav className="nav">
          <a className="nav__link" href="#how">Flow</a>
          <a className="nav__link" href="#compare">Guardrails</a>
          <a className="nav__link" href="#faq">FAQ</a>
        </nav>
      )}

      <div className="status-bar__group">
        <ConnectKitButton showBalance={false} />
      </div>
    </div>
  );
}
