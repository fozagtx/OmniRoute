import Link from "next/link";

const navItems = [
  { label: "Market", href: "/dashboard", tone: "lime" },
  { label: "Policy", href: "/dashboard", tone: "pink" },
  { label: "Resolve", href: "/dashboard", tone: "orange" },
  { label: "Receipts", href: "/dashboard/automations", tone: "cyan" },
] as const;

const flowItems = [
  { label: "Source locked", tone: "orange" },
  { label: "Policy capped", tone: "cyan" },
  { label: "Stake recorded", tone: "pink" },
  { label: "Agent resolves", tone: "lime" },
  { label: "Claim payout", tone: "yellow" },
] as const;

export default function Home() {
  return (
    <main className="agent-landing">
      <header className="agent-nav" aria-label="Somnia market navigation">
        <Link className="agent-nav__brand" href="/" aria-label="Somnia Markets home">
          <img src="/brand/somnia-network-pfp.png" alt="" />
          <span>Somnia Markets</span>
        </Link>

        <nav className="agent-nav__links" aria-label="Primary">
          {navItems.map((item) => (
            <Link className="agent-nav__link" href={item.href} key={item.label}>
              <span className={`agent-swatch agent-swatch--${item.tone}`} aria-hidden />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <Link className="agent-nav__cta" href="/dashboard">
          Open Console
          <span aria-hidden>›</span>
        </Link>
      </header>

      <section className="agent-hero" aria-labelledby="agent-hero-title">
        <div className="agent-hero__copy">
          <h1 id="agent-hero-title">Your agent watches the match while you sleep.</h1>
          <p>
            Configure the source once. The contract stores it, Somnia Agents read
            the evidence, and the market resolves on-chain when the outcome is
            ready.
          </p>
          <div className="agent-hero__actions">
            <Link className="agent-button agent-button--primary" href="/dashboard">
              Launch market console
              <span aria-hidden>›</span>
            </Link>
            <Link className="agent-button agent-button--secondary" href="/dashboard/automations">
              Inspect receipts
              <span aria-hidden>›</span>
            </Link>
          </div>
        </div>

        <figure className="agent-visual" aria-label="Blockchain agent watching a live football market">
          <MatchAgentIllustration />
        </figure>
      </section>

      <section className="agent-flow" aria-label="Contract flow">
        {flowItems.map((item) => (
          <Link className={`agent-flow__item agent-flow__item--${item.tone}`} href="/dashboard" key={item.label}>
            <span className={`agent-swatch agent-swatch--${item.tone}`} aria-hidden />
            <span>{item.label}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}

function MatchAgentIllustration() {
  return (
    <svg className="agent-match-svg" viewBox="0 0 780 430" role="img" aria-labelledby="match-agent-title">
      <title id="match-agent-title">A white blockchain penguin watching a live football market on a screen</title>
      <defs>
        <linearGradient id="screenGlow" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#102421" />
          <stop offset="0.55" stopColor="#071d18" />
          <stop offset="1" stopColor="#050607" />
        </linearGradient>
        <linearGradient id="pitch" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#2ce66f" />
          <stop offset="1" stopColor="#0b6d3a" />
        </linearGradient>
        <clipPath id="somniaBadgeClip">
          <circle cx="184" cy="274" r="18" />
        </clipPath>
      </defs>

      <rect x="0" y="0" width="780" height="430" rx="8" fill="#080909" />
      <path d="M55 367H725" stroke="#1d2024" strokeWidth="2" />

      <g className="agent-screen">
        <rect x="290" y="38" width="416" height="252" rx="16" fill="#15171a" />
        <rect x="308" y="56" width="380" height="216" rx="8" fill="url(#screenGlow)" />
        <rect x="332" y="85" width="214" height="130" rx="6" fill="url(#pitch)" />
        <path d="M439 85V215M332 150H546" stroke="#dfffee" strokeOpacity="0.42" strokeWidth="2" />
        <circle cx="439" cy="150" r="31" fill="none" stroke="#dfffee" strokeOpacity="0.5" strokeWidth="2" />
        <rect x="353" y="103" width="34" height="92" rx="18" fill="none" stroke="#dfffee" strokeOpacity="0.5" strokeWidth="2" />
        <rect x="491" y="103" width="34" height="92" rx="18" fill="none" stroke="#dfffee" strokeOpacity="0.5" strokeWidth="2" />
        <circle cx="403" cy="152" r="5" fill="#ffffff" />
        <circle cx="470" cy="132" r="5" fill="#ffffff" />
        <circle cx="458" cy="176" r="5" fill="#ffffff" />
        <rect x="568" y="85" width="92" height="34" rx="4" fill="#101214" stroke="#2d3137" />
        <text x="582" y="107" fill="#f4f7fb" fontSize="15" fontFamily="monospace">LIVE 1-1</text>
        <rect x="568" y="132" width="92" height="32" rx="4" fill="#6dff2a" />
        <text x="589" y="153" fill="#050607" fontSize="15" fontFamily="monospace">YES</text>
        <rect x="568" y="176" width="92" height="32" rx="4" fill="#39c8f0" />
        <text x="594" y="197" fill="#050607" fontSize="15" fontFamily="monospace">NO</text>
        <rect x="408" y="290" width="180" height="18" rx="9" fill="#23272d" />
        <rect x="470" y="305" width="56" height="42" fill="#23272d" />
        <rect x="414" y="344" width="168" height="16" rx="8" fill="#2b3037" />
      </g>

      <g className="agent-penguin">
        <path d="M126 194C126 147 151 113 190 113C231 113 257 147 257 197V300C257 347 231 380 190 380C150 380 126 347 126 300V194Z" fill="#f6f8fb" />
        <path d="M111 211C111 159 141 118 190 118C240 118 270 159 270 211V298C270 351 241 392 190 392C140 392 111 351 111 298V211Z" fill="#0d0f11" />
        <path d="M135 205C135 161 157 130 190 130C224 130 246 161 246 205V300C246 343 224 373 190 373C157 373 135 343 135 300V205Z" fill="#f7f9fb" />
        <path d="M156 157C166 145 177 139 190 139C205 139 217 145 225 157C217 166 205 171 190 171C176 171 164 166 156 157Z" fill="#0d0f11" />
        <circle cx="176" cy="155" r="5" fill="#f8fbff" />
        <circle cx="207" cy="155" r="5" fill="#f8fbff" />
        <circle cx="177" cy="156" r="2" fill="#050607" />
        <circle cx="206" cy="156" r="2" fill="#050607" />
        <path d="M188 164L198 169L188 174L178 169Z" fill="#ffb61d" />
        <path d="M134 235C108 247 94 271 96 302" stroke="#f6f8fb" strokeWidth="18" strokeLinecap="round" />
        <path d="M246 235C276 236 299 218 314 190" stroke="#f6f8fb" strokeWidth="18" strokeLinecap="round" />
        <path d="M314 190L331 198" stroke="#39c8f0" strokeWidth="5" strokeLinecap="round" />
        <path d="M158 390L126 404M221 390L253 404" stroke="#ffb61d" strokeWidth="11" strokeLinecap="round" />
        <path d="M162 255H207M184 232V300M162 300H207" stroke="#1d2024" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
        <circle cx="162" cy="255" r="5" fill="#39c8f0" />
        <circle cx="207" cy="255" r="5" fill="#6dff2a" />
        <circle cx="184" cy="300" r="5" fill="#ff7a21" />
        <image href="/brand/somnia-network-pfp.png" x="166" y="256" width="36" height="36" clipPath="url(#somniaBadgeClip)" />
      </g>

      <g className="agent-signal">
        <path d="M332 198C300 231 265 252 226 261" fill="none" stroke="#39c8f0" strokeWidth="2" strokeDasharray="7 8" />
        <circle cx="332" cy="198" r="5" fill="#39c8f0" />
        <circle cx="226" cy="261" r="5" fill="#6dff2a" />
      </g>
    </svg>
  );
}
