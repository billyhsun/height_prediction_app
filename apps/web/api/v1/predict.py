import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

_LIB = Path(__file__).resolve().parent.parent / "_lib"
if str(_LIB) not in sys.path:
    sys.path.insert(0, str(_LIB))

from engine import PredictionInputs, SVREngine  # noqa: E402
from paths import models_dir  # noqa: E402


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
            result = SVREngine.get(models_dir()).predict(
                PredictionInputs(
                    sex=int(body["sex"]),
                    height_cm=float(body["height_cm"]),
                    weight_kg=float(body["weight_kg"]),
                    current_age_years=float(body["current_age_years"]),
                    target_age_years=float(body["target_age_years"]),
                )
            )
            _send_json(
                self,
                200,
                {
                    "pred_height_cm": result.pred_height_cm,
                    "pred_weight_kg": result.pred_weight_kg,
                    "pred_bmi": result.pred_bmi,
                    "target_age_years": result.target_age_years,
                    "model_version": result.model_version,
                },
            )
        except (KeyError, TypeError, ValueError) as exc:
            _send_json(self, 400, {"detail": str(exc)})
        except Exception as exc:
            _send_json(self, 500, {"detail": str(exc)})
