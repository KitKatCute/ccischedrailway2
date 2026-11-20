"""
smtp_check.py - find out WHICH step of the SMTP conversation fails.

Run from the backend folder (venv active):
    python smtp_check.py                      # connect / EHLO / STARTTLS / login only
    python smtp_check.py someone@example.com  # ...and also send a test email

Reads the same SMTP_* values as the app from backend/.env. Never prints the password.
"""
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

host = (os.environ.get("SMTP_HOST") or "smtp.gmail.com").strip()
port = int(os.environ.get("SMTP_PORT") or 587)
user = (os.environ.get("SMTP_USER") or "").strip()
pw = (os.environ.get("SMTP_PASSWORD") or "").replace(" ", "").strip()
to = sys.argv[1] if len(sys.argv) > 1 else None
use_ssl = port == 465

print(f"host={host} port={port} mode={'SSL' if use_ssl else 'STARTTLS'} user={user} "
      f"password_length={len(pw)}  (a Gmail app password is 16 characters)")
if "gmail" in host and len(pw) != 16:
    print("NOTE: that length is not 16, so this is probably not an app password.")


def step(name, fn):
    try:
        out = fn()
        print(f"[ OK ] {name}" + (f"  -> {out}" if out else ""))
        return True
    except Exception as exc:
        print(f"[FAIL] {name}: {type(exc).__name__}: {exc}")
        return False


ctx = ssl.create_default_context()
server = None


def connect():
    global server
    server = (smtplib.SMTP_SSL(host, port, timeout=15, context=ctx) if use_ssl
              else smtplib.SMTP(host, port, timeout=15))
    return "connected"


def ehlo():
    return server.ehlo()[0]


def starttls():
    return server.starttls(context=ctx)[0]


def login():
    return server.login(user, pw)[0]


def send():
    msg = EmailMessage()
    msg["Subject"], msg["From"], msg["To"] = "CCISched SMTP check", user, to
    msg.set_content("If you can read this, SMTP works.")
    server.send_message(msg)


steps = [("connect", connect), ("EHLO", ehlo)]
if not use_ssl:
    steps += [("STARTTLS", starttls), ("EHLO after STARTTLS", ehlo)]
steps.append(("login", login))
if to:
    steps.append((f"send to {to}", send))

ok = True
for name, fn in steps:
    if not step(name, fn):
        ok = False
        break

try:
    if server:
        server.quit()
except Exception:
    pass

print("\nAll steps passed." if ok else "\nStopped at the first failed step above.")
