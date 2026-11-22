FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dev dependencies (pytest, httpx) are installed by default for local
# development; build with --build-arg INSTALL_DEV=false for a lean image.
ARG INSTALL_DEV=true
COPY requirements.txt requirements-dev.txt ./
RUN if [ "$INSTALL_DEV" = "true" ]; then pip install -r requirements-dev.txt; \
    else pip install -r requirements.txt; fi

RUN useradd --create-home --uid 1000 app
COPY --chown=app:app . .
# Uploaded images (a named volume is mounted here in docker-compose.yml).
RUN mkdir -p /app/media && chown app:app /app/media
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=3)"
ENTRYPOINT ["sh", "/app/entrypoint.sh"]
# --proxy-headers: client addresses come from X-Forwarded-For, but ONLY when the request
# comes from an address in $FORWARDED_ALLOW_IPS (uvicorn reads it; default 127.0.0.1).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
