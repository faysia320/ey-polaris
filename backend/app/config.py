import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://polaris:polaris@localhost:5432/polaris",
)
