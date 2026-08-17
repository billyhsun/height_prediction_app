import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

_LIB = Path(__file__).resolve().parent.parent.parent / "_lib"
if str(_LIB) not in sys.path:
    sys.path.insert(0, str(_LIB))

from llm_predictor import predict_height_llm  # noqa: E402


def _read_json(handler: BaseHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length", 0))
    if length == 0:
        return {}
    body = handler.rfile.read(length)
    return json.loads(body.decode("utf-8"))


def _send_json(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.end_headers()
    handler.wfile.write(json.dumps(payload).encode("utf-8"))


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            body = _read_json(self)
            current_age = float(body["current_age_years"])
            target_age = float(body["target_age_years"])
            if target_age <= current_age:
                raise ValueError("target_age_years must be greater than current age")

            result = predict_height_llm(
                sex=int(body["sex"]),
                height_cm=float(body["height_cm"]),
                weight_kg=float(body["weight_kg"]),
                current_age_years=current_age,
                target_age_years=target_age,
                mother_height_cm=float(body["mother_height_cm"]),
                father_height_cm=float(body["father_height_cm"]),
                ethnicities=body.get("ethnicities"),
            )
            _send_json(
                self,
                200,
                {
                    "pred_height_cm": result.pred_height_cm,
                    "reasoning": result.reasoning,
                    "mid_parental_height_cm": result.mid_parental_height_cm,
                    "target_age_years": target_age,
                    "model_version": result.model_version,
                    "model": result.model,
                },
            )
        except (KeyError, TypeError, ValueError) as exc:
            _send_json(self, 400, {"detail": str(exc)})
        except Exception as exc:
            _send_json(self, 502, {"detail": f"LLM prediction failed: {exc}"})
