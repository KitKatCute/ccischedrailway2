"""
routes/password_requests.py
---------------------------
Chairperson side of "Forgot password" (faculty file the request via
POST /api/auth/forgot-password).

GET  /api/manage/password-requests                     — pending requests (chairperson)
POST /api/manage/password-requests/<id>/reset          — reset the password; returns a one-time temporary password
POST /api/manage/password-requests/<id>/dismiss        — close the request without changing the password

The temporary password is returned in the response ONLY — it is hashed before
it is stored, never written to the audit log (the audit hook keeps request
bodies, not responses) and never put in a notification. The chairperson relays
it to the faculty member, who then changes it from their profile page.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

from flask import Blueprint, jsonify
from werkzeug.security import generate_password_hash

from database import db
from models import Notification, PasswordResetRequest
from routes.auth import current_user, login_required, role_required
from scope import in_scope

password_requests_bp = Blueprint(
    "password_requests", __name__, url_prefix="/api/manage/password-requests"
)

# No 0/O/1/l/I — the chairperson reads this out or types it into a message.
_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _temp_password(length: int = 10) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))


def _pending_or_error(request_id: int):
    req = db.session.get(PasswordResetRequest, request_id)
    if not req:
        return None, (jsonify({"error": "Request not found."}), 404)
    if not in_scope(current_user(), req.user):
        return None, (jsonify({"error": "Forbidden: this faculty belongs to another department."}), 403)
    if req.status != "pending":
        return None, (jsonify({"error": f"This request was already {req.status}."}), 409)
    return req, None


def _clear_request_notifications(faculty_user) -> None:
    """Once a request is handled, drop the chairperson notifications about it."""
    marker = f"({faculty_user.employee_number}) requested a password reset"
    for n in Notification.query.filter_by(notif_type="password_reset_request").all():
        if marker in (n.message or ""):
            db.session.delete(n)


@password_requests_bp.get("")
@login_required
@role_required("chairperson")
def list_pending():
    reqs = (
        PasswordResetRequest.query
        .filter_by(status="pending")
        .order_by(PasswordResetRequest.requested_at.asc())
        .all()
    )
    me = current_user()
    reqs = [r for r in reqs if in_scope(me, r.user)]   # own department only
    return jsonify({"requests": [r.to_dict() for r in reqs], "count": len(reqs)}), 200


@password_requests_bp.post("/<int:request_id>/reset")
@login_required
@role_required("chairperson")
def reset(request_id: int):
    req, err = _pending_or_error(request_id)
    if err:
        return err

    temp = _temp_password()
    req.user.password_hash = generate_password_hash(temp)
    req.status      = "completed"
    req.resolved_at = datetime.now(timezone.utc)
    req.resolved_by = current_user().id
    _clear_request_notifications(req.user)
    db.session.commit()

    return jsonify({
        "message":  "Password reset.",
        "request":  req.to_dict(),
        "password": temp,      # shown once so the chairperson can relay it
    }), 200


@password_requests_bp.post("/<int:request_id>/dismiss")
@login_required
@role_required("chairperson")
def dismiss(request_id: int):
    req, err = _pending_or_error(request_id)
    if err:
        return err

    req.status      = "dismissed"
    req.resolved_at = datetime.now(timezone.utc)
    req.resolved_by = current_user().id
    _clear_request_notifications(req.user)
    db.session.commit()
    return jsonify({"message": "Request dismissed.", "request": req.to_dict()}), 200
