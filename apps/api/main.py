from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from llm_predictor import predict_height_llm
from prediction import PredictionInputs, SVREngine

API_DIR = Path(__file__).resolve().parent
load_dotenv(API_DIR / ".env")

MODELS_DIR = API_DIR.parents[1] / "packages" / "prediction" / "models" / "svr-v1"
engine = SVREngine(MODELS_DIR)


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine.load()
    yield


app = FastAPI(title="Child Height Predictor API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    sex: int = Field(..., description="1 = male, 2 = female")
    height_cm: float = Field(..., gt=0)
    weight_kg: float = Field(..., gt=0)
    current_age_years: float = Field(..., ge=0, le=18)
    target_age_years: float = Field(..., gt=0)


class LlmPredictRequest(PredictRequest):
    mother_height_cm: float = Field(..., ge=120, le=220)
    father_height_cm: float = Field(..., ge=120, le=220)
    ethnicities: list[str] | None = None


class PredictResponse(BaseModel):
    pred_height_cm: float
    pred_weight_kg: float
    pred_bmi: float
    target_age_years: float
    model_version: str


class LlmPredictResponse(BaseModel):
    pred_height_cm: float
    reasoning: str
    mid_parental_height_cm: float
    target_age_years: float
    model_version: str
    model: str


@app.get("/")
def root():
    return {
        "name": "Child Height Predictor API",
        "docs": "/docs",
        "health": "/health",
        "predict": "POST /api/v1/predict",
        "predict_llm": "POST /api/v1/predict/llm",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/v1/predict", response_model=PredictResponse)
def predict(body: PredictRequest):
    try:
        result = engine.predict(
            PredictionInputs(
                sex=body.sex,
                height_cm=body.height_cm,
                weight_kg=body.weight_kg,
                current_age_years=body.current_age_years,
                target_age_years=body.target_age_years,
            )
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return PredictResponse(
        pred_height_cm=result.pred_height_cm,
        pred_weight_kg=result.pred_weight_kg,
        pred_bmi=result.pred_bmi,
        target_age_years=result.target_age_years,
        model_version=result.model_version,
    )


@app.post("/api/v1/predict/llm", response_model=LlmPredictResponse)
def predict_llm(body: LlmPredictRequest):
    if body.target_age_years <= body.current_age_years:
        raise HTTPException(
            status_code=400,
            detail="target_age_years must be greater than current age",
        )

    try:
        result = predict_height_llm(
            sex=body.sex,
            height_cm=body.height_cm,
            weight_kg=body.weight_kg,
            current_age_years=body.current_age_years,
            target_age_years=body.target_age_years,
            mother_height_cm=body.mother_height_cm,
            father_height_cm=body.father_height_cm,
            ethnicities=body.ethnicities,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM prediction failed: {e}") from e

    return LlmPredictResponse(
        pred_height_cm=result.pred_height_cm,
        reasoning=result.reasoning,
        mid_parental_height_cm=result.mid_parental_height_cm,
        target_age_years=body.target_age_years,
        model_version=result.model_version,
        model=result.model,
    )
