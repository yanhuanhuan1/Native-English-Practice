import type { Scenario } from "@/types/scenario";
import type { Attempt, InsightState } from "@/types/scoring";

const historyKey = "spoken-coach-history";
const generatedScenariosKey = "spoken-coach-generated-scenarios";
const attemptsKey = "spoken-coach-attempts";
const insightKey = "spoken-coach-insight";

export function loadHistory(): Attempt[] {
  return readJson<Attempt[]>(historyKey, []);
}

export function saveHistory(history: Attempt[]): void {
  writeJson(historyKey, history.slice(0, 30));
}

export function loadGeneratedScenarios(): Scenario[] {
  return readJson<Scenario[]>(generatedScenariosKey, []);
}

export function saveGeneratedScenarios(scenarios: Scenario[]): void {
  writeJson(generatedScenariosKey, scenarios.slice(0, 30));
}

export function loadAttempts(): Attempt[] {
  return readJson<Attempt[]>(attemptsKey, []);
}

export function appendAttempt(attempt: Attempt): Attempt[] {
  const all = loadAttempts();
  const next = [...all, attempt];
  writeJson(attemptsKey, next);
  return next;
}

export function loadInsight(): InsightState {
  return readJson<InsightState>(insightKey, { totalAttempts: 0, reports: [] });
}

export function saveInsight(state: InsightState): void {
  writeJson(insightKey, state);
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? (JSON.parse(rawValue) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}
