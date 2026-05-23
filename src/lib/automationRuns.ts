export type AutomationRunStatus = "ready" | "needs_config";

export type AutomationRun = {
  id: string;
  assetSymbol: string;
  amount: string;
  maxChecks?: string;
  minOut: string;
  settlementPair: string;
  status: AutomationRunStatus;
  targetRate?: string;
  createdAt: string;
};

const STORAGE_KEY = "omniroute.automationRuns";

export function createAutomationRun(input: Omit<AutomationRun, "id" | "createdAt">): AutomationRun {
  return {
    ...input,
    id: `run-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  };
}

export function readAutomationRuns(): AutomationRun[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAutomationRun(run: AutomationRun) {
  const runs = [run, ...readAutomationRuns()].slice(0, 12);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  window.dispatchEvent(new CustomEvent("omniroute:automation-runs", { detail: runs }));
  return runs;
}
