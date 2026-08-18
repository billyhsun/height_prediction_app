/**
 * Server-side client for the ML prediction backend (lab-surveys-backend on
 * Google Cloud).
 *
 * The model used to run in-process as a Python serverless function on Vercel,
 * which dragged scikit-learn, pandas, scipy and numpy into the deployment. It
 * now lives behind HTTP, so this file is the only thing that needs to know the
 * upstream shape.
 *
 * That upstream is a Django *survey* platform, not a purpose-built prediction
 * service, so its contract differs from ours in several ways and this module
 * translates between them:
 *
 *   - the endpoint is `POST /surveys/results`, dispatched by a `survey` field
 *   - inputs are title-case keys with spaces: `Sex`, `Current age`, …
 *   - outputs are `pred_height` / `pred_weight` / `pred_bmi`, with no units
 *     suffix and no model version
 *   - `duration` is read unconditionally, so omitting it produces a 500
 *   - every internal failure collapses to a generic 500, so useful validation
 *     errors have to be produced here rather than forwarded
 *
 * Called only from route handlers, never the browser, so the URL and any
 * credential stay server-side, the service can remain private, and it needs no
 * CORS configuration.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

/** Survey id the upstream platform dispatches on. */
const SURVEY_ID = "child_bmi";

export type PredictionInputs = {
  sex: number;
  height_cm: number;
  weight_kg: number;
  current_age_years: number;
  target_age_years: number;
};

export type PredictionResult = {
  pred_height_cm: number;
  pred_weight_kg: number;
  pred_bmi: number;
  target_age_years: number;
  model_version: string;
};

export class UpstreamError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

/** Raised for bad caller input; always surfaced as a 400. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Ported from `PredictionInputs.validate()` in packages/prediction.
 *
 * This has to live here now. The upstream turns every internal exception into
 * "There was an error while calculating the survey results" with a 500, so
 * without this a bad height would reach the user as an opaque server error
 * instead of the specific message the form used to show.
 */
export function validateInputs(raw: Record<string, unknown>): PredictionInputs {
  const num = (key: string): number => {
    const value = Number(raw[key]);
    if (!Number.isFinite(value)) {
      throw new ValidationError(`${key} must be a number`);
    }
    return value;
  };

  const inputs: PredictionInputs = {
    sex: num("sex"),
    height_cm: num("height_cm"),
    weight_kg: num("weight_kg"),
    current_age_years: num("current_age_years"),
    target_age_years: num("target_age_years"),
  };

  if (inputs.sex !== 1 && inputs.sex !== 2) {
    throw new ValidationError("sex must be 1 (male) or 2 (female)");
  }
  if (inputs.current_age_years < 0 || inputs.current_age_years > 18) {
    throw new ValidationError("current_age_years must be between 0 and 18");
  }
  if (inputs.target_age_years <= inputs.current_age_years) {
    throw new ValidationError("target_age_years must be greater than current age");
  }
  if (inputs.height_cm < 40 || inputs.height_cm > 220) {
    throw new ValidationError("height_cm must be between 40 and 220");
  }
  if (inputs.weight_kg < 2 || inputs.weight_kg > 150) {
    throw new ValidationError("weight_kg must be between 2 and 150");
  }

  return inputs;
}

/**
 * Builds the results URL, accepting either form of PREDICTION_API_URL.
 *
 * The Cloud Run URL is naturally quoted with the `/surveys` prefix already
 * attached, so both of these resolve to the same endpoint rather than one of
 * them silently producing `/surveys/surveys/results`:
 *
 *   https://host.run.app           -> https://host.run.app/surveys/results
 *   https://host.run.app/surveys   -> https://host.run.app/surveys/results
 */
function upstreamUrl(): string {
  const configured = process.env.PREDICTION_API_URL;
  if (!configured) {
    throw new UpstreamError("PREDICTION_API_URL is not configured", 503);
  }
  const base = configured.replace(/\/+$/, "");
  return base.endsWith("/surveys")
    ? `${base}/results`
    : `${base}/surveys/results`;
}

/**
 * Pulls a message out of an upstream error body. The survey platform replies
 * with `{"message": "..."}`; `detail` is also checked so a future FastAPI-shaped
 * backend keeps working without a change here.
 */
function messageFromBody(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback;
  const record = body as { message?: unknown; detail?: unknown };
  if (typeof record.message === "string") return record.message;
  if (typeof record.detail === "string") return record.detail;
  if (Array.isArray(record.detail)) {
    const joined = record.detail
      .map((entry) => (entry as { msg?: string })?.msg)
      .filter(Boolean)
      .join(", ");
    if (joined) return joined;
  }
  return fallback;
}

export async function predict(
  inputs: PredictionInputs,
): Promise<PredictionResult> {
  const url = upstreamUrl();

  // Set only when the backend is not publicly invocable. An IAM-protected Cloud
  // Run service needs a per-request Google ID token instead of a static value —
  // see docs/prediction-api.md.
  const token = process.env.PREDICTION_API_TOKEN;

  const payload = {
    survey: SURVEY_ID,
    data: {
      Sex: inputs.sex,
      Height: inputs.height_cm,
      Weight: inputs.weight_kg,
      "Current age": inputs.current_age_years,
      "Age to predict": inputs.target_age_years,
      // BMI is intentionally omitted: the upstream computes it from Height and
      // Weight before running the models.
    },
    // Read unconditionally by the survey view; a missing value is a 500. We are
    // not a timed survey, so zero is the honest value.
    duration: 0,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error("Prediction backend request failed:", error);
    throw new UpstreamError(
      timedOut
        ? "The prediction service timed out"
        : "The prediction service is unreachable",
      timedOut ? 504 : 502,
    );
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = messageFromBody(body, "Prediction failed");
    const status =
      response.status >= 400 && response.status < 500 ? response.status : 502;
    if (status >= 500) {
      console.error(`Prediction backend ${response.status}:`, message);
    }
    throw new UpstreamError(message, status);
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const height = Number(record.pred_height);
  const weight = Number(record.pred_weight);
  const bmi = Number(record.pred_bmi);

  if (![height, weight, bmi].every(Number.isFinite)) {
    console.error("Prediction backend returned an unexpected body:", body);
    throw new UpstreamError(
      "The prediction service returned an unexpected response",
      502,
    );
  }

  return {
    pred_height_cm: height,
    pred_weight_kg: weight,
    pred_bmi: bmi,
    target_age_years: inputs.target_age_years,
    // The upstream does not report which model produced this, so the version is
    // configured here. Every stored prediction records it, so it must stay
    // accurate when the backend's model changes.
    model_version: process.env.PREDICTION_MODEL_VERSION ?? "svr-v1",
  };
}
