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
          <SomniaBrand />
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
        <circle cx="184" cy="274" r="20" fill="#070808" stroke="#39c8f0" strokeWidth="2" />
        <g transform="translate(161 265) scale(0.55)" color="#f4f7fb">
          <SomniaMarkPaths />
        </g>
      </g>

      <g className="agent-signal">
        <path d="M332 198C300 231 265 252 226 261" fill="none" stroke="#39c8f0" strokeWidth="2" strokeDasharray="7 8" />
        <circle cx="332" cy="198" r="5" fill="#39c8f0" />
        <circle cx="226" cy="261" r="5" fill="#6dff2a" />
      </g>
    </svg>
  );
}

function SomniaBrand() {
  return (
    <span className="somnia-brand" aria-hidden="true">
      <svg className="somnia-brand__mark" viewBox="0 0 42.1956 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <SomniaMarkPaths />
      </svg>
      <span className="somnia-brand__text">
        <span>Somnia</span>
        <span>Markets</span>
      </span>
    </span>
  );
}

function SomniaMarkPaths() {
  return (
    <>
      <path
        d="M0 14.8148H1.48148C1.90123 14.8148 2.2716 14.7284 2.59259 14.5556C2.91358 14.358 3.17284 14.1111 3.37037 13.8148C3.59259 13.4938 3.75309 13.1481 3.85185 12.7778C3.97531 12.3827 4.03704 11.9877 4.03704 11.5926V5.62963C4.03704 4.71605 4.12346 3.91358 4.2963 3.22222C4.49383 2.53086 4.81482 1.95062 5.25926 1.48148C5.7037 0.987655 6.2963 0.617286 7.03704 0.370372C7.80247 0.123457 8.75309 0 9.88889 0H12.8889V2.40741H9.74074C8.7037 2.40741 7.96296 2.64198 7.51852 3.11111C7.09876 3.58025 6.88889 4.4321 6.88889 5.66667V10.7778C6.88889 12.4321 6.64197 13.6543 6.14815 14.4444C5.65432 15.2099 5.08642 15.7284 4.44444 16C5.08642 16.2963 5.65432 16.8519 6.14815 17.6667C6.64197 18.4815 6.88889 19.6667 6.88889 21.2222V26.3333C6.88889 27.5679 7.11111 28.4198 7.55556 28.8889C8 29.358 8.74074 29.5926 9.77778 29.5926H12.8889V32H9.88889C8.75309 32 7.80247 31.8765 7.03704 31.6296C6.2963 31.3827 5.7037 31.0123 5.25926 30.5185C4.81482 30.0494 4.49383 29.4691 4.2963 28.7778C4.12346 28.0864 4.03704 27.284 4.03704 26.3704V20.4074C4.03704 20.037 3.97531 19.6667 3.85185 19.2963C3.75309 18.9012 3.59259 18.5556 3.37037 18.2593C3.17284 17.9383 2.91358 17.679 2.59259 17.4815C2.2963 17.284 1.93827 17.1852 1.51852 17.1852H0V14.8148Z"
        fill="currentColor"
      />
      <path
        d="M42.1956 17.1852H40.7142C40.2944 17.1852 39.924 17.284 39.603 17.4815C39.3067 17.6543 39.0475 17.9012 38.8253 18.2222C38.6277 18.5185 38.4672 18.8642 38.3438 19.2593C38.245 19.6296 38.1956 20.0123 38.1956 20.4074V26.3704C38.1956 27.284 38.0969 28.0864 37.8993 28.7778C37.7265 29.4691 37.4055 30.0494 36.9364 30.5185C36.4919 31.0123 35.887 31.3827 35.1216 31.6296C34.3808 31.8765 33.4426 32 32.3067 32H29.3067V29.5926H32.4549C33.4919 29.5926 34.2203 29.358 34.6401 28.8889C35.0845 28.4198 35.3067 27.5679 35.3067 26.3333V21.2222C35.3067 19.5679 35.5537 18.358 36.0475 17.5926C36.5413 16.8025 37.1092 16.2716 37.7512 16C37.1092 15.7037 36.5413 15.1481 36.0475 14.3333C35.5537 13.5185 35.3067 12.3333 35.3067 10.7778V5.66667C35.3067 4.4321 35.0845 3.58025 34.6401 3.11111C34.1956 2.64198 33.4549 2.40741 32.4179 2.40741H29.3067V0H32.3067C33.4426 0 34.3808 0.123457 35.1216 0.370372C35.887 0.617286 36.4919 0.987655 36.9364 1.48148C37.4055 1.95062 37.7265 2.53086 37.8993 3.22222C38.0969 3.91358 38.1956 4.71605 38.1956 5.62963V11.5926C38.1956 11.963 38.245 12.3457 38.3438 12.7407C38.4426 13.1111 38.5907 13.4568 38.7882 13.7778C39.0105 14.0741 39.2697 14.321 39.566 14.5185C39.887 14.716 40.2574 14.8148 40.6771 14.8148H42.1956V17.1852Z"
        fill="currentColor"
      />
      <path
        d="M21.5654 24.0202C20.1111 24.0202 18.749 23.7846 17.479 23.3135C16.2091 22.8424 15.1235 22.2996 14.2222 21.6851L15.3898 20.026C16.2501 20.6405 17.2025 21.1321 18.2472 21.5008C19.2918 21.8694 20.5003 22.0538 21.8727 22.0538C23.1427 22.0538 24.0849 21.8182 24.6994 21.3471C25.3344 20.876 25.6518 20.3332 25.6518 19.7187C25.6518 19.4319 25.5904 19.1657 25.4675 18.9199C25.3651 18.6741 25.15 18.4385 24.8223 18.2132C24.515 17.9879 24.0542 17.7728 23.4397 17.568C22.8252 17.3631 22.0058 17.1583 20.9817 16.9535C19.0358 16.5438 17.5712 15.9908 16.588 15.2943C15.6253 14.5979 15.144 13.6966 15.144 12.5906C15.144 11.382 15.6663 10.3784 16.7109 9.57952C17.7556 8.76019 19.3021 8.35053 21.3504 8.35053C22.4974 8.35053 23.6035 8.54512 24.6687 8.9343C25.7338 9.303 26.635 9.74339 27.3724 10.2555L26.1434 11.8839C25.4675 11.3923 24.6994 11.0133 23.8391 10.7471C22.9788 10.4603 22.0775 10.3169 21.1353 10.3169C20.275 10.3169 19.5888 10.4193 19.0767 10.6242C18.5851 10.8085 18.2267 11.0646 18.0014 11.3923C17.7965 11.72 17.6941 12.0785 17.6941 12.4677C17.6941 13.1026 18.0321 13.6045 18.708 13.9732C19.4045 14.3214 20.5106 14.6491 22.0263 14.9564C23.6855 15.3046 24.9554 15.6938 25.8362 16.1239C26.7375 16.5541 27.352 17.0457 27.6797 17.5987C28.0279 18.1517 28.202 18.8072 28.202 19.5651C28.202 20.3844 27.946 21.1321 27.4339 21.808C26.9218 22.4635 26.1742 22.996 25.191 23.4057C24.2078 23.8154 22.9993 24.0202 21.5654 24.0202Z"
        fill="currentColor"
      />
    </>
  );
}
