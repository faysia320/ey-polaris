from datetime import date as date_type

from sqlalchemy import BigInteger, Boolean, Date, ForeignKey, String, UniqueConstraint
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

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    type: Mapped[str] = mapped_column(String(20))  # bank | cash | card | investment | other
    opening_balance: Mapped[int] = mapped_column(BigInteger, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id", ondelete="RESTRICT"))

    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="account", foreign_keys="Transaction.account_id"
    )
    member: Mapped["Member"] = relationship()


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


class Transaction(Base):
    """수입/지출/이체 거래. 금액은 KRW 정수(원 단위), 항상 양수이며 kind로 방향을 구분.

    이체(transfer)는 account_id가 출금 계정, counter_account_id가 입금 계정이며
    수입/지출 통계에는 포함되지 않고 두 계정 잔액에만 ±반영된다.
    """

    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date_type] = mapped_column(Date, index=True)
    amount: Mapped[int] = mapped_column(BigInteger)
    kind: Mapped[str] = mapped_column(String(10))  # income | expense | transfer
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="RESTRICT"))
    # 이체 전용 — 입금 계정. 수입/지출 거래에서는 항상 NULL
    counter_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=True
    )
    member_id: Mapped[int | None] = mapped_column(
        ForeignKey("members.id", ondelete="SET NULL"), nullable=True
    )
    memo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source: Mapped[str] = mapped_column(String(10), default="manual")  # manual | import

    category: Mapped["Category"] = relationship(back_populates="transactions")
    account: Mapped["Account"] = relationship(
        back_populates="transactions", foreign_keys=[account_id]
    )
    counter_account: Mapped["Account | None"] = relationship(foreign_keys=[counter_account_id])
    member: Mapped["Member | None"] = relationship()


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
    value: Mapped[int] = mapped_column(BigInteger)  # KRW 정수(원), 0 이상

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
