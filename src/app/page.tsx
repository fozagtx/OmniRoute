import Image from "next/image";
import Link from "next/link";
import LandingWalletButton, { LandingDashboardAction } from "./LandingWalletButton";
import { clipBountyAddress } from "@/lib/clipBounty";

const flowItems = [
  { label: "Choose platform", tone: "cyan" },
  { label: "Fund bounty", tone: "orange" },
  { label: "Submit public URL", tone: "pink" },
  { label: "Agent checks result", tone: "lime" },
  { label: "Release payout", tone: "yellow" },
] as const;

const featureCards = [
  {
    tone: "lime",
    title: "Pay for proof",
    body: "Brands put STT into escrow first. Clippers get paid only when the submitted YouTube link clears the view target.",
  },
  {
    tone: "cyan",
    title: "Agent checked",
    body: "The contract asks Somnia's agent to read the public link and return the visible view count. No private channel login is needed.",
  },
  {
    tone: "yellow",
    title: "Clipper paid",
    body: "When the result lands, the contract releases payment straight to the clipper wallet. Unused funds stay refundable to the brand.",
  },
] as const;

const howItWorks = [
  {
    title: "Post the result",
    body: "A brand sets the campaign URL, clip rules, minimum views, payout per clip, max payouts, and deadline.",
  },
  {
    title: "Fund the reward",
    body: "The brand funds escrow in the same flow, so clippers can see the bounty is backed before they start pushing clips.",
  },
  {
    title: "Check the clip",
    body: "A clipper submits a public YouTube URL. The contract sends that URL to Somnia's agent to read the visible views.",
  },
  {
    title: "Pay when it lands",
    body: "If the views meet the target, the clipper is paid from escrow. If not, the scheduled check can try again later.",
  },
] as const;

const faqs = [
  {
    question: "Where does the agent read data from?",
    answer:
      "From the submitted public URL. In the current live flow, that URL must be from YouTube because the deployed contract verifies YouTube views.",
  },
  {
    question: "Does the app hold clipper funds?",
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
      "The clipper address that submitted the qualifying URL receives STT directly from the contract.",
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
              Agents pay <span className="agent-highlight agent-highlight--purple">clippers</span> when{" "}
              <span className="agent-highlight agent-highlight--orange">results land</span>.
            </h1>
            <p>
              Brands fund view bounties. Clippers deliver public YouTube links. Reel checks the result with an on-chain agent before STT leaves escrow.
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
                <span className="agent-preview-rail__item">Clippers</span>
                <span className="agent-preview-rail__item">Verify</span>
              </aside>

              <div className="agent-preview-main">
                <div className="agent-preview-topbar">
                  <span>Result bounty workspace</span>
                  <LandingDashboardAction>Create bounty</LandingDashboardAction>
                </div>

                <div className="agent-preview-personas">
                  <section className="agent-preview-card agent-preview-card--brand">
                    <span>Brands</span>
                    <h2>Create bounties</h2>
                    <p>Post a result target, fund escrow, and pay only after the agent verifies the clip.</p>
                    <div>
                      <small>Fund</small>
                      <small>Set rules</small>
                      <small>Manage escrow</small>
                    </div>
                  </section>

                  <section className="agent-preview-card">
                    <span>Clippers</span>
                    <h2>Join bounties</h2>
                    <p>Pick a funded bounty, deliver the clip, and get paid when the agent confirms the views.</p>
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
            <h2 id="features-title">Built for result-backed clip work.</h2>
            <p>One flow: brand funds the bounty, clipper submits the link, agent checks the result, contract releases payout.</p>
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
            <p>The app follows the contract. Every bounty, submitted clip, check, and payout can be read on-chain.</p>
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
