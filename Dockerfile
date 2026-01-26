FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml /app/
RUN pip install --no-cache-dir -e .

COPY app /app/app

CMD ["fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8000"]
