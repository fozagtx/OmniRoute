import Image from "next/image";
import Link from "next/link";
import { predictionMarketAddress } from "@/lib/predictionMarket";

const flowItems = [
  { label: "Source configured", tone: "orange" },
  { label: "Stake recorded", tone: "pink" },
  { label: "Resolution requested", tone: "cyan" },
  { label: "Resolver response", tone: "lime" },
  { label: "Payout claimable", tone: "yellow" },
] as const;

const featureCards = [
  {
    tone: "lime",
    title: "Source-bound markets",
    body:
      "Every market stores its question, evidence URL, resolution prompt, page count, and confidence threshold in the contract.",
  },
  {
    tone: "cyan",
    title: "Policy-limited execution",
    body:
      "A wallet can set an executor, side limits, per-action stake caps, total exposure, expiry, and disable the policy later.",
  },
  {
    tone: "yellow",
    title: "On-chain resolution trail",
    body:
      "Resolution stores the Somnia request id, receipt id, status, output, pools, positions, and claim state for inspection.",
  },
] as const;

const howItWorks = [
  {
    title: "Create a configured market",
    body:
      "The app selects a vetted source preset and writes the question, evidence URL, prompt, close time, pages, and confidence threshold to Somnia.",
  },
  {
    title: "Stake or delegate within limits",
    body:
      "Users stake STT directly, deposit native credit, or create a bounded policy an executor can use without breaking the wallet-defined caps.",
  },
  {
    title: "Request agent resolution",
    body:
      "After close, the contract pays the Somnia Agents fee and sends the stored evidence URL to the LLM Parse Website agent.",
  },
  {
    title: "Claim the resolved payout",
    body:
      "The callback records the output and outcome on-chain. Winning positions claim from the market pool; losing positions cannot drain it.",
  },
] as const;

const faqs = [
  {
    question: "Where does the agent read match data from?",
    answer:
      "From the evidence URL stored on the market. The dashboard uses configured source presets, then the contract sends that stored URL to Somnia Agents during resolution.",
  },
  {
    question: "Does the agent hold the user's wallet?",
    answer:
      "No. The user signs contract transactions. A policy executor can act only inside the owner-defined side, stake, total exposure, and expiry limits.",
  },
  {
    question: "What happens if a trade breaks the cap?",
    answer:
      "The contract reverts the action. Policy stake calls check the executor, allowed side, per-action cap, total cap, expiry, and enabled flag.",
  },
  {
    question: "Where do winnings go?",
    answer:
      "Claims are paid by the contract to the connected wallet that owns the winning position. Settlement does not route through the app.",
  },
] as const;

const contractAddress = predictionMarketAddress ?? "Not configured";

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

      <section className="agent-section agent-features" aria-labelledby="features-title">
        <div className="agent-section__header">
          <h2 id="features-title">Built for bounded market action.</h2>
          <p>
            The app is a thin interface over the deployed SomniaPredictionMarket
            contract. State lives on-chain; the page just makes the flow legible.
          </p>
        </div>
        <div className="agent-feature-grid">
          {featureCards.map((feature) => (
            <article className={`agent-feature-card agent-feature-card--${feature.tone}`} key={feature.title}>
              <span className={`agent-swatch agent-swatch--${feature.tone}`} aria-hidden />
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="agent-section agent-how" aria-labelledby="how-title">
        <div className="agent-section__header">
          <h2 id="how-title">How it works</h2>
          <p>
            Four contract moves: create, stake, resolve, claim. No hidden
            off-chain market book sits between the wallet and the outcome.
          </p>
        </div>
        <ol className="agent-step-list">
          {howItWorks.map((step, index) => (
            <li className="agent-step" key={step.title}>
              <span className="agent-step__index">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="agent-section agent-faq" aria-labelledby="faq-title">
        <div className="agent-section__header">
          <h2 id="faq-title">FAQ</h2>
          <p>Plain answers for the parts that should not be guessed.</p>
        </div>
        <div className="agent-faq__list">
          {faqs.map((item) => (
            <details className="agent-faq__item" key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="agent-footer">
        <SomniaBrand />
        <div className="agent-footer__meta">
          <span>Somnia Testnet</span>
          <span className="agent-footer__contract">{contractAddress}</span>
        </div>
        <Link className="agent-footer__link" href="/dashboard">
          Open app
          <span aria-hidden>›</span>
        </Link>
      </footer>
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
