import Image from "next/image";
import Link from "next/link";
import { clipBountyAddress } from "@/lib/clipBounty";

const flowItems = [
  { label: "Fund bounty", tone: "orange" },
  { label: "Submit clip", tone: "pink" },
  { label: "Check views", tone: "cyan" },
  { label: "Pay clipper", tone: "lime" },
  { label: "Refund unused", tone: "yellow" },
] as const;

const featureCards = [
  {
    tone: "lime",
    title: "Escrow first",
    body: "Creators fund the bounty up front. The contract holds STT until a submitted YouTube URL clears the view check.",
  },
  {
    tone: "cyan",
    title: "Public URL proof",
    body: "Clippers submit their YouTube clip URL. Somnia Agents read the public page and return the visible view count.",
  },
  {
    tone: "yellow",
    title: "Direct payout",
    body: "If the view threshold is met, the contract pays the clipper from escrow. The app never routes the payout through itself.",
  },
] as const;

const howItWorks = [
  {
    title: "Create the bounty",
    body: "Set the campaign URL, rules, minimum views, reward per clip, max payouts, and deadline. Funding is sent with the transaction.",
  },
  {
    title: "Collect YouTube links",
    body: "Clippers submit public YouTube Shorts or video URLs against the bounty. Each submission is stored on-chain.",
  },
  {
    title: "Ask Somnia to verify",
    body: "The contract sends the submitted URL to Somnia's LLM Parse Website agent and asks for the visible view count.",
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
      "From the submitted YouTube URL. The contract sends that URL and the bounty rules to Somnia's Parse Website agent during verification.",
  },
  {
    question: "Does the app hold creator funds?",
    answer:
      "No. The creator signs a contract transaction and funds sit in the SomniaClipBounty escrow until paid or refunded.",
  },
  {
    question: "What can the agent verify?",
    answer:
      "This flow checks the public YouTube page and visible view count. It does not claim to inspect private analytics or video frames.",
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
        <header className="agent-nav" aria-label="Clip bounty navigation">
          <Link className="agent-nav__brand" href="/" aria-label="Somnia Clip Bounties home">
            <SomniaBrand />
          </Link>

          <nav className="agent-nav__links" aria-label="Landing sections">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
          </nav>

          <Link className="agent-nav__cta" href="/dashboard">
            Open app
          </Link>
        </header>

        <section className="agent-hero" aria-labelledby="agent-hero-title">
          <div className="agent-hero__copy">
            <p className="agent-announcement">YouTube bounties on Somnia escrow</p>
            <h1 id="agent-hero-title">Pay clippers only when the views arrive.</h1>
            <p>
              Create a funded YouTube bounty, let creators submit public clips, and have Somnia verify the view count before STT leaves escrow.
            </p>
            <div className="agent-hero__actions">
              <Link className="agent-button agent-button--primary" href="/dashboard">
                Create bounty
              </Link>
            </div>
          </div>

          <figure className="agent-visual" aria-label="YouTube clip bounty workflow">
            <Image
              className="agent-hero-image"
              src="/brand/youtube-clip-agent.png"
              alt="Creator workspace for a YouTube clip bounty"
              width={1254}
              height={1254}
              priority
            />
            <figcaption className="agent-visual__console">
              <span>Submit YouTube URL</span>
              <div>
                <button type="button">Attach clip</button>
                <button type="button">Check views</button>
                <Link href="/dashboard" aria-label="Open dashboard">
                  <span aria-hidden>↗</span>
                </Link>
              </div>
            </figcaption>
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
            <h2 id="features-title">Built for creator bounty drops.</h2>
            <p>One contract surface: bounty funding, clip submission, Somnia verification, payout, and unused escrow refund.</p>
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
          <Link className="agent-footer__link" href="/dashboard">
            Open app
          </Link>
        </footer>
      </div>
    </main>
  );
}

function SomniaBrand() {
  return (
    <span className="somnia-brand" aria-hidden="true">
      <Image className="somnia-brand__mark" src="/brand/somnia-clip-logo.png" alt="" width={56} height={56} priority />
      <span className="somnia-brand__text">
        <span>Somnia</span>
        <span>Clips</span>
      </span>
    </span>
  );
}
