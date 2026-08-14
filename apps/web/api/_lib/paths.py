from pathlib import Path


def api_root() -> Path:
    return Path(__file__).resolve().parent.parent


def models_dir() -> Path:
    return api_root() / "models" / "svr-v1"
