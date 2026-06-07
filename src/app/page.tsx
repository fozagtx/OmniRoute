import Image from "next/image";
import Link from "next/link";
import LandingWalletButton, { LandingDashboardAction } from "./LandingWalletButton";
import { clipBountyAddress } from "@/lib/clipBounty";

const flowItems = [
  { label: "Choose platform", tone: "cyan" },
  { label: "Fund bounty", tone: "orange" },
  { label: "Submit public URL", tone: "pink" },
  { label: "Verify metrics", tone: "lime" },
  { label: "Pay creator", tone: "yellow" },
] as const;

const featureCards = [
  {
    tone: "lime",
    title: "Escrow first",
    body: "Brands fund the bounty up front. The contract holds STT until a creator's public URL clears the metric check.",
  },
  {
    tone: "cyan",
    title: "Network-ready surface",
    body: "YouTube view checks are live first. Twitter and Instagram sit in the product lane without being sold as active contract support yet.",
  },
  {
    tone: "yellow",
    title: "Direct payout",
    body: "If the threshold is met, the contract pays the creator from escrow. The app never routes the payout through itself.",
  },
] as const;

const howItWorks = [
  {
    title: "Create the bounty",
    body: "Set the campaign URL, rules, minimum views, reward per clip, max payouts, and deadline. Funding is sent with the transaction.",
  },
  {
    title: "Collect public links",
    body: "Creators submit public campaign URLs against the bounty. Today the contract accepts YouTube links for live view checks.",
  },
  {
    title: "Ask Somnia to verify",
    body: "The contract sends the submitted URL to Somnia's LLM Parse Website agent and asks for the visible metric.",
  },
  {
    title: "Pay or reject",
    body: "The callback records the observed views. Qualified submissions are paid immediately; failed ones remain rejected on-chain.",
  },
] as const;

const faqs = [
  {
    question: "Where does the agent read data from?",
    answer:
      "From the submitted public URL. In the current live flow, that URL must be from YouTube because the deployed contract verifies YouTube views.",
  },
  {
    question: "Does the app hold creator funds?",
    answer:
      "No. The brand signs the funding transaction and STT sits in escrow until paid or refunded.",
  },
  {
    question: "What can the agent verify?",
    answer:
      "The live flow checks the public YouTube page and visible view count. It does not claim to inspect private analytics or video frames.",
  },
  {
    question: "Who receives payment?",
    answer:
      "The creator address that submitted the qualifying URL receives STT directly from the contract.",
  },
] as const;

const contractAddress = clipBountyAddress ?? "Not configured";

export default function Home() {
  return (
    <main className="agent-landing">
      <div className="agent-shell">
        <header className="agent-nav" aria-label="Reel navigation">
          <Link className="agent-nav__brand" href="/" aria-label="Reel home">
            <SomniaBrand />
          </Link>

          <nav className="agent-nav__links" aria-label="Landing sections">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="agent-nav__actions">
            <LandingWalletButton />
          </div>
        </header>

        <section className="agent-hero" aria-labelledby="agent-hero-title">
          <div className="agent-hero__copy">
            <h1 id="agent-hero-title">
              Turn <span className="agent-highlight agent-highlight--purple">public proof</span> into paid{" "}
              <span className="agent-highlight agent-highlight--orange">Reel bounties</span>.
            </h1>
            <p>
              Brands create funded campaigns. Creators submit public links. Somnia verifies the metric before STT leaves escrow. YouTube views are live first.
            </p>
            <div className="agent-hero__actions">
              <LandingDashboardAction className="agent-button agent-button--primary">
                Create bounty
              </LandingDashboardAction>
            </div>
          </div>

          <figure className="agent-visual" aria-label="Reel two-persona dashboard preview">
            <div className="agent-visual__board agent-visual__board--workspace">
              <aside className="agent-preview-rail" aria-label="Preview navigation">
                <span className="agent-preview-rail__brand">Reel</span>
                <span className="agent-preview-rail__item agent-preview-rail__item--active">Brands</span>
                <span className="agent-preview-rail__item">Creators</span>
                <span className="agent-preview-rail__item">Verify</span>
              </aside>

              <div className="agent-preview-main">
                <div className="agent-preview-topbar">
                  <span>Bounty workspace</span>
                  <LandingDashboardAction>Create bounty</LandingDashboardAction>
                </div>

                <div className="agent-preview-personas">
                  <section className="agent-preview-card agent-preview-card--brand">
                    <span>Brands</span>
                    <h2>Create bounties</h2>
                    <p>Fund a campaign, set view targets, and keep unused escrow refundable from the contract.</p>
                    <div>
                      <small>Fund</small>
                      <small>Set rules</small>
                      <small>Manage escrow</small>
                    </div>
                  </section>

                  <section className="agent-preview-card">
                    <span>Creators</span>
                    <h2>Join bounties</h2>
                    <p>Pick a funded bounty, submit a public YouTube URL, and request metric verification.</p>
                    <div>
                      <small>Submit link</small>
                      <small>Verify views</small>
                      <small>Claim payout</small>
                    </div>
                  </section>
                </div>
              </div>
            </div>
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

        <section className="agent-section agent-features" id="features" aria-labelledby="features-title">
          <div className="agent-section__header">
            <h2 id="features-title">Built for brand-funded bounty drops.</h2>
            <p>One contract surface: bounty funding, URL submission, Somnia verification, payout, and unused escrow refund.</p>
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

        <section className="agent-section agent-how" id="how" aria-labelledby="how-title">
          <div className="agent-section__header">
            <h2 id="how-title">How it works</h2>
            <p>The app follows the contract, not a hidden server ledger. Every bounty and submission can be read from Somnia.</p>
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

        <section className="agent-section agent-faq" id="faq" aria-labelledby="faq-title">
          <div className="agent-section__header">
            <h2 id="faq-title">FAQ</h2>
            <p>Only the parts the contract can actually enforce.</p>
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
        </footer>
      </div>
    </main>
  );
}

function SomniaBrand() {
  return (
    <span className="somnia-brand" aria-hidden="true">
      <Image className="somnia-brand__mark" src="/brand/reel-logo.png" alt="" width={56} height={56} priority />
      <span className="somnia-brand__text">
        <span>Reel</span>
      </span>
    </span>
  );
}
