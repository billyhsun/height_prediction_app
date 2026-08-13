#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
python3 -m pip install -q -r apps/api/requirements.txt scikit-learn==1.0.2 pandas
if [ -f apps/api/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source apps/api/.env
  set +a
fi
PYTHONPATH="packages/prediction/src:apps/api" python3 -m uvicorn main:app --app-dir apps/api --reload --host 0.0.0.0 --port 8000
