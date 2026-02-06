import os
from datetime import datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

# Allow long passwords by using PBKDF2 for new hashes while still verifying bcrypt.
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    deprecated="auto",
)
ALGORITHM = "HS256"


def _secret_key() -> str:
    return os.getenv("JWT_SECRET", "dev-secret-change")


def _expires_minutes() -> int:
    value = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
    try:
        return int(value)
    except ValueError:
        return 1440


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def create_access_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=_expires_minutes())
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _secret_key(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, _secret_key(), algorithms=[ALGORITHM])


def is_jwt_error(err: Exception) -> bool:
    return isinstance(err, JWTError)
