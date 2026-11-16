import logging
import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import media
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.limits import BodySizeLimitMiddleware


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO)

    docs_enabled = not settings.is_production
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/api/docs" if docs_enabled else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if docs_enabled else None,
    )

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
            allow_headers=["Content-Type", "If-Match"],
            expose_headers=["ETag"],
        )

    # Added last, so it runs first (outermost user middleware).
    # Image uploads get their own cap (plus room for the multipart envelope);
    # the route itself enforces the exact file-size limit.
    upload_path = re.compile(re.escape(settings.api_v1_prefix) + r"/weddings/[^/]+/assets")
    app.add_middleware(
        BodySizeLimitMiddleware,
        max_body_bytes=settings.max_request_body_bytes,
        overrides=[("POST", upload_path, settings.max_upload_bytes + 64 * 1024)],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    app.include_router(media.router)
    return app


app = create_app()
