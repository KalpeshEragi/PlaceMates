import uuid
from datetime import datetime, timedelta, timezone

import jwt
from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User

COOKIE_NAME = "pm_session"


def create_token(user_id: uuid.UUID) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=settings.jwt_ttl_days)
    return jwt.encode({"sub": str(user_id), "exp": exp}, settings.jwt_secret, algorithm="HS256")


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(401, "Not signed in")
    try:
        user_id = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])["sub"]
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid session")
    user = db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(401, "User not found")
    return user


def encrypt(value: str) -> str:
    return Fernet(settings.token_encryption_key).encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    return Fernet(settings.token_encryption_key).decrypt(value.encode()).decode()
