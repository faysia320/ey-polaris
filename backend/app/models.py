from datetime import date as date_type
from datetime import datetime
from datetime import time as time_type

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Member(Base):
    """가족 구성원 태그 (로그인 없음 — 거래의 주체 표시용)."""

    __tablename__ = "members"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    color: Mapped[str] = mapped_column(String(20), default="#a78bfa")


class Account(Base):
    """자산 계정 (은행/현금/카드/투자 등). 현재 잔액은 opening_balance + 거래 합산으로 계산.

    소유자(member_id)는 필수 — 구성원별 자산 필터의 기준. 공동 계정 개념은 없다.
    """

    __tablename__ = "accounts"
    # 이름은 그 자체로 유일 키가 아니다 — 시스템 키는 id(PK)이며, 이름 중복은
    # 소유자(member_id)·유형(type)까지 모두 같을 때만 성립한다(다른 소유자/유형이면 동명 허용).
    __table_args__ = (
        UniqueConstraint("name", "member_id", "type", name="uq_accounts_name_member_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    # bank | cash | card | easy_pay | e_money | investment | stock | real_estate | deposit | loan | other
    # e_money(전자금융자산: 네이버페이·상품권 등 선불 충전형, 자체 잔액 보유)
    # deposit(보증금: 전세·임차 보증금 등 고정 금액 자산) | loan(대출: 부채 — 음수 잔액으로 총자산 차감)
    type: Mapped[str] = mapped_column(String(20))
    opening_balance: Mapped[int] = mapped_column(BigInteger, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id", ondelete="RESTRICT"))
    # 간편결제(easy_pay) 전용 기본 연결 계정 — 실제 결제가 빠지는 카드/은행 계정.
    # easy_pay가 아니면 항상 NULL이며, easy_pay라도 선택(NULL 허용)이다.
    # 집계 시 easy_pay 거래의 net·지출은 이 연결 계정으로 귀속된다(패스스루). 단
    # 거래에 건별 지정(Transaction.linked_account_id)이 있으면 그쪽이 우선한다.
    linked_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=True
    )

    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="account", foreign_keys="Transaction.account_id"
    )
    member: Mapped["Member"] = relationship()
    linked_account: Mapped["Account | None"] = relationship(
        remote_side=[id], foreign_keys=[linked_account_id]
    )


class Category(Base):
    """수입/지출 카테고리 — 대분류(major)/소분류(minor) 2단계.

    뱅크샐러드 엑셀 분류 체계와 일치시킨다. 소분류가 없으면 '미분류'.
    nature: fixed(정기 궤도) | variable(유성우).
    """

    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("major", "minor", "kind", name="uq_categories_major_minor_kind"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    major: Mapped[str] = mapped_column(String(100))  # 대분류
    minor: Mapped[str] = mapped_column(String(100), default="미분류")  # 소분류
    kind: Mapped[str] = mapped_column(String(10))  # income | expense | transfer
    nature: Mapped[str] = mapped_column(String(10), default="variable")  # fixed | variable

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="category")

    @property
    def display_name(self) -> str:
        """표시명 — 소분류가 '미분류'면 대분류만."""
        return self.major if self.minor == "미분류" else f"{self.major} > {self.minor}"


class TransactionLink(Base):
    """이미 저장된 두 거래(수입 1 + 지출 1)를 사후에 하나로 묶는 연결 그룹.

    원본 거래는 보존하고 link_id로만 연결한다 — 병합/삭제가 아니라 '묶음 표시'다.
    link_type:
      transfer — 서로 다른 계정 간 이동. 두 다리 모두 수입/지출 통계에서 제외한다.
      refund   — 카드 결제(지출) + 환불(수입). 지출에서 환불액을 차감한 순지출만 통계에 반영.
    잔액/자산 추이는 원본 income/expense가 이미 각 계정에 ±반영하므로 별도 보정하지 않는다.
    """

    __tablename__ = "transaction_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    link_type: Mapped[str] = mapped_column(String(10))  # transfer | refund
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # 이 묶음에 속한 거래들(수입 1 + 지출 1). 병합 행/묶음 보기가 파트너 다리 요약을
    # 뽑을 때 사용 — 파트너가 현재 조회 필터 밖(다른 달)이어도 함께 로드된다.
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="link")


class Transaction(Base):
    """수입/지출/이체 거래. 금액은 KRW 정수(원 단위), 항상 양수이며 kind로 방향을 구분.

    이체(transfer)는 account_id가 출금 계정, counter_account_id가 입금 계정이며
    수입/지출 통계에는 포함되지 않고 두 계정 잔액에만 ±반영된다.
    """

    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date_type] = mapped_column(Date, index=True)
    # 거래 시각 — 엑셀 "시간" 컬럼에서 채운다. 수동/과거 거래는 미지정(NULL) 허용
    time: Mapped[time_type | None] = mapped_column(Time, nullable=True)
    amount: Mapped[int] = mapped_column(BigInteger)
    kind: Mapped[str] = mapped_column(String(10))  # income | expense | transfer
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="RESTRICT"))
    # 이체 전용 — 입금 계정. 수입/지출 거래에서는 항상 NULL
    counter_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=True
    )
    # 간편결제 거래 전용 건별 연결 계정 — 이 건의 실제 결제가 빠지는 카드/은행 계정.
    # account_id가 easy_pay 계정일 때만 채울 수 있고, 집계 라우팅에서 계정 기본 연결
    # (Account.linked_account_id)보다 우선한다. 같은 간편결제라도 건마다 결제 카드가
    # 다를 수 있어 계정에 고정하지 않는다.
    # 알려진 한계: 이체(transfer)의 입금 다리(counter_account_id)가 간편결제인 경우는
    # 건별 지정 대상이 아니며 계정 기본 연결만 적용된다.
    linked_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=True
    )
    member_id: Mapped[int | None] = mapped_column(
        ForeignKey("members.id", ondelete="SET NULL"), nullable=True
    )
    memo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source: Mapped[str] = mapped_column(String(10), default="manual")  # manual | import
    # 사후 묶음(이체/환불) 연결 — NULL이면 묶이지 않은 독립 거래. 그룹 해제 시 SET NULL로 복원
    link_id: Mapped[int | None] = mapped_column(
        ForeignKey("transaction_links.id", ondelete="SET NULL"), nullable=True, index=True
    )

    category: Mapped["Category"] = relationship(back_populates="transactions")
    account: Mapped["Account"] = relationship(
        back_populates="transactions", foreign_keys=[account_id]
    )
    counter_account: Mapped["Account | None"] = relationship(foreign_keys=[counter_account_id])
    linked_account: Mapped["Account | None"] = relationship(foreign_keys=[linked_account_id])
    member: Mapped["Member | None"] = relationship()
    link: Mapped["TransactionLink | None"] = relationship(back_populates="transactions")


class AssetValuation(Base):
    """주식/부동산 등 시세형 자산의 날짜별 평가액 스냅샷. (계정, 날짜) 유니크.

    평가액이 1건 이상 있는 계정의 잔액은 최신 평가액 단독으로 계산한다
    (최신 평가일 이후 거래는 잔액에 가산하지 않음 — 다음 평가액 갱신 시 반영).
    """

    __tablename__ = "asset_valuations"
    __table_args__ = (
        UniqueConstraint("account_id", "date", name="uq_asset_valuations_account_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    date: Mapped[date_type] = mapped_column(Date, index=True)
    value: Mapped[int] = mapped_column(BigInteger)  # KRW 정수(원). 대출(loan) 계정은 음수(-대출원금)로 기록

    account: Mapped["Account"] = relationship()


class Goal(Base):
    """목표 금액. 달성률은 현재 총자산 ÷ 목표금액으로 계산한다 (프론트 표시)."""

    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    target_amount: Mapped[int] = mapped_column(BigInteger)  # KRW 정수(원), 양수
    target_date: Mapped[date_type | None] = mapped_column(Date, nullable=True)


class Budget(Base):
    """월별 지출 대분류 예산. (연월, 대분류) 유니크.

    카테고리 행이 아니라 대분류 이름(major)으로 키잉한다 — 소분류 단위 예산은 두지 않는다.
    대분류 이름 변경 시 기존 예산 문자열은 따라가지 않는다 (알려진 한계 — 옛 이름 예산은 삭제 가능).
    """

    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint("year_month", "major", name="uq_budgets_month_major"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    year_month: Mapped[str] = mapped_column(String(7), index=True)  # YYYY-MM
    major: Mapped[str] = mapped_column(String(100))  # 지출 대분류 이름
    amount: Mapped[int] = mapped_column(BigInteger)


class AppSetting(Base):
    """앱 전역 설정 키-값 저장소.

    OpenAI API 키/모델처럼 런타임에 사용자가 바꿀 수 있는 값을 .env가 아니라 DB로 관리한다.
    키: openai_api_key | openai_model. value는 NULL 허용(미설정 상태).
    """

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)


class AIReport(Base):
    """월별 AI 리포트 — 생성할 때마다 새 행으로 누적 저장(월당 제한 없음).

    같은 월의 최신 리포트는 created_at(보조 id) 기준으로 조회한다. year_month는 인덱스만 두고
    유니크 제약은 두지 않는다(이력 누적).
    """

    __tablename__ = "ai_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    year_month: Mapped[str] = mapped_column(String(7), index=True)  # YYYY-MM
    content: Mapped[str] = mapped_column(Text)  # 마크다운 리포트 본문
    model: Mapped[str] = mapped_column(String(50))  # 생성에 사용한 OpenAI 모델명
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
