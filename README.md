# Height Prediction App

A standalone app for predicting children's future height, weight, and BMI — built on the SVR models from the Kang Lee Lab [`lab-surveys`](https://github.com/) child BMI survey.

## Features (planned)

- User accounts with multiple child profiles
- Measurement history (height, weight, age over time)
- ML-powered predictions at a target age (default: 18 years)
- Growth charts and prediction comparison over time
- Future: LLM-generated explanations grounded on structured predictions

## Documentation

- **[System design](docs/design.md)** — architecture, data model, API, and phased rollout

## Repository structure

```
height_prediction_app/
├── apps/
│   ├── web/          # Next.js frontend (not yet scaffolded)
│   └── api/          # FastAPI backend (not yet scaffolded)
├── packages/
│   └── prediction/   # Shared ML library (not yet scaffolded)
├── docs/
│   └── design.md
└── docker-compose.yml
```

## Status

**Design phase.** See [docs/design.md](docs/design.md) for the implementation roadmap.

## Model source

Prediction models and methodology originate from:

> Yasin, Y., Sun, Y.H., and Lee, K. (2022). *A machine learning approach for predicting children's future BMI.* Canadian Developmental Psychology Conference.

Original implementation: `lab-surveys/backend/surveys/utils/child_bmi/`

## Disclaimer

This app provides informational estimates only. It is not a substitute for professional medical advice, diagnosis, or treatment.
