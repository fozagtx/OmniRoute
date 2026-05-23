"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import ThreeGlobe from "./ThreeGlobe";

export default function Landing() {
  const router = useRouter();
  const { status } = useAccount();

  useEffect(() => {
    if (status === "connected" || status === "reconnecting") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  return (
    <main className="landing">
      {/* ───────────────────────── 1 · HERO ───────────────────────── */}
      <section className="hero">
        <div className="hero__inner">
          <div className="hero__copy">
            <h1 className="hero__title">
              Stablecoin settlement <em>with verified rates.</em>
            </h1>
            <p className="hero__sub">
              Lock ERC-20 funds, check a public reference rate through Somnia
              Agents, then release through the configured settlement vault or
              refund automatically.
            </p>
            <div className="hero__cta">
              <ConnectKitButton.Custom>
                {({ show }) => (
                  <button className="cta" onClick={show}>
                    Start settlement
                  </button>
                )}
              </ConnectKitButton.Custom>
              <a className="cta cta--ghost" href="#how">
                How it works
              </a>
            </div>
          </div>
          <div className="hero__visual" aria-hidden="true">
            <ThreeGlobe />
          </div>
        </div>
      </section>

      {/* ───────────────────────── 3 · PROBLEM ───────────────────────── */}
      <section className="section">
        <div className="sectionHead">
          <span className="eyebrow">the status quo</span>
          <h2 className="sectionTitle">Stablecoin settlement still depends on trust.</h2>
        </div>
        <div className="cardGrid">
          <ProblemCard
            title="Reference rates live off-chain"
            body="Teams agree to a rate in chat, spreadsheets, or a private desk. When settlement happens later, nobody has a neutral on-chain record of the number used."
            fix="the rate source and accepted quote are recorded on-chain"
          />
          <ProblemCard
            title="One side has to move first"
            body="Escrow terms are usually enforced by people or private systems. One party releases funds, then waits for the other side to honor the rate."
            fix="funds release only when the verified rate clears the minimum"
          />
          <ProblemCard
            title="Bad quotes create manual cleanup"
            body="If the rate source fails, drifts, or returns a value outside the agreed range, teams need manual dispute handling and reconciliation."
            fix="set a minimum up front; refund if it isn't met"
          />
        </div>
      </section>

      {/* ───────────────────────── 4 · SOLUTION ───────────────────────── */}
      <section className="section" id="how">
        <div className="sectionHead">
          <span className="eyebrow">how settlement clears</span>
          <h2 className="sectionTitle">Lock. Check. Release or refund.</h2>
        </div>
        <div className="cardGrid">
          <SolutionCard
            n="01"
            title="Lock"
            metric="1 transaction · 1 approval"
            body="The sender approves the token and submits settlement terms. The contract holds the funds in escrow and asks the network for the reference rate."
          />
          <SolutionCard
            n="02"
            title="Decide"
            metric="5 validators · 3-of-5 quorum · 30s timeout"
            body="The Somnia Agent request reads the public rate source and returns a quorum-checked result before escrow release."
          />
          <SolutionCard
            n="03"
            title="Release or refund"
            metric="receipt on-chain · refund is automatic"
            body="Clear the minimum and funds release through the configured settlement vault with an on-chain receipt. Miss it and the sender is refunded."
          />
        </div>
      </section>

      {/* ───────────────────────── 5 · DIFFERENTIATORS ───────────────────────── */}
      <section className="section" id="compare">
        <div className="sectionHead">
          <span className="eyebrow">why not just…</span>
          <h2 className="sectionTitle">You already have options. Here is the difference.</h2>
        </div>
        <div className="cardGrid">
          <DiffCard
            vs="vs. manual OTC settlement"
            body="Teams agree on terms off-chain, then rely on screenshots, chats, or a private desk to prove the rate."
            edge="OmniRoute records the source, rate, and settlement result on-chain."
          />
          <DiffCard
            vs="vs. a private treasury tool"
            body="Internal systems can enforce policy, but counterparties cannot independently verify what happened."
            edge="The settlement rule is public, and the receipt is visible to both sides."
          />
          <DiffCard
            vs="vs. an AMM with a price feed"
            body="The feed is fast, but it is still a single external provider, and pool execution can slip outside the agreed terms."
            edge="The rate is checked through a Somnia Agent request, with an automatic refund if it misses your minimum."
          />
        </div>
      </section>

      {/* ───────────────────────── 6 · FAQ ───────────────────────── */}
      <section className="section" id="faq">
        <div className="sectionHead">
          <span className="eyebrow">before you trust settlement</span>
          <h2 className="sectionTitle">Questions you're probably asking.</h2>
        </div>
        <div className="faqList">
          <Faq q="What does it cost?">
            On testnet, settlement uses STT for gas and Somnia Agent request
            fees.
          </Faq>
          <Faq q="Do I need a crypto wallet to use this?">
            Yes. The current product is an EVM escrow flow. The sender connects
            a wallet, approves an ERC-20, and submits settlement terms.
          </Faq>
          <Faq q="What assets and pairs are supported?">
            The contract accepts ERC-20 tokens and a settlement pair string. The
            pair describes the reference rate being checked before escrow release.
          </Faq>
          <Faq q="How fast does settlement clear?">
            Escrow release happens after the Somnia Agent request returns a
            valid rate response, assuming the rate source responds inside the
            timeout.
          </Faq>
          <Faq q="What happens if the rate moves before it settles?">
            You set a minimum settlement output when you submit. If the
            agent-returned rate would release less than that minimum, the
            contract refunds the sender.
          </Faq>
          <Faq q="Where does the FX rate actually come from?">
            A public JSON source you specify when submitting settlement terms.
            Somnia Agents read that source and return the reference value used
            by the escrow. No private feed, no off-chain keeper.
          </Faq>
        </div>
      </section>

      {/* ───────────────────────── 7 · FINAL CTA ───────────────────────── */}
      <section className="finalCta">
        <span className="eyebrow">stop trusting the desk</span>
        <h2 className="finalCta__title">
          Settle stablecoins against a rate both sides can verify.
        </h2>
        <p className="finalCta__sub">
          You submit terms. The agent request returns the rate. Funds release
          through the configured settlement vault or return to the sender. Either
          way, the decision is on-chain.
        </p>
        <div className="finalCta__row">
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button className="cta" onClick={show}>
                Start settlement
              </button>
            )}
          </ConnectKitButton.Custom>
          <a className="cta cta--ghost" href="#how">
            How it settles
          </a>
        </div>
      </section>
    </main>
  );
}

/* ───────────────────────── components ───────────────────────── */

function ProblemCard({ title, body, fix }: { title: string; body: string; fix: string }) {
  return (
    <article className="card">
      <span className="card__mark card__mark--bad" aria-hidden>✗</span>
      <h3 className="card__title">{title}</h3>
      <p className="card__body">{body}</p>
      <div className="card__fix">
        <b>With OmniRoute:</b> {fix}
      </div>
    </article>
  );
}

function SolutionCard({ n, title, metric, body }: { n: string; title: string; metric: string; body: string }) {
  return (
    <article className="card">
      <span className="card__mark card__mark--num" aria-hidden>{n}</span>
      <h3 className="card__title">{title}</h3>
      <span className="card__metric">{metric}</span>
      <p className="card__body">{body}</p>
    </article>
  );
}

function DiffCard({ vs, body, edge }: { vs: string; body: string; edge: string }) {
  return (
    <article className="card">
      <span className="card__metric">{vs}</span>
      <p className="card__body">{body}</p>
      <div className="card__fix">
        <b>OmniRoute:</b> {edge}
      </div>
    </article>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="faq">
      <summary>
        {q}
        <span className="faq__plus" aria-hidden>+</span>
      </summary>
      <div className="faq__answer">{children}</div>
    </details>
  );
}
