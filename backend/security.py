"""Role scoped bearer credentials; fail closed if deployment has no credentials."""

import hmac
import time
import secrets
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sentinel_config import API_TOKENS, SERVICE_TOKEN

bearer = HTTPBearer(auto_error=False)
ROLES = {"viewer": 0, "operator": 1, "admin": 2}
tickets = {}


def token_role(token):
    if not token:
        return None
    for role, expected in API_TOKENS.items():
        if expected and hmac.compare_digest(token, expected):
            return role
    if SERVICE_TOKEN and hmac.compare_digest(token, SERVICE_TOKEN):
        return "service"
    return None


def identity(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    role = token_role(credentials.credentials if credentials else "")
    if role is None:
        raise HTTPException(
            401, "Authentication required", headers={"WWW-Authenticate": "Bearer"}
        )
    return role


def require(minimum="viewer", service=False):
    def check(role=Depends(identity)):
        allowed = service if role == "service" else ROLES[role] >= ROLES[minimum]
        if not allowed:
            raise HTTPException(403, "Insufficient permissions")
        return role

    return check


def rate_key(request: Request):
    return request.client.host if request.client else "unknown"


def issue_ticket():
    now = time.monotonic()
    for key in list(tickets):
        if tickets[key] < now:
            tickets.pop(key, None)
    if len(tickets) >= 1000:
        raise HTTPException(429, "Too many pending connections")
    ticket = secrets.token_urlsafe(32)
    tickets[ticket] = now + 30
    return ticket


def consume_ticket(ticket):
    return tickets.pop(ticket, 0) > time.monotonic()
