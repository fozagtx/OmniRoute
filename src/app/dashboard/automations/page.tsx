"use client";

import { useEffect, useState } from "react";
import { readAutomationRuns, type AutomationRun } from "@/lib/automationRuns";

export default function AutomationsPage() {
  const [runs, setRuns] = useState<AutomationRun[]>([]);

  useEffect(() => {
    setRuns(readAutomationRuns());

    function onRuns(event: Event) {
      const nextRuns = event instanceof CustomEvent && Array.isArray(event.detail) ? event.detail : readAutomationRuns();
      setRuns(nextRuns);
    }

    window.addEventListener("omniroute:automation-runs", onRuns);
    window.addEventListener("storage", onRuns);
    return () => {
      window.removeEventListener("omniroute:automation-runs", onRuns);
      window.removeEventListener("storage", onRuns);
    };
  }, []);

  return (
    <section className="panel" aria-labelledby="automations-head">
      <header className="panel__head">
        <h1 id="automations-head" className="display">
          Automations
        </h1>
      </header>
      <div className="panel__body">
        {runs.length === 0 ? (
          <div className="empty automation-empty">No automation runs yet.</div>
        ) : (
          <div className="automation-list">
            {runs.map((run) => (
              <article className="automation-list__item" key={run.id}>
                <div>
                  <strong>{run.settlementPair}</strong>
                  <span className="mono">
                    {run.amount} {run.assetSymbol} / min {run.minOut}
                  </span>
                  {(run.targetRate || run.maxChecks) && (
                    <span className="mono">
                      target {run.targetRate ?? "not set"} / checks {run.maxChecks ?? "not set"}
                    </span>
                  )}
                </div>
                <span className="status-pill">{run.status === "ready" ? "ready" : "needs config"}</span>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
