import Image from "next/image";
import Link from "next/link";

const flowItems = [
  { label: "Source configured", tone: "orange" },
  { label: "Stake recorded", tone: "pink" },
  { label: "Resolution requested", tone: "cyan" },
  { label: "Resolver response", tone: "lime" },
  { label: "Payout claimable", tone: "yellow" },
] as const;

export default function Home() {
  return (
    <main className="agent-landing">
      <header className="agent-nav" aria-label="Somnia market navigation">
        <Link className="agent-nav__brand" href="/" aria-label="Somnia Markets home">
          <SomniaBrand />
        </Link>

        <Link className="agent-nav__cta" href="/dashboard">
          Open app
          <span aria-hidden>›</span>
        </Link>
      </header>

      <section className="agent-hero" aria-labelledby="agent-hero-title">
        <div className="agent-hero__copy">
          <h1 id="agent-hero-title">Your agent watches while you sleep.</h1>
          <p>
            It follows the match source, requests Somnia resolution, and leaves
            the outcome and payouts on-chain.
          </p>
          <div className="agent-hero__actions">
            <Link className="agent-button agent-button--primary" href="/dashboard">
              Enter market
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
          <div className={`agent-flow__item agent-flow__item--${item.tone}`} key={item.label}>
            <span className={`agent-swatch agent-swatch--${item.tone}`} aria-hidden />
            <span>{item.label}</span>
          </div>
        ))}
      </section>
    </main>
  );
}

function MatchAgentIllustration() {
  return (
    <Image
      className="agent-hero-image"
      src="/brand/somnia-market-penguin.png"
      alt="White blockchain penguin watching a live football match"
      width={1254}
      height={1254}
      priority
    />
  );
}

function SomniaBrand() {
  return (
    <span className="somnia-brand" aria-hidden="true">
      <Image
        className="somnia-brand__mark"
        src="/brand/somnia-market-logo.png"
        alt=""
        width={56}
        height={56}
        priority
      />
      <span className="somnia-brand__text">
        <span>Somnia</span>
        <span>Markets</span>
      </span>
    </span>
  );
}
