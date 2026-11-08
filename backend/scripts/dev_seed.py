"""Create (or reset) a local dev user with a sample profile and print a session token.

Usage: python -m scripts.dev_seed
Then in the browser on localhost:3000, set the cookie: pm_session=<token>
"""

from sqlalchemy import select

from app.db import Base, SessionLocal, engine
from app.models import Profile, User
from app.schemas import ParsedResume
from app.security import create_token
from app.services.resume_import import merge_into_profile

SAMPLE = {
    "basics": {"full_name": "Riya Sharma", "email": "riya@example.com", "location": "Pune"},
    "skills": ["Go", "Node.js", "MongoDB", "React", "SQL", "Python"],
    "items": [
        {"kind": "experience", "title": "Backend Intern", "organization": "Razorpay",
         "start_date": "May 2024", "end_date": "Jul 2024",
         "bullets": ["Worked on payment reconciliation service", "Wrote unit tests in Go"], "tech": ["Go"]},
        {"kind": "project", "title": "Shop API",
         "bullets": ["Built REST APIs for orders and products", "Added JWT auth"], "tech": ["Node.js", "MongoDB"]},
        {"kind": "project", "title": "Crop Disease Detector",
         "bullets": ["Made a CNN model to detect plant diseases from leaf images"], "tech": ["Python", "TensorFlow"]},
        {"kind": "experience", "title": "Event Volunteer", "organization": "NSS COEP",
         "bullets": ["Helped organise blood donation camp"]},
        {"kind": "education", "title": "B.Tech Computer Engineering", "organization": "COEP Pune",
         "start_date": "2021", "end_date": "2025", "bullets": ["CGPA 8.4"]},
    ],
}


def main() -> None:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    old = db.scalar(select(User).where(User.google_sub == "dev-seed"))
    if old:
        db.delete(old)
        db.commit()
    user = User(google_sub="dev-seed", email="riya@example.com", name="Riya Sharma")
    db.add(user)
    db.flush()
    profile = Profile(user_id=user.id, links=[])
    db.add(profile)
    db.commit()
    merge_into_profile(db, profile, ParsedResume.model_validate(SAMPLE))
    print(create_token(user.id))


if __name__ == "__main__":
    main()
