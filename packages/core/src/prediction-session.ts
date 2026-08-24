import type { LlmPredictResponse, PredictRequest, PredictResponse } from "./api";

export type PredictionSession = {
  inputs: PredictRequest;
  result: PredictResponse;
  llmResult?: LlmPredictResponse | null;
  llmError?: string | null;
  childId?: string | null;
};

const STORAGE_KEY = "height-prediction-result";

/**
 * Where a pending prediction is parked between the form and the results screen.
 *
 * This is a transient handoff, not persistence — which is why the interface is
 * synchronous and why an in-memory implementation is a legitimate one. That
 * matters for native, where the obvious storage (AsyncStorage) is async and
 * would otherwise force every caller to become async for no benefit.
 */
export type SessionStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

/** In-memory fallback, used when no web sessionStorage exists. */
function memoryStore(): SessionStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

let store: SessionStore | null = null;

/** Native clients may supply their own; the web needs no configuration. */
export function configureSessionStore(next: SessionStore): void {
  store = next;
}

function activeStore(): SessionStore {
  if (store) return store;
  // Web: use the real sessionStorage so behaviour is unchanged. Anywhere else,
  // fall back to memory rather than throwing.
  const candidate = (globalThis as { sessionStorage?: SessionStore }).sessionStorage;
  store = candidate ?? memoryStore();
  return store;
}

export function savePredictionSession(session: PredictionSession): void {
  activeStore().setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadPredictionSession(): PredictionSession | null {
  const raw = activeStore().getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PredictionSession;
  } catch {
    return null;
  }
}

export function inputsToSearchParams(inputs: PredictRequest): string {
  const params = new URLSearchParams();
  params.set("sex", String(inputs.sex));
  params.set("height_cm", String(inputs.height_cm));
  params.set("weight_kg", String(inputs.weight_kg));
  params.set("current_age_years", String(inputs.current_age_years));
  params.set("target_age_years", String(inputs.target_age_years));
  if (inputs.mother_height_cm) {
    params.set("mother_height_cm", String(inputs.mother_height_cm));
  }
  if (inputs.father_height_cm) {
    params.set("father_height_cm", String(inputs.father_height_cm));
  }
  return params.toString();
}

// sexLabel moved into the locale dictionaries (`common.male` / `common.female`)
// so it can be translated; callers read it from useTranslations().
