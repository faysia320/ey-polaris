from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import schemas, settings_store
from app.database import get_db

router = APIRouter(prefix="/settings", tags=["settings"])


def _ai_settings_out(db: Session) -> schemas.AISettingsOut:
    api_key, model = settings_store.get_openai_config(db)
    # 보안 — 원문 키는 반환하지 않고 등록 여부와 끝 4자리 힌트만 노출
    hint = f"…{api_key[-4:]}" if api_key else None
    return schemas.AISettingsOut(model=model, api_key_set=bool(api_key), api_key_hint=hint)


@router.get("/ai", response_model=schemas.AISettingsOut)
def get_ai_settings(db: Session = Depends(get_db)):
    return _ai_settings_out(db)


@router.put("/ai", response_model=schemas.AISettingsOut)
def update_ai_settings(payload: schemas.AISettingsUpdate, db: Session = Depends(get_db)):
    # api_key가 비어 있거나(None/공백) 미포함이면 기존 키를 유지한다 — 매번 재입력 강요 방지
    if payload.api_key is not None and payload.api_key.strip():
        settings_store.set_value(db, settings_store.KEY_API, payload.api_key.strip())
    if payload.model is not None and payload.model.strip():
        settings_store.set_value(db, settings_store.KEY_MODEL, payload.model.strip())
    db.commit()
    return _ai_settings_out(db)
