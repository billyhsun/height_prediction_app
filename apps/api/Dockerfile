FROM python:3.11-slim

WORKDIR /app

COPY packages/prediction /app/packages/prediction
COPY apps/api/requirements.txt /app/apps/api/requirements.txt

RUN pip install --no-cache-dir -e /app/packages/prediction -r /app/apps/api/requirements.txt

COPY apps/api /app/apps/api

ENV PYTHONPATH=/app/packages/prediction/src

CMD ["uvicorn", "main:app", "--app-dir", "apps/api", "--host", "0.0.0.0", "--port", "8000"]
