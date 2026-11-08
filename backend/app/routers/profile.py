import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ItemFact, Profile, ProfileItem, Skill, User
from app.schemas import BasicsIn, FactIn, FactOut, ItemIn, ItemOut, ProfileOut
from app.security import current_user

router = APIRouter(prefix="/profile", tags=["profile"])


def _profile(user: User) -> Profile:
    if not user.profile:
        raise HTTPException(404, "Profile not found")
    return user.profile


def _own_item(db: Session, profile: Profile, item_id: uuid.UUID) -> ProfileItem:
    item = db.get(ProfileItem, item_id)
    if not item or item.profile_id != profile.id:
        raise HTTPException(404, "Item not found")
    return item


@router.get("", response_model=ProfileOut)
def get_profile(user: User = Depends(current_user)):
    return _profile(user)


@router.put("/basics", response_model=ProfileOut)
def update_basics(body: BasicsIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _profile(user)
    for key, value in body.model_dump().items():
        setattr(profile, key, value)
    db.commit()
    return profile


@router.put("/skills", response_model=ProfileOut)
def set_skills(names: list[str], user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _profile(user)
    existing = {s.name.lower(): s for s in profile.skills}
    wanted: dict[str, str] = {}
    for n in names:
        if n.strip():
            wanted.setdefault(n.strip().lower(), n.strip())  # keep the first spelling
    profile.skills = [existing.get(key) or Skill(name=name, source="manual") for key, name in wanted.items()]
    db.commit()
    return profile


@router.post("/items", response_model=ItemOut)
def add_item(body: ItemIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = _profile(user)
    item = ProfileItem(profile_id=profile.id, position=len(profile.items), **body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=ItemOut)
def update_item(item_id: uuid.UUID, body: ItemIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = _own_item(db, _profile(user), item_id)
    for key, value in body.model_dump().items():
        setattr(item, key, value)
    db.commit()
    return item


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own_item(db, _profile(user), item_id))
    db.commit()


@router.post("/items/{item_id}/facts", response_model=FactOut)
def add_fact(item_id: uuid.UUID, body: FactIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    item = _own_item(db, _profile(user), item_id)
    fact = ItemFact(item_id=item.id, **body.model_dump())
    db.add(fact)
    db.commit()
    db.refresh(fact)
    return fact


@router.delete("/facts/{fact_id}", status_code=204)
def delete_fact(fact_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    fact = db.get(ItemFact, fact_id)
    if not fact:
        raise HTTPException(404, "Fact not found")
    _own_item(db, _profile(user), fact.item_id)
    db.delete(fact)
    db.commit()
