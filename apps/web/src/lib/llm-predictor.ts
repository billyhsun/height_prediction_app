/**
 * LLM height estimate, called server-side.
 *
 * This stays in the app: the Google Cloud backend serves the ML model only and
 * has no LLM layer. Ported from the previous Python function so that no Python
 * runtime is deployed to Vercel at all — the whole reason `requirements.txt`
 * existed was scikit-learn and pandas, and this path only ever needed an HTTP
 * call.
 *
 * OPENAI_API_KEY therefore remains a Vercel environment variable.
 */

import {
  DEFAULT_LOCALE,
  LOCALE_LANGUAGE_NAMES,
  type Locale,
} from "@notch/core";
import { dictionaries } from "@notch/core";
import { sanitizeEthnicities } from "@notch/core";
import { isStatureBand, midParentalHeightCm, type StatureBand } from "@notch/core";

/**
 * Overridable so the endpoint can be pointed at an Azure OpenAI deployment, a
 * gateway, or a local stub in tests. Defaults to OpenAI directly.
 */
function openAiUrl(): string {
  const base = process.env.OPENAI_BASE_URL?.replace(/\/+$/, "");
  return base
    ? `${base}/chat/completions`
    : "https://api.openai.com/v1/chat/completions";
}
const DEFAULT_MODEL = "gpt-5.4-mini";
const TIMEOUT_MS = 45_000;

export type LlmPredictionInputs = {
  sex: number;
  height_cm: number;
  weight_kg: number;
  current_age_years: number;
  target_age_years: number;
  mother_height_cm: number;
  father_height_cm: number;
  /** Optional, unlike the heights: parental build is a weaker and more variable
   *  signal than parental height, so it informs the estimate when supplied and
   *  is simply absent otherwise. */
  mother_weight_kg?: number;
  father_weight_kg?: number;
  ethnicities?: unknown;
  /** Language for the generated `reasoning`. Defaults to English. */
  locale?: Locale;
};

export type LlmPredictionResult = {
  pred_height_cm: number;
  reasoning: string;
  mid_parental_height_cm: number;
  target_age_years: number;
  model_version: string;
  model: string;
  /** Which language `reasoning` was generated in. Stored alongside the text so a
   *  reader can tell, since the wording is not re-generated when the UI language
   *  changes later. */
  reasoning_locale: Locale;
  /** Undefined when the model returned nothing recognisable. */
  stature_band?: StatureBand;
  /** Empty when the child's height is unremarkable for their age, which is the
   *  common case — the field exists to be absent most of the time. */
  guidance?: string;
};

export class LlmError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}

// Tanner mid-parental target height. Re-exported rather than redefined: the
// birth-prediction page rests on the same formula, and two copies of a
// constant-plus-halving is exactly the shape of thing that silently diverges.
export { midParentalHeightCm };

/**
 * English ethnicity labels for the prompt, read from the locale dictionary
 * rather than a second hardcoded map. The Python version kept its own copy,
 * which was one more place to forget when the options change.
 */
function formatEthnicities(values: unknown): string {
  const clean = sanitizeEthnicities(values);
  if (clean.length === 0) return "";
  const labels = dictionaries.en.ethnicity;
  return clean.map((value) => labels[value]).join(", ");
}

export function buildLlmPrompt(
  inputs: LlmPredictionInputs,
  mph: number,
): string {
  const language = LOCALE_LANGUAGE_NAMES[inputs.locale ?? DEFAULT_LOCALE];
  const bmi = inputs.weight_kg / (inputs.height_cm / 100) ** 2;
  const sexLabel = inputs.sex === 1 ? "male" : "female";
  const ethnicities = formatEthnicities(inputs.ethnicities);
  const ethnicityLine = ethnicities ? `- Ethnicity: ${ethnicities}\n` : "";

  // Each parent's weight is stated only when known, and paired with a BMI so the
  // number carries build rather than mass alone — 80 kg means something very
  // different at 160 cm than at 190 cm.
  const parentBuild = (heightCm: number, weightKg: number | undefined) =>
    weightKg
      ? ` (weight ${weightKg} kg, BMI ${(weightKg / (heightCm / 100) ** 2).toFixed(1)})`
      : "";

  return `Estimate a child's future height for an educational app.

Child:
- Sex: ${sexLabel}
- Current age: ${inputs.current_age_years} years
- Current height: ${inputs.height_cm} cm
- Current weight: ${inputs.weight_kg} kg
- Current BMI: ${bmi.toFixed(1)}
- Target age: ${inputs.target_age_years} years
${ethnicityLine}
Parents:
- Mother height: ${inputs.mother_height_cm} cm${parentBuild(inputs.mother_height_cm, inputs.mother_weight_kg)}
- Father height: ${inputs.father_height_cm} cm${parentBuild(inputs.father_height_cm, inputs.father_weight_kg)}
- Mid-parental height (Tanner): ${mph.toFixed(1)} cm

Use the child's current measurements, parent heights, ethnicity (if provided), and typical growth patterns.
Parental build, where given, is a secondary signal only: treat mid-parental height as the primary genetic anchor and do not let parental weight move the estimate far from it.
Return JSON only with:
- pred_height_cm: predicted height in cm at target age (number)
- reasoning: 1-2 sentences explaining the estimate (string)
- stature_band: how the child's CURRENT height of ${inputs.height_cm} cm compares with other ${sexLabel} children aged ${inputs.current_age_years}, against a standard growth reference (WHO or CDC). Exactly one of "below_average", "average", or "above_average" (string). Use "average" for roughly the middle 80% of children — that is the usual answer. Judge current height for current age only; do not use the predicted adult height.
- guidance: 1-2 sentences of general, everyday suggestions (string)

Rules for "guidance":
- Return an empty string when stature_band is "average". Most children need nothing here.
- Otherwise keep it general and non-clinical: sleep, balanced nutrition, physical activity.
- Where the child is well outside the usual range, say that a pediatrician can check whether the pattern is worth following up. Growth varies enormously between healthy children, so say so.
- Never diagnose, never name a condition, and never suggest medication, supplements, hormones, or any treatment.
- Being above or below average is not in itself a problem. Do not imply otherwise, and do not alarm the reader.

Write the "reasoning" and "guidance" values in ${language}. The JSON keys stay
exactly as named above in English, and "stature_band" keeps one of its three
English values — those are identifiers, not prose, and the app supplies its own
translated label for the band. Only the reader-facing text is translated. Use
units and number formatting natural to ${language}.
`;
}

export async function predictHeightLlm(
  inputs: LlmPredictionInputs,
): Promise<LlmPredictionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new LlmError("OPENAI_API_KEY is not configured", 503);
  }

  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const mph = midParentalHeightCm(
    inputs.sex,
    inputs.mother_height_cm,
    inputs.father_height_cm,
  );

  let response: Response;
  try {
    response = await fetch(openAiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that returns only valid JSON. Follow the language instruction in the user message for any human-readable text.",
          },
          { role: "user", content: buildLlmPrompt(inputs, mph) },
        ],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error("OpenAI request failed:", error);
    throw new LlmError(
      timedOut ? "The LLM request timed out" : "Could not reach the LLM service",
      timedOut ? 504 : 502,
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      (payload as { error?: { message?: string } } | null)?.error?.message ??
      `OpenAI returned ${response.status}`;
    console.error("OpenAI API error:", detail);
    throw new LlmError(`OpenAI API error: ${detail}`, 502);
  }

  const content = (
    payload as { choices?: { message?: { content?: string } }[] } | null
  )?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new LlmError("The LLM returned an empty response", 502);
  }

  let parsed: {
    pred_height_cm?: unknown;
    reasoning?: unknown;
    stature_band?: unknown;
    guidance?: unknown;
  };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new LlmError("The LLM returned malformed JSON", 502);
  }

  const predHeight = Number(parsed.pred_height_cm);
  if (!Number.isFinite(predHeight) || predHeight < 50 || predHeight > 250) {
    throw new LlmError("The LLM returned an unrealistic height prediction", 502);
  }

  const reasoning = String(parsed.reasoning ?? "").trim();

  // Dropped rather than defaulted when unrecognised: showing no band is honest,
  // whereas defaulting to "average" would state something the model did not say.
  const statureBand = isStatureBand(parsed.stature_band)
    ? parsed.stature_band
    : undefined;

  // Guidance rides on the band and never appears without one: suppressed for an
  // average child even if the model wrote something anyway, and suppressed when
  // the band was unusable, since advice with no stated assessment behind it is
  // exactly what this feature should not produce.
  const guidanceText = String(parsed.guidance ?? "").trim();
  const guidance =
    guidanceText && statureBand && statureBand !== "average"
      ? guidanceText
      : undefined;

  const locale = inputs.locale ?? DEFAULT_LOCALE;

  return {
    pred_height_cm: predHeight,
    // The fallback is only reached when the model returns no reasoning at all.
    // It is read from the locale dictionaries so it is not an English string
    // appearing in an otherwise translated response.
    reasoning: reasoning || dictionaries[locale].results.llmFallbackReasoning,
    mid_parental_height_cm: mph,
    target_age_years: inputs.target_age_years,
    model_version: "llm-v1",
    model,
    reasoning_locale: locale,
    stature_band: statureBand,
    guidance,
  };
}

/* -------------------------------------------------------------------------- */
/*  Birth-page explanation                                                     */
/* -------------------------------------------------------------------------- */

export type BirthExplanationInputs = {
  sex: number;
  status: "born" | "expecting";
  /** Absent for a baby not yet born, and optional even once it is. */
  birth_length_cm?: number;
  birth_weight_kg?: number;
  mother_height_cm: number;
  father_height_cm: number;
  /** The mid-parental estimate the app already computed and displayed. */
  predicted_adult_height_cm: number;
  locale?: Locale;
};

export type BirthExplanationResult = {
  reasoning: string;
  /** How the baby's size compares with other newborns. Absent when there are
   *  no birth measurements to compare. */
  birth_size_band?: StatureBand;
  /** How the predicted adult height compares with adults of the same sex. */
  adult_band?: StatureBand;
  model: string;
  model_version: string;
  reasoning_locale: Locale;
};

export function buildBirthPrompt(inputs: BirthExplanationInputs): string {
  const language = LOCALE_LANGUAGE_NAMES[inputs.locale ?? DEFAULT_LOCALE];
  const sexLabel = inputs.sex === 1 ? "boy" : "girl";

  const measured =
    inputs.status === "born" &&
    (inputs.birth_length_cm || inputs.birth_weight_kg)
      ? [
          inputs.birth_length_cm
            ? `- Birth length: ${inputs.birth_length_cm} cm`
            : null,
          inputs.birth_weight_kg
            ? `- Birth weight: ${inputs.birth_weight_kg} kg`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null;

  return `Explain a predicted adult height to a parent, for an educational app.

Baby:
- Sex: ${sexLabel}
- ${inputs.status === "born" ? "Already born" : "Not yet born"}
${measured ?? "- No birth measurements (nothing has been measured yet)"}

Parents:
- Mother height: ${inputs.mother_height_cm} cm
- Father height: ${inputs.father_height_cm} cm

The app has already estimated this child's adult height as
${inputs.predicted_adult_height_cm.toFixed(1)} cm, using the Tanner
mid-parental method. Do not produce a different number. Your job is to explain
this one.

Return JSON only with:
- adult_band: how ${inputs.predicted_adult_height_cm.toFixed(1)} cm compares with adult ${
    inputs.sex === 1 ? "men" : "women"
  } generally. Exactly one of "below_average", "average", or "above_average" (string). Use "average" for roughly the middle 80% of adults.
- birth_size_band: how this baby's birth size compares with other newborns of the same sex, against a standard reference. Exactly one of "below_average", "average", or "above_average", or an empty string if no birth measurements are given above.
- reasoning: 2-3 sentences (string). Say what the estimate is based on — the parents' heights — and what the band means in plain words. Where birth measurements exist, say how the baby's size at birth compares, and that birth size is a weak predictor of adult height.

Rules:
- Never diagnose, never name a condition, and never suggest medication, supplements, hormones or any treatment.
- Being above or below average is not a problem. Do not imply otherwise, and do not alarm the reader.
- Say that this is a range of likely outcomes rather than a fixed prediction.
- Do not invent measurements that were not given.

Write the "reasoning" value in ${language}. The JSON keys stay exactly as named
above in English, and the two band values keep their English identifiers — the
app supplies its own translated labels for them.
`;
}

/**
 * Narrative for the birth page.
 *
 * Deliberately produces no height of its own. The page already has an estimate
 * from a formula with a known spread, and a second number from a language model
 * would compete with it without being better — the whole value here is the
 * explanation, and the two bands that say where the child sits.
 */
export async function explainBirthPrediction(
  inputs: BirthExplanationInputs,
): Promise<BirthExplanationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new LlmError("OPENAI_API_KEY is not configured", 503);
  }

  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

  let response: Response;
  try {
    response = await fetch(openAiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that returns only valid JSON. Follow the language instruction in the user message for any human-readable text.",
          },
          { role: "user", content: buildBirthPrompt(inputs) },
        ],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error("OpenAI request failed:", error);
    throw new LlmError(
      timedOut ? "The LLM request timed out" : "Could not reach the LLM service",
      timedOut ? 504 : 502,
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      (payload as { error?: { message?: string } } | null)?.error?.message ??
      `OpenAI returned ${response.status}`;
    console.error("OpenAI API error:", detail);
    throw new LlmError(`OpenAI API error: ${detail}`, 502);
  }

  const content = (
    payload as { choices?: { message?: { content?: string } }[] } | null
  )?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new LlmError("The LLM returned an empty response", 502);
  }

  let parsed: {
    reasoning?: unknown;
    adult_band?: unknown;
    birth_size_band?: unknown;
  };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new LlmError("The LLM returned malformed JSON", 502);
  }

  const locale = inputs.locale ?? DEFAULT_LOCALE;
  const hasMeasurements =
    inputs.status === "born" &&
    Boolean(inputs.birth_length_cm || inputs.birth_weight_kg);

  return {
    reasoning: String(parsed.reasoning ?? "").trim(),
    // Dropped rather than defaulted when unrecognised: showing no band is
    // honest, defaulting to "average" would state something never said.
    adult_band: isStatureBand(parsed.adult_band) ? parsed.adult_band : undefined,
    // Suppressed outright when nothing was measured, whatever the model
    // returned — a band over measurements that do not exist is fabrication.
    birth_size_band:
      hasMeasurements && isStatureBand(parsed.birth_size_band)
        ? parsed.birth_size_band
        : undefined,
    model,
    model_version: "birth-llm-v1",
    reasoning_locale: locale,
  };
}
