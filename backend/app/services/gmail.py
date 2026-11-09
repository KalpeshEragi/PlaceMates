"""Send an email from the student's own Gmail (gmail.send scope, granted at sign-in).

The refresh token is stored encrypted; each send exchanges it for a short-lived access token.
"""

import base64
from email.message import EmailMessage

import httpx

from app.config import settings
from app.models import User
from app.security import decrypt

TOKEN_URL = "https://oauth2.googleapis.com/token"
SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


class GmailError(Exception):
    pass


def _access_token(user: User) -> str:
    if not user.google_refresh_token:
        raise GmailError("No Gmail permission: sign in again with Google to allow sending")
    resp = httpx.post(TOKEN_URL, data={
        "client_id": settings.google_client_id, "client_secret": settings.google_client_secret,
        "refresh_token": decrypt(user.google_refresh_token), "grant_type": "refresh_token"}, timeout=30)
    if resp.status_code != 200:
        raise GmailError(f"Google token refresh failed ({resp.status_code}): {resp.text[:200]}")
    return resp.json()["access_token"]


def send(user: User, subject: str, html: str, text: str,
         attachments: list[tuple[str, bytes]] | None = None) -> str:
    """Send to the user's own address. attachments: (filename, pdf bytes). Returns the Gmail message id."""
    msg = EmailMessage()
    msg["To"] = user.email
    msg["From"] = user.email
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    for name, data in attachments or []:
        msg.add_attachment(data, maintype="application", subtype="pdf", filename=name)
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    resp = httpx.post(SEND_URL, headers={"Authorization": f"Bearer {_access_token(user)}"},
                      json={"raw": raw}, timeout=60)
    if resp.status_code != 200:
        raise GmailError(f"Gmail send failed ({resp.status_code}): {resp.text[:200]}")
    return resp.json().get("id", "")
