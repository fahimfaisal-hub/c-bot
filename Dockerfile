FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY core_engine/ ./core_engine/
COPY api_server/ ./api_server/

# Run as a non-root user. UID 1000 matches the default first user on most
# Linux distros, so files this container creates in the ./data bind mount
# (vector store, SQLite db) are owned by your normal host user instead of
# root — avoiding "permission denied" / needing sudo to delete ./data.
RUN useradd --create-home --uid 1000 --shell /bin/bash appuser \
    && mkdir -p /app/data/vectorstore \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "api_server.main:app", "--host", "0.0.0.0", "--port", "8000"]
