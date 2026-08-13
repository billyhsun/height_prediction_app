from __future__ import annotations

import pickle
from dataclasses import dataclass
from pathlib import Path

import pandas as pd


def calculate_bmi(weight_kg: float, height_cm: float) -> float:
    return weight_kg / ((height_cm / 100) ** 2)


@dataclass(frozen=True)
class PredictionInputs:
    sex: int  # 1 = male, 2 = female
    height_cm: float
    weight_kg: float
    current_age_years: float
    target_age_years: float

    def validate(self) -> None:
        if self.sex not in (1, 2):
            raise ValueError("sex must be 1 (male) or 2 (female)")
        if not (0 <= self.current_age_years <= 18):
            raise ValueError("current_age_years must be between 0 and 18")
        if self.target_age_years <= self.current_age_years:
            raise ValueError("target_age_years must be greater than current age")
        if not (40 <= self.height_cm <= 220):
            raise ValueError("height_cm must be between 40 and 220")
        if not (2 <= self.weight_kg <= 150):
            raise ValueError("weight_kg must be between 2 and 150")


@dataclass(frozen=True)
class PredictionOutputs:
    pred_height_cm: float
    pred_weight_kg: float
    pred_bmi: float
    target_age_years: float
    model_version: str


class SVREngine:
    MODEL_VERSION = "svr-v1"

    def __init__(self, models_dir: Path) -> None:
        self.models_dir = models_dir
        self._height_model = None
        self._weight_model = None
        self._bmi_model = None

    def load(self) -> None:
        self._height_model = self._load_model("childbmi_model_height.bin")
        self._weight_model = self._load_model("childbmi_model_weight.bin")
        self._bmi_model = self._load_model("childbmi_model_bmi.bin")

    def _load_model(self, filename: str):
        with open(self.models_dir / filename, "rb") as f:
            return pickle.load(f)

    def predict(self, inputs: PredictionInputs) -> PredictionOutputs:
        inputs.validate()
        if self._height_model is None:
            self.load()

        bmi = calculate_bmi(inputs.weight_kg, inputs.height_cm)
        features = pd.DataFrame(
            [
                {
                    "Sex": inputs.sex,
                    "Height": inputs.height_cm,
                    "Weight": inputs.weight_kg,
                    "Current age": inputs.current_age_years,
                    "Age to predict": inputs.target_age_years,
                    "BMI": bmi,
                }
            ]
        )

        return PredictionOutputs(
            pred_height_cm=float(self._height_model.predict(features)[0]),
            pred_weight_kg=float(self._weight_model.predict(features)[0]),
            pred_bmi=float(self._bmi_model.predict(features)[0]),
            target_age_years=inputs.target_age_years,
            model_version=self.MODEL_VERSION,
        )
