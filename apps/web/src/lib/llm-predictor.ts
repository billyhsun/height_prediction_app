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

import { dictionaries } from "@/lib/i18n/dictionaries";
import { sanitizeEthnicities } from "@/lib/ethnicities";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
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
  ethnicities?: unknown;
};

export type LlmPredictionResult = {
  pred_height_cm: number;
  reasoning: string;
  mid_parental_height_cm: number;
  target_age_years: number;
  model_version: string;
  model: string;
};

export class LlmError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}

/** Tanner mid-parental target height. */
export function midParentalHeightCm(
  sex: number,
  motherCm: number,
  fatherCm: number,
): number {
  return sex === 1
    ? (fatherCm + motherCm + 13) / 2
    : (fatherCm + motherCm - 13) / 2;
}

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

function buildPrompt(inputs: LlmPredictionInputs, mph: number): string {
  const bmi = inputs.weight_kg / (inputs.height_cm / 100) ** 2;
  const sexLabel = inputs.sex === 1 ? "male" : "female";
  const ethnicities = formatEthnicities(inputs.ethnicities);
  const ethnicityLine = ethnicities ? `- Ethnicity: ${ethnicities}\n` : "";

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
- Mother height: ${inputs.mother_height_cm} cm
- Father height: ${inputs.father_height_cm} cm
- Mid-parental height (Tanner): ${mph.toFixed(1)} cm

Use the child's current measurements, parent heights, ethnicity (if provided), and typical growth patterns.
Return JSON only with:
- pred_height_cm: predicted height in cm at target age (number)
- reasoning: 1-2 sentences explaining the estimate (string)
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
    response = await fetch(OPENAI_URL, {
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
              "You are a helpful assistant that returns only valid JSON.",
          },
          { role: "user", content: buildPrompt(inputs, mph) },
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

  let parsed: { pred_height_cm?: unknown; reasoning?: unknown };
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

  return {
    pred_height_cm: predHeight,
    reasoning:
      reasoning || "Estimate based on child measurements and parent heights.",
    mid_parental_height_cm: mph,
    target_age_years: inputs.target_age_years,
    model_version: "llm-v1",
    model,
  };
}
