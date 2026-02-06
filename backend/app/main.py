from __future__ import annotations

import json
import logging
import os
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_PATH)

from app.auth_utils import (  # noqa: E402
    create_access_token,
    decode_access_token,
    hash_password,
    is_jwt_error,
    verify_password,
)
from app.db import Base, engine, get_db  # noqa: E402
from app.models import User  # noqa: E402


class Question(BaseModel):
    id: str
    type: str
    text: str
    required: bool = False
    options: Optional[List[str]] = None


class Questionnaire(BaseModel):
    title: str
    intro: str
    questions: List[Question]


class GenerateRequest(BaseModel):
    goal: str = Field(..., description="Survey goal")
    audience: str = Field("", description="Target audience")
    question_count: int = Field(8, ge=3, le=20)
    tone: str = Field("neutral")
    language: str = Field("zh")


class UserCreate(BaseModel):
    nickname: str
    password: str


class UserLogin(BaseModel):
    nickname: str
    password: str


class UserOut(BaseModel):
    id: int
    nickname: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


logger = logging.getLogger("survey-api")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(title="AI Survey Generator", version="0.1.0")

default_origins = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.120.237:3000",
}
extra_origins = {
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(default_origins | extra_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if engine is not None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


def _make_id() -> str:
    return uuid.uuid4().hex[:8]


def _fallback_generate(payload: GenerateRequest) -> Questionnaire:
    title = f"{payload.goal}问卷"
    intro = "感谢参与本次调研，问卷大约需要 3-5 分钟完成。"
    templates = [
        (
            "single_choice",
            "您对当前体验的整体满意度是？",
            ["非常满意", "满意", "一般", "不满意", "非常不满意"],
            True,
        ),
        (
            "rating",
            "您愿意推荐给朋友的可能性有多大？",
            ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
            True,
        ),
        (
            "multiple_choice",
            "您最看重的功能点是？",
            ["易用性", "性能", "外观设计", "价格", "客服支持"],
            False,
        ),
        (
            "short_text",
            "您希望我们优先改进的地方是？",
            None,
            False,
        ),
        (
            "single_choice",
            "您使用该产品的频率是？",
            ["每天", "每周 3-4 次", "每周 1-2 次", "偶尔", "首次使用"],
            False,
        ),
        (
            "short_text",
            "还有哪些建议或需求想告诉我们？",
            None,
            False,
        ),
    ]

    questions: List[Question] = []
    for idx in range(min(payload.question_count, len(templates))):
        q_type, text, options, required = templates[idx]
        questions.append(
            Question(
                id=_make_id(),
                type=q_type,
                text=text,
                required=required,
                options=options,
            )
        )

    while len(questions) < payload.question_count:
        questions.append(
            Question(
                id=_make_id(),
                type="short_text",
                text="请描述您最真实的感受。",
                required=False,
                options=None,
            )
        )

    return Questionnaire(title=title, intro=intro, questions=questions)


def _agno_generate(payload: GenerateRequest) -> Questionnaire:
    from agno.agent import Agent
    from agno.models.openai import OpenAIChat

    model_id = os.getenv("AGNO_MODEL", "gpt-4o-mini")
    logger.info("Using OpenAI model via Agno: %s", model_id)
    agent = Agent(model=OpenAIChat(id=model_id), markdown=False)

    prompt = (
        "You are a professional survey designer. "
        "Generate a concise questionnaire based on the input. "
        "Return JSON that matches the schema: "
        "{title: string, intro: string, questions: "
        "[{id: string, type: 'single_choice'|'multiple_choice'|'rating'|'short_text', "
        "text: string, required: boolean, options?: string[]}]}. "
        "Keep options short. Limit to the requested question count. "
        "Decide which questions are required and set required=true when needed. "
        f"Input: goal={payload.goal}, audience={payload.audience}, "
        f"tone={payload.tone}, language={payload.language}, "
        f"question_count={payload.question_count}."
    )

    response = agent.run(prompt, output_schema=Questionnaire)
    content = response.content
    if isinstance(content, Questionnaire):
        return content
    if isinstance(content, dict):
        return Questionnaire(**content)
    if isinstance(content, str):
        try:
            return Questionnaire.model_validate_json(content)
        except Exception:
            data = json.loads(content)
            return Questionnaire(**data)
    raise ValueError("Unexpected response type from agno")


def _auto_required(questionnaire: Questionnaire) -> Questionnaire:
    if any(q.required for q in questionnaire.questions):
        return questionnaire

    required_types = {"single_choice", "rating"}
    for question in questionnaire.questions:
        question.required = question.type in required_types

    if not any(q.required for q in questionnaire.questions) and questionnaire.questions:
        questionnaire.questions[0].required = True

    return questionnaire


@app.post("/generate", response_model=Questionnaire)
def generate(payload: GenerateRequest) -> Questionnaire:
    if not os.getenv("OPENAI_API_KEY"):
        logger.info("OPENAI_API_KEY not set. Using fallback generation.")
        return _auto_required(_fallback_generate(payload))

    try:
        logger.info("OPENAI_API_KEY detected. Calling OpenAI via Agno.")
        return _auto_required(_agno_generate(payload))
    except Exception:
        logger.exception("Agno/OpenAI generation failed. Falling back.")
        return _auto_required(_fallback_generate(payload))


def _sanitize_nickname(nickname: str) -> str:
    return nickname.strip()


def _validate_password(password: str) -> None:
    if len(password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters",
        )


def _user_to_out(user: User) -> UserOut:
    return UserOut(id=user.id, nickname=user.nickname)


def _get_current_user(
    authorization: str | None, db: Session
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
    except Exception as err:
        if is_jwt_error(err):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            ) from err
        raise

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
    user = db.get(User, int(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    return user


@app.post("/auth/register", response_model=TokenResponse)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> TokenResponse:
    nickname = _sanitize_nickname(payload.nickname)
    if len(nickname) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nickname must be at least 2 characters",
        )
    _validate_password(payload.password)
    user = User(
        nickname=nickname,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as err:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Nickname already registered",
        ) from err

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user=_user_to_out(user))


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    nickname = _sanitize_nickname(payload.nickname)
    _validate_password(payload.password)
    user = db.query(User).filter(User.nickname == nickname).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user=_user_to_out(user))


@app.get("/auth/me", response_model=UserOut)
def me(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> UserOut:
    user = _get_current_user(authorization, db)
    return _user_to_out(user)
