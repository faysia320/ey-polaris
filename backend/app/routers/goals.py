from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.routers.utils import commit_or_conflict, get_or_404

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[schemas.GoalOut])
def list_goals(db: Session = Depends(get_db)):
    return db.scalars(select(models.Goal).order_by(models.Goal.id)).all()


@router.post("", response_model=schemas.GoalOut, status_code=201)
def create_goal(payload: schemas.GoalCreate, db: Session = Depends(get_db)):
    goal = models.Goal(**payload.model_dump())
    db.add(goal)
    commit_or_conflict(db, f"이미 존재하는 목표 이름입니다: {payload.name}")
    return goal


@router.put("/{goal_id}", response_model=schemas.GoalOut)
def update_goal(goal_id: int, payload: schemas.GoalUpdate, db: Session = Depends(get_db)):
    goal = get_or_404(db, models.Goal, goal_id, "목표")
    for key, value in payload.model_dump().items():
        setattr(goal, key, value)
    commit_or_conflict(db, f"이미 존재하는 목표 이름입니다: {payload.name}")
    return goal


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = get_or_404(db, models.Goal, goal_id, "목표")
    db.delete(goal)
    db.commit()
