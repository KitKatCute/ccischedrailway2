"""
routes/auth.py
--------------
POST /api/auth/login       — email + password → session
POST /api/auth/forgot-password — faculty enters their email; a temporary password is emailed
POST /api/auth/set-new-password — choose a new password after logging in with a temporary one
POST /api/auth/logout      — clear session
GET  /api/auth/me          — return current logged-in user
"""

import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from database import db
from models import User
from audit import log_action

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

TEMP_PASSWORD_MINUTES  = 30     # how long an emailed temporary password works
RESEND_COOLDOWN_SECS   = 120    # min gap between temp-password emails to the same person
IP_MAX_REQUESTS        = 10     # forgot-password requests allowed per IP ...
IP_WINDOW_SECS         = 3600   # ... per hour (in-memory, per server process)
_ip_hits: dict[str, deque] = defaultdict(deque)


def _utcnow() -> datetime:
    """Naive UTC 'now' — the DB stores naive UTC datetimes."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _naive(dt: datetime | None) -> datetime | None:
    return dt.replace(tzinfo=None) if dt is not None and dt.tzinfo else dt


def _temp_valid(user: User) -> bool:
    exp = _naive(user.temp_password_expires)
    return bool(user.temp_password_hash and exp and exp > _utcnow())


def _clear_temp(user: User) -> None:
    user.temp_password_hash    = None
    user.temp_password_expires = None


def _client_ip() -> str:
    fwd = (request.headers.get("X-Forwarded-For") or "").split(",")[0].strip()
    return fwd or request.remote_addr or "unknown"


def _ip_throttled(ip: str) -> bool:
    now, q = time.time(), _ip_hits[ip]
    while q and now - q[0] > IP_WINDOW_SECS:
        q.popleft()
    if len(q) >= IP_MAX_REQUESTS:
        return True
    q.append(now)
    return False


# ── helpers ──────────────────────────────────
def current_user() -> User | None:
    uid = session.get("user_id")
    if not uid:
        return None
    return db.session.get(User, uid)


def login_required(fn):
    """Decorator — returns 401 if no active session."""
    from functools import wraps
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user():
            return jsonify({"error": "Unauthorized"}), 401
        return fn(*args, **kwargs)
    return wrapper


def role_required(*roles):
    """Decorator — returns 403 if user role not in allowed roles."""
    def decorator(fn):
        from functools import wraps
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({"error": "Unauthorized"}), 401
            if user.role not in roles:
                return jsonify({"error": "Forbidden"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ── routes ───────────────────────────────────
@auth_bp.post("/login")
def login():
    """
    Body: { "email": "...", "password": "..." }
    Returns: user object + role
    """
    body     = request.get_json(silent=True) or {}
    email    = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    user = User.query.filter_by(email=email).first()

    # Normal password first; otherwise an unexpired emailed temporary password.
    used_temp = False
    ok = bool(user) and check_password_hash(user.password_hash, password)
    if user and not ok and _temp_valid(user) and check_password_hash(user.temp_password_hash, password):
        ok = used_temp = True

    if not ok:
        # Log failed attempts too — attributed to the account if the email exists.
        log_action(user, "Failed login", category="auth", success=False, status_code=401,
                   user_name=email,
                   description=f"Failed login attempt for {email}")
        return jsonify({"error": "Invalid email or password."}), 401

    # Store minimal info in server-side session
    session["user_id"] = user.id
    session.permanent  = True

    if used_temp:
        # Everything except set-new-password is blocked until they choose a new one.
        session["must_change_password"] = True
    else:
        session.pop("must_change_password", None)
        if user.temp_password_hash:
            # They remembered their old password — the emailed one is no longer needed.
            _clear_temp(user)
            db.session.commit()

    log_action(user, "Logged in", category="auth", status_code=200,
               description=f"{user.first_name} {user.last_name} ({user.role}) logged in"
                           + (" with a temporary password" if used_temp else ""))

    return jsonify({
        "message": "Login successful.",
        "user":    user.to_dict(),
        "must_change_password": used_temp,
    }), 200


@auth_bp.post("/forgot-password")
def forgot_password():
    """
    Body: { "email": "..." }   (no session — the person can't log in)

    Emails the faculty member a temporary password (valid TEMP_PASSWORD_MINUTES).
    Their current password keeps working until the temporary one is used, so a
    stranger typing their email can't lock them out. The reply is always the same
    generic message, whether or not the email matches an account, so this can't be
    used to find out who has an account. Only faculty accounts can use it.

    If the email can't be sent (provider not configured / provider down), it falls
    back to the old behaviour: a request for the chairperson to action.
    """
    from models import PasswordResetRequest
    from notify import notify_password_reset_requested
    import mailer
    from routes.password_requests import _temp_password

    body  = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "Email is required."}), 400

    if _ip_throttled(_client_ip()):
        return jsonify({"error": "Too many requests. Please try again in a while."}), 429

    generic = {"message": "If that email belongs to a faculty account, a temporary password "
                          "has been emailed to it. It can take a few minutes to arrive - "
                          "check your spam folder, or ask your chairperson."}

    user = User.query.filter_by(email=email).first()
    if not user or user.role != "faculty":
        return jsonify(generic), 200

    now  = _utcnow()
    sent = _naive(user.temp_password_sent_at)
    if sent and (now - sent).total_seconds() < RESEND_COOLDOWN_SECS:
        return jsonify(generic), 200          # just sent one — don't spam their inbox

    temp = _temp_password()
    user.temp_password_hash    = generate_password_hash(temp)
    user.temp_password_expires = now + timedelta(minutes=TEMP_PASSWORD_MINUTES)
    user.temp_password_sent_at = now
    db.session.flush()

    subject, text, html = mailer.temp_password_message(user.first_name, temp, TEMP_PASSWORD_MINUTES)
    if mailer.send_email(user.email, subject, text, html):
        db.session.commit()
        log_action(user, "Requested password reset", category="auth", status_code=200,
                   description=f"{user.first_name} {user.last_name} requested a password reset "
                               f"(temporary password emailed)")
        return jsonify(generic), 200

    # Email failed → undo the temp password and hand the request to the chairperson instead.
    db.session.rollback()
    already = PasswordResetRequest.query.filter_by(user_id=user.id, status="pending").first()
    if not already:
        db.session.add(PasswordResetRequest(user_id=user.id))
        notify_password_reset_requested(user)
        db.session.commit()
        log_action(user, "Requested password reset", category="auth", status_code=200,
                   description=f"{user.first_name} {user.last_name} requested a password reset "
                               f"(email unavailable - sent to chairperson)")
    return jsonify(generic), 200


@auth_bp.post("/set-new-password")
@login_required
def set_new_password():
    """
    Body: { "new_password": "..." }

    Only for someone who just logged in with an emailed temporary password
    (no "current password" needed — they proved themselves by logging in).
    """
    user = current_user()
    if not session.get("must_change_password"):
        return jsonify({"error": "A password change isn't required for this session."}), 403

    new_pw = (request.get_json(silent=True) or {}).get("new_password") or ""
    if len(new_pw) < 6:
        return jsonify({"error": "New password must be at least 6 characters."}), 400
    if user.temp_password_hash and check_password_hash(user.temp_password_hash, new_pw):
        return jsonify({"error": "Choose a password different from the temporary one."}), 400

    user.password_hash = generate_password_hash(new_pw)
    _clear_temp(user)
    session.pop("must_change_password", None)
    db.session.commit()
    log_action(user, "Set new password", category="auth", status_code=200,
               description=f"{user.first_name} {user.last_name} set a new password after a reset")
    return jsonify({"message": "Password updated.", "user": user.to_dict()}), 200


@auth_bp.post("/logout")
def logout():
    user = current_user()
    if user:
        log_action(user, "Logged out", category="auth", status_code=200,
                   description=f"{user.first_name} {user.last_name} ({user.role}) logged out")
    session.clear()
    return jsonify({"message": "Logged out."}), 200


@auth_bp.get("/me")
@login_required
def me():
    """Return the currently authenticated user."""
    user = current_user()
    return jsonify({"user": user.to_dict()}), 200
