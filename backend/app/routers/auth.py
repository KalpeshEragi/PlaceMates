from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import Profile, User
from app.security import COOKIE_NAME, create_token, current_user, encrypt

router = APIRouter(prefix="/auth", tags=["auth"])

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    # gmail.send lets us send the daily resumes email from the user's own Gmail.
    client_kwargs={"scope": "openid email profile https://www.googleapis.com/auth/gmail.send"},
)


@router.get("/google/login")
async def google_login(request: Request):
    redirect_uri = f"{settings.api_base}/auth/google/callback"
    # offline + consent so Google returns a refresh token for later sends.
    return await oauth.google.authorize_redirect(
        request, redirect_uri, access_type="offline", prompt="consent"
    )


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    info = token["userinfo"]

    user = db.scalar(select(User).where(User.google_sub == info["sub"]))
    if not user:
        user = User(google_sub=info["sub"], email=info["email"])
        db.add(user)
    user.name = info.get("name")
    user.avatar_url = info.get("picture")
    if token.get("refresh_token"):
        user.google_refresh_token = encrypt(token["refresh_token"])
    db.flush()

    if not user.profile:
        db.add(Profile(user_id=user.id, full_name=user.name, email=user.email, links=[]))
    db.commit()

    response = RedirectResponse(f"{settings.frontend_url}/profile")
    response.set_cookie(
        COOKIE_NAME,
        create_token(user.id),
        httponly=True,
        samesite="lax",
        secure=settings.api_base.startswith("https"),
        max_age=settings.jwt_ttl_days * 86400,
    )
    return response


@router.get("/me")
def me(user: User = Depends(current_user)):
    return {"id": str(user.id), "email": user.email, "name": user.name, "avatar_url": user.avatar_url}


@router.post("/logout")
def logout():
    response = RedirectResponse(settings.frontend_url, status_code=303)
    response.delete_cookie(COOKIE_NAME)
    return response
