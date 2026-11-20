"""
mailer.py
---------
Tiny email sender used for "Forgot password" (temporary password emails).
No extra dependencies — only the standard library.

Two providers (see MAIL_SETUP.md). If BOTH are configured, the first is used and the
second is an automatic fallback when the first fails:

  brevo   Sends over HTTPS through Brevo's API   (works on Railway: Railway blocks
                                                  outbound SMTP ports on its lower plans)
  smtp    Sends through any SMTP server, e.g. Gmail + an App Password

Order: MAIL_PROVIDER=brevo|smtp picks which one goes first. If it is not set, Brevo goes
first (when BREVO_API_KEY is set), then SMTP (when SMTP_HOST is set).

send_email() never raises — it returns True/False so the caller can fall back
(the forgot-password route falls back to the old "ask the chairperson" request
only when every configured provider has failed).
"""

from __future__ import annotations

import json
import os
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage
from email.utils import formataddr


def _env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


def _from_parts(which: str) -> tuple[str, str]:
    """(name, email) to send from, per provider.

    Brevo: MAIL_FROM_EMAIL (must be a sender verified in Brevo).
    SMTP:  SMTP_FROM_EMAIL, else MAIL_FROM_EMAIL, else SMTP_USER. With Gmail the
           address should be the Gmail account itself (SMTP_USER); Gmail rewrites others.
    """
    name = _env("MAIL_FROM_NAME", "CCISched")
    if which == "smtp":
        email = _env("SMTP_FROM_EMAIL") or _env("MAIL_FROM_EMAIL") or _env("SMTP_USER")
    else:
        email = _env("MAIL_FROM_EMAIL")
    return name, email


def _is_ready(which: str) -> bool:
    if which == "brevo":
        return bool(_env("BREVO_API_KEY")) and bool(_from_parts("brevo")[1])
    if which == "smtp":
        return bool(_env("SMTP_HOST")) and bool(_from_parts("smtp")[1])
    return False


def providers() -> list[str]:
    """Configured providers in the order they are tried."""
    first = _env("MAIL_PROVIDER").lower()
    order = ["brevo", "smtp"]
    if first in order:
        order.remove(first)
        order.insert(0, first)
    return [p for p in order if _is_ready(p)]


def is_configured() -> bool:
    return bool(providers())


def _send_brevo(to: str, subject: str, text: str, html: str | None) -> None:
    name, email = _from_parts("brevo")
    payload = {
        "sender":      {"name": name, "email": email},
        "to":          [{"email": to}],
        "subject":     subject,
        "textContent": text,
    }
    if html:
        payload["htmlContent"] = html
    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "api-key":      _env("BREVO_API_KEY"),
            "Content-Type": "application/json",
            "Accept":       "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        resp.read()


def _send_smtp(to: str, subject: str, text: str, html: str | None) -> None:
    name, email = _from_parts("smtp")
    host     = _env("SMTP_HOST")
    port     = int(_env("SMTP_PORT", "587") or 587)
    user     = _env("SMTP_USER")
    password = _env("SMTP_PASSWORD").replace(" ", "")   # Gmail shows app passwords in groups of 4
    security = _env("SMTP_SECURITY", "ssl" if port == 465 else "starttls").lower()

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"]    = formataddr((name, email))
    msg["To"]      = to
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    ctx = ssl.create_default_context()
    if security == "ssl":
        server = smtplib.SMTP_SSL(host, port, timeout=10, context=ctx)
    else:
        server = smtplib.SMTP(host, port, timeout=10)
    try:
        if security != "ssl":
            server.starttls(context=ctx)
        if user and password:
            server.login(user, password)
        server.send_message(msg)
    finally:
        try:
            server.quit()
        except Exception:
            pass


_SENDERS = {"brevo": _send_brevo, "smtp": _send_smtp}


def send_email(to: str, subject: str, text: str, html: str | None = None) -> bool:
    """Send one email. Tries each configured provider in order.

    Returns True as soon as one succeeds; False (and logs why) if all of them fail.
    """
    order = providers()
    if not order:
        print("[mailer] email is not configured (see backend/MAIL_SETUP.md) - not sending.")
        return False

    for which in order:
        try:
            _SENDERS[which](to, subject, text, html)
            if which != order[0]:
                print(f"[mailer] sent via {which} (fallback)")
            return True
        except urllib.error.HTTPError as exc:
            body = ""
            try:
                body = exc.read().decode("utf-8", "replace")[:300]
            except Exception:
                pass
            print(f"[mailer] {which} rejected the email: HTTP {exc.code} {body}")
        except Exception as exc:
            print(f"[mailer] could not send via {which}: {type(exc).__name__}: {exc}")
        if which != order[-1]:
            print("[mailer] trying the next provider...")
    return False


# ─────────────────────────────────────────────
#  Message templates
# ─────────────────────────────────────────────
def temp_password_message(first_name: str, temp_password: str, minutes: int) -> tuple[str, str, str]:
    """Returns (subject, text, html) for the temporary-password email."""
    subject = "CCISched - Your temporary password"
    text = (
        f"Hello {first_name},\n\n"
        f"We received a request to reset your CCISched password.\n\n"
        f"Temporary password: {temp_password}\n\n"
        f"It works for the next {minutes} minutes. Log in with it and you will be asked to "
        f"choose a new password right away.\n\n"
        f"Your old password keeps working until you use the temporary one. If you did not "
        f"request this, you can ignore this email.\n\n"
        f"- CCISched"
    )
    html = (
        f'<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:480px">'
        f'<h2 style="margin:0 0 12px">CCISched</h2>'
        f'<p>Hello {first_name},</p>'
        f'<p>We received a request to reset your CCISched password. Your temporary password is:</p>'
        f'<p style="font-size:22px;font-weight:700;letter-spacing:2px;background:#f3f4f6;'
        f'border:1px solid #d1d5db;border-radius:8px;padding:12px 16px;display:inline-block;'
        f'font-family:Consolas,monospace">{temp_password}</p>'
        f'<p>It works for the next <b>{minutes} minutes</b>. Log in with it and you will be '
        f'asked to choose a new password right away.</p>'
        f'<p style="color:#555;font-size:13px">Your old password keeps working until you use '
        f'the temporary one. If you did not request this, you can ignore this email.</p>'
        f'</div>'
    )
    return subject, text, html
