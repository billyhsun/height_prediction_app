import json
import os
from dataclasses import dataclass

import httpx


@dataclass(frozen=True)
class LlmPredictionResult:
    pred_height_cm: float
    reasoning: str
    model_version: str
    model: str
    mid_parental_height_cm: float


def mid_parental_height_cm(sex: int, mother_cm: float, father_cm: float) -> float:
    if sex == 1:
        return (father_cm + mother_cm + 13) / 2
    return (father_cm + mother_cm - 13) / 2


def predict_height_llm(
    *,
    sex: int,
    height_cm: float,
    weight_kg: float,
    current_age_years: float,
    target_age_years: float,
    mother_height_cm: float,
    father_height_cm: float,
) -> LlmPredictionResult:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured")

    model = os.environ.get("OPENAI_MODEL", "gpt-5.4-mini")
    bmi = weight_kg / ((height_cm / 100) ** 2)
    mph = mid_parental_height_cm(sex, mother_height_cm, father_height_cm)
    sex_label = "male" if sex == 1 else "female"

    prompt = f"""Estimate a child's future height for an educational app.

Child:
- Sex: {sex_label}
- Current age: {current_age_years} years
- Current height: {height_cm} cm
- Current weight: {weight_kg} kg
- Current BMI: {bmi:.1f}
- Target age: {target_age_years} years

Parents:
- Mother height: {mother_height_cm} cm
- Father height: {father_height_cm} cm
- Mid-parental height (Tanner): {mph:.1f} cm

Use the child's current measurements, parent heights, and typical growth patterns.
Return JSON only with:
- pred_height_cm: predicted height in cm at target age (number)
- reasoning: 1-2 sentences explaining the estimate (string)
"""

    with httpx.Client(timeout=45.0) as client:
        response = client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that returns only valid JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.3,
            },
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]

    data = json.loads(content)
    pred_height = float(data["pred_height_cm"])
    reasoning = str(data.get("reasoning", "")).strip()

    if pred_height < 50 or pred_height > 250:
        raise ValueError("LLM returned an unrealistic height prediction")

    return LlmPredictionResult(
        pred_height_cm=pred_height,
        reasoning=reasoning or "Estimate based on child measurements and parent heights.",
        model_version="llm-v1",
        model=model,
        mid_parental_height_cm=mph,
    )
