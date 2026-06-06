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
      <section className="hero">
        <div className="hero__inner">
          <div className="hero__copy">
            <h1 className="hero__title">
              Agentic prediction markets <em>on Somnia.</em>
            </h1>
            <p className="hero__sub">
              Create native STT markets, scope execution policy, request Somnia
              agent resolution, and inspect contract logs from the same deployed
              surface.
            </p>
            <div className="hero__cta">
              <ConnectKitButton.Custom>
                {({ show }) => (
                  <button className="cta" onClick={show}>
                    Open market console
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

      <section className="section">
        <div className="sectionHead">
          <span className="eyebrow">the hard part</span>
          <h2 className="sectionTitle">Prediction markets fail when resolution is theatrical.</h2>
        </div>
        <div className="cardGrid">
          <ProblemCard
            title="Policy hides outside the market"
            body="If the rule, market identifier, or resolver target lives only in app state, the interface proves little about the protocol."
            fix="the console reads market and policy state from the configured contract"
          />
          <ProblemCard
            title="Execution drifts from authority"
            body="A position must be tied to wallet stake, native credit, or a scoped policy that the contract enforces."
            fix="every action is submitted through the deployed market contract"
          />
          <ProblemCard
            title="Resolution lacks evidence"
            body="A winning outcome is noise unless the receipt and logs can be traced to the resolver path that produced it."
            fix="resolver output is stored on-chain and paired with receipt metadata"
          />
        </div>
      </section>

      <section className="section" id="how">
        <div className="sectionHead">
          <span className="eyebrow">flow</span>
          <h2 className="sectionTitle">Read. Execute. Resolve.</h2>
        </div>
        <div className="cardGrid">
          <SolutionCard
            n="01"
            title="Create market"
            metric="contract transaction"
            body="Submit the question, evidence URL, close time, and Parse Website instructions to the deployed market."
          />
          <SolutionCard
            n="02"
            title="Scope execution"
            metric="wallet transaction"
            body="Fund native credit, create a bounded policy, then stake directly or let the authorized executor act inside the cap."
          />
          <SolutionCard
            n="03"
            title="Resolve outcome"
            metric="agent callback"
            body="After market close, request Somnia LLM Parse Website resolution and read the stored outcome from contract state."
          />
        </div>
      </section>

      <section className="section" id="compare">
        <div className="sectionHead">
          <span className="eyebrow">guardrail</span>
          <h2 className="sectionTitle">The console is deliberately strict.</h2>
        </div>
        <div className="cardGrid">
          <DiffCard
            vs="empty state stays empty"
            body="Empty state means empty state. If the chain or endpoint has no data, the interface says so plainly."
            edge="Visible rows come from contract calls or logs."
          />
          <DiffCard
            vs="one contract surface"
            body="The deploy script, ABI binding, and dashboard all target SomniaPredictionMarket."
            edge="A wrong address blocks writes because the read calls cannot resolve."
          />
          <DiffCard
            vs="no identity detour"
            body="Wallet connection gates transactions only. Market policy, execution, and resolution remain the visible product path."
            edge="Identity scaffolding is not presented as market evidence."
          />
        </div>
      </section>

      <section className="section" id="faq">
        <div className="sectionHead">
          <span className="eyebrow">before execution</span>
          <h2 className="sectionTitle">Questions that change the outcome.</h2>
        </div>
        <div className="faqList">
          <Faq q="What must be configured?">
            A deployed `NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS` is required for
            the dashboard contract reads and writes.
          </Faq>
          <Faq q="Where does trade state live?">
            In `SomniaPredictionMarket`: markets, policies, native credit,
            positions, requests, receipts, and claims are contract state or
            emitted events.
          </Faq>
          <Faq q="Where does resolution data come from?">
            From the Somnia LLM Parse Website agent callback. The contract
            stores the output, response status, request id, and receipt id.
          </Faq>
          <Faq q="What logs are loaded?">
            Contract logs emitted by the configured market over the latest
            Somnia blocks returned by RPC.
          </Faq>
        </div>
      </section>

      <section className="finalCta">
        <span className="eyebrow">no masquerade</span>
        <h2 className="finalCta__title">Run the market path against real inputs.</h2>
        <p className="finalCta__sub">
          Configure the market contract, execute through your wallet, then
          inspect resolver state and on-chain logs. Missing chain data remains
          visibly absent.
        </p>
        <div className="finalCta__row">
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button className="cta" onClick={show}>
                Open market console
              </button>
            )}
          </ConnectKitButton.Custom>
          <a className="cta cta--ghost" href="#how">
            Review flow
          </a>
        </div>
      </section>
    </main>
  );
}

function ProblemCard({ title, body, fix }: { title: string; body: string; fix: string }) {
  return (
    <article className="card">
      <span className="card__mark card__mark--bad" aria-hidden>
        x
      </span>
      <h3 className="card__title">{title}</h3>
      <p className="card__body">{body}</p>
      <div className="card__fix">
        <b>Console rule:</b> {fix}
      </div>
    </article>
  );
}

function SolutionCard({ n, title, metric, body }: { n: string; title: string; metric: string; body: string }) {
  return (
    <article className="card">
      <span className="card__mark card__mark--num" aria-hidden>
        {n}
      </span>
      <h3 className="card__title">{title}</h3>
      <span className="card__metric">{metric}</span>
      <p className="card__body">{body}</p>
    </article>
  );
}

function DiffCard({ vs, body, edge }: { vs: string; body: string; edge: string }) {
  return (
    <article className="card card--diff">
      <span className="eyebrow">{vs}</span>
      <p className="card__body">{body}</p>
      <div className="card__fix">
        <b>Market console:</b> {edge}
      </div>
    </article>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="faq">
      <summary>{q}</summary>
      <p>{children}</p>
    </details>
  );
}
