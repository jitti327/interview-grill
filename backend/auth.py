from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
import bcrypt
import jwt
import os
from datetime import datetime, timezone, timedelta
from bson import ObjectId

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])
JWT_ALGORITHM = "HS256"
_db = None


def init_auth(database):
    global _db
    _db = database


def get_jwt_secret():
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=2),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request):
    if _db is None:
        raise HTTPException(500, "Auth not initialized")
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        user = await _db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(401, "User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


async def get_optional_user(request: Request):
    try:
        return await get_current_user(request)
    except Exception:
        return None


class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginInput(BaseModel):
    email: EmailStr
    password: str


def _set_auth_cookies(response: Response, user_id: str, email: str):
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=7200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")


@auth_router.post("/register")
async def register(data: RegisterInput, response: Response):
    email = data.email.lower().strip()
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    existing = await _db.users.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Email already registered")
    user_doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name.strip(),
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await _db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    _set_auth_cookies(response, user_id, email)
    return {"id": user_id, "email": email, "name": data.name.strip(), "role": "user"}


@auth_router.post("/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower().strip()
    user = await _db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    user_id = str(user["_id"])
    _set_auth_cookies(response, user_id, email)
    return {"id": user_id, "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "user")}


@auth_router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}


@auth_router.get("/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user


@auth_router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Invalid token type")
        user = await _db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(401, "User not found")
        access = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=7200, path="/")
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid refresh token")


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@devgrill.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await _db.users.find_one({"email": admin_email})
    if not existing:
        await _db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await _db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
    await _db.users.create_index("email", unique=True)
