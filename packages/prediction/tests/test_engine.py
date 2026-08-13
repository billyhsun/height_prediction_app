from pathlib import Path

import pytest

from prediction.engine import PredictionInputs, SVREngine

MODELS_DIR = Path(__file__).resolve().parents[1] / "models" / "svr-v1"


@pytest.fixture
def engine() -> SVREngine:
    return SVREngine(MODELS_DIR)


def test_predict_returns_expected_shape(engine: SVREngine) -> None:
    result = engine.predict(
        PredictionInputs(
            sex=1,
            height_cm=110,
            weight_kg=20,
            current_age_years=5,
            target_age_years=15,
        )
    )
    assert result.model_version == "svr-v1"
    assert result.target_age_years == 15
    assert 100 < result.pred_height_cm < 220
    assert 10 < result.pred_weight_kg < 100
    assert 10 < result.pred_bmi < 35


def test_target_age_must_exceed_current_age(engine: SVREngine) -> None:
    with pytest.raises(ValueError, match="target_age_years"):
        engine.predict(
            PredictionInputs(
                sex=1,
                height_cm=110,
                weight_kg=20,
                current_age_years=10,
                target_age_years=10,
            )
        )
