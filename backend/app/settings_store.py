"""app_settings(키-값) 접근 헬퍼.

OpenAI API 키/모델을 .env가 아니라 DB로 관리한다. 라우터 간 순환 import를 피하기 위해
별도 모듈로 분리한다.
"""
from sqlalchemy.orm import Session

from app import models
from app.schemas import DEFAULT_OPENAI_MODEL

KEY_API = "openai_api_key"
KEY_MODEL = "openai_model"


def get_value(db: Session, key: str) -> str | None:
    row = db.get(models.AppSetting, key)
    return row.value if row else None


def set_value(db: Session, key: str, value: str | None) -> None:
    row = db.get(models.AppSetting, key)
    if row is None:
        db.add(models.AppSetting(key=key, value=value))
    else:
        row.value = value


def get_openai_config(db: Session) -> tuple[str | None, str]:
    """(api_key, model) 반환. 모델 미설정 시 기본값으로 폴백."""
    api_key = get_value(db, KEY_API)
    model = get_value(db, KEY_MODEL) or DEFAULT_OPENAI_MODEL
    return api_key, model
