import os
from typing import Generator

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

engine = (
    create_engine(DATABASE_URL, pool_pre_ping=True)
    if DATABASE_URL
    else None
)

SessionLocal = (
    sessionmaker(autocommit=False, autoflush=False, bind=engine)
    if engine
    else None
)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator:
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="DATABASE_URL not configured")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
