"""Authenticate before multipart parsing; use Starlette's streamed body limit."""

from starlette.middleware.body_limit import RequestBodyLimitMiddleware
from starlette.responses import JSONResponse
from backend.security import token_role


class BodyLimitMiddleware(RequestBodyLimitMiddleware):
    def __init__(self, app, max_bytes):
        super().__init__(app, max_body_size=max_bytes)

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] == "http"
            and scope["path"].startswith("/api/")
            and scope["method"] != "OPTIONS"
        ):
            header = dict(scope["headers"]).get(b"authorization", b"").decode("latin1")
            role = token_role(header[7:] if header.startswith("Bearer ") else "")
            if role is None:
                return await JSONResponse(
                    {"detail": "Authentication required"}, status_code=401
                )(scope, receive, send)
        return await super().__call__(scope, receive, send)
