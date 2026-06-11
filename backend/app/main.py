from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    accounts,
    analytics,
    budgets,
    categories,
    goals,
    members,
    transactions,
    valuations,
)

app = FastAPI(
    title="으니영이의 북극성 API",
    description="부부 가계부 '으니영이의 북극성' 백엔드 API",
    version="0.1.0",
)

# 로컬 개발(vite dev server) 편의용 — docker 구성에서는 nginx가 동일 출처로 프록시한다
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api/v1")
api.include_router(members.router)
api.include_router(accounts.router)
api.include_router(categories.router)
api.include_router(transactions.router)
api.include_router(valuations.router)
api.include_router(budgets.router)
api.include_router(goals.router)
api.include_router(analytics.router)


@api.get("/health", tags=["health"])
def health():
    return {"status": "ok", "app": "ey-polaris"}


app.include_router(api)
