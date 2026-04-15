from fastapi import FastAPI, APIRouter, HTTPException, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage
from auth import auth_router, init_auth, seed_admin, get_optional_user

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Initialize auth module
init_auth(db)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# --- Pydantic Models ---
class SessionCreate(BaseModel):
    tech_stack: str
    category: str
    difficulty: str
    num_questions: int = 8
    timed_mode: bool = False
    time_per_question: int = 300


class QuestionRequest(BaseModel):
    session_id: str


class AnswerSubmit(BaseModel):
    session_id: str
    round_id: str
    answer: str


# --- AI Helpers ---
def parse_ai_json(text):
    text = text.strip()
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if match:
        text = match.group(1)
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            return json.loads(match.group())
        raise


def get_question_prompt(tech_stack, category, difficulty, past_questions):
    diff_map = {
        "beginner": "You are conducting a beginner-friendly interview. Ask fundamental questions that test core understanding. Be clear and encouraging.",
        "intermediate": "You are conducting a mid-level interview. Ask practical, scenario-based questions that test real-world application. Be thorough.",
        "advanced": "You are conducting a senior-level interview. Ask deep, tricky questions that test architectural thinking and edge cases. Be strict and challenging."
    }
    past = "\n".join(f"- {q}" for q in past_questions) if past_questions else "None yet"
    return f"""You are a strict technical interviewer specializing in {tech_stack} ({category}).
{diff_map.get(difficulty, diff_map['intermediate'])}

Previously asked questions in this session (DO NOT repeat or ask similar questions):
{past}

Generate ONE unique interview question. Respond in ONLY valid JSON (no markdown, no extra text):
{{"question":"the full question text","type":"coding|conceptual|scenario","topic":"specific topic area","expected_key_points":["point1","point2","point3"],"hint":"a subtle hint if candidate is stuck"}}"""


def get_eval_prompt(tech_stack, category, difficulty, question, answer):
    grill_map = {
        "beginner": "Be supportive and educational. Provide detailed guidance on what was right and wrong. Still identify areas for improvement clearly.",
        "intermediate": "Be moderately strict. Point out weaknesses firmly. Provide one challenging follow-up question that digs deeper.",
        "advanced": "Be VERY strict and aggressive. Challenge every weak point in the answer. Grill the candidate hard with a deep, tricky follow-up question that exposes gaps."
    }
    return f"""You are a strict technical interviewer evaluating a {difficulty}-level candidate's answer for {tech_stack} ({category}).
{grill_map.get(difficulty, grill_map['intermediate'])}

Question asked: {question}

Candidate's answer: {answer}

Evaluate thoroughly and respond in ONLY valid JSON (no markdown, no extra text):
{{"score":<number 0 to 10>,"feedback":"detailed evaluation feedback","strengths":["strength1","strength2"],"weaknesses":["weakness1","weakness2"],"follow_up_question":"a grilling follow-up question","improvement_suggestions":["suggestion1","suggestion2"],"verdict":"strong|acceptable|needs_improvement|poor"}}"""


GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"]

async def call_gemini(system_prompt, user_text, retries=3):
    import asyncio
    last_error = None
    for model in GEMINI_MODELS:
        for attempt in range(retries):
            try:
                chat = LlmChat(
                    api_key=GEMINI_API_KEY,
                    session_id=str(uuid.uuid4()),
                    system_message=system_prompt
                ).with_model("gemini", model)
                response = await chat.send_message(UserMessage(text=user_text))
                return response
            except Exception as e:
                last_error = e
                logger.warning(f"Gemini call failed (model={model}, attempt={attempt+1}): {e}")
                if attempt < retries - 1:
                    await asyncio.sleep(1.5 * (attempt + 1))
        logger.info(f"Model {model} exhausted retries, trying next model...")
    raise last_error or Exception("All Gemini models failed")


# --- Routes ---
@api_router.get("/")
async def root():
    return {"message": "DevGrill AI API - Interview Preparation Platform"}


@api_router.post("/sessions")
async def create_session(data: SessionCreate, request: Request):
    user = await get_optional_user(request)
    session = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"] if user else None,
        "tech_stack": data.tech_stack,
        "category": data.category,
        "difficulty": data.difficulty,
        "num_questions": data.num_questions,
        "timed_mode": data.timed_mode,
        "time_per_question": data.time_per_question,
        "questions_asked": 0,
        "status": "active",
        "avg_score": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None
    }
    await db.sessions.insert_one(session)
    session.pop("_id", None)
    return session


@api_router.get("/sessions")
async def list_sessions(status: Optional[str] = None, limit: int = 50):
    query = {}
    if status:
        query["status"] = status
    sessions = await db.sessions.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return sessions


@api_router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Session not found")
    rounds = await db.rounds.find({"session_id": session_id}, {"_id": 0}).sort("order", 1).to_list(100)
    return {"session": session, "rounds": rounds}


@api_router.post("/interview/question")
async def generate_question(data: QuestionRequest):
    session = await db.sessions.find_one({"id": data.session_id}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Session not found")
    if session["status"] != "active":
        raise HTTPException(400, "Session is not active")

    past_rounds = await db.rounds.find(
        {"session_id": data.session_id}, {"_id": 0, "question": 1}
    ).to_list(100)
    past_questions = [r["question"] for r in past_rounds]

    prompt = get_question_prompt(
        session["tech_stack"], session["category"],
        session["difficulty"], past_questions
    )

    try:
        response = await call_gemini(prompt, "Generate the next unique interview question now.")
        q_data = parse_ai_json(response)
    except Exception as e:
        logger.error(f"Gemini question generation error: {e}")
        raise HTTPException(500, f"AI generation failed: {str(e)}")

    order = len(past_rounds) + 1
    round_doc = {
        "id": str(uuid.uuid4()),
        "session_id": data.session_id,
        "order": order,
        "question": q_data.get("question", ""),
        "question_type": q_data.get("type", "conceptual"),
        "topic": q_data.get("topic", "general"),
        "expected_key_points": q_data.get("expected_key_points", []),
        "hint": q_data.get("hint", ""),
        "answer": None,
        "score": None,
        "feedback": None,
        "strengths": [],
        "weaknesses": [],
        "follow_up_question": None,
        "improvement_suggestions": [],
        "verdict": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.rounds.insert_one(round_doc)
    round_doc.pop("_id", None)
    await db.sessions.update_one(
        {"id": data.session_id},
        {"$set": {"questions_asked": order}}
    )
    return round_doc


@api_router.post("/interview/evaluate")
async def evaluate_answer(data: AnswerSubmit):
    session = await db.sessions.find_one({"id": data.session_id}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Session not found")

    round_doc = await db.rounds.find_one({"id": data.round_id}, {"_id": 0})
    if not round_doc:
        raise HTTPException(404, "Round not found")

    prompt = get_eval_prompt(
        session["tech_stack"], session["category"],
        session["difficulty"], round_doc["question"], data.answer
    )

    try:
        response = await call_gemini(prompt, "Evaluate this answer thoroughly now.")
        eval_data = parse_ai_json(response)
    except Exception as e:
        logger.error(f"Gemini evaluation error: {e}")
        raise HTTPException(500, f"AI evaluation failed: {str(e)}")

    score_val = eval_data.get("score", 0)
    if isinstance(score_val, str):
        try:
            score_val = float(score_val)
        except ValueError:
            score_val = 0

    update = {
        "answer": data.answer,
        "score": score_val,
        "feedback": eval_data.get("feedback", ""),
        "strengths": eval_data.get("strengths", []),
        "weaknesses": eval_data.get("weaknesses", []),
        "follow_up_question": eval_data.get("follow_up_question", ""),
        "improvement_suggestions": eval_data.get("improvement_suggestions", []),
        "verdict": eval_data.get("verdict", "needs_improvement")
    }

    await db.rounds.update_one({"id": data.round_id}, {"$set": update})

    scored_rounds = await db.rounds.find(
        {"session_id": data.session_id, "score": {"$ne": None}},
        {"_id": 0, "score": 1}
    ).to_list(100)
    if scored_rounds:
        avg = sum(r["score"] for r in scored_rounds) / len(scored_rounds)
        await db.sessions.update_one(
            {"id": data.session_id},
            {"$set": {"avg_score": round(avg, 1)}}
        )

    return {**round_doc, **update}


@api_router.post("/sessions/{session_id}/complete")
async def complete_session(session_id: str):
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Session not found")

    rounds = await db.rounds.find(
        {"session_id": session_id, "score": {"$ne": None}}, {"_id": 0}
    ).to_list(100)
    avg_score = sum(r["score"] for r in rounds) / len(rounds) if rounds else 0

    now = datetime.now(timezone.utc).isoformat()
    await db.sessions.update_one({"id": session_id}, {"$set": {
        "status": "completed",
        "avg_score": round(avg_score, 1),
        "completed_at": now
    }})

    session["status"] = "completed"
    session["avg_score"] = round(avg_score, 1)
    session["completed_at"] = now
    return {"session": session, "rounds": rounds}


@api_router.get("/dashboard/overview")
async def dashboard_overview():
    total = await db.sessions.count_documents({})
    completed = await db.sessions.count_documents({"status": "completed"})

    pipeline = [
        {"$match": {"status": "completed", "avg_score": {"$ne": None}}},
        {"$group": {"_id": None, "avg": {"$avg": "$avg_score"}}}
    ]
    result = await db.sessions.aggregate(pipeline).to_list(1)
    overall_avg = round(result[0]["avg"], 1) if result else 0

    recent = await db.sessions.find(
        {"status": "completed"}, {"_id": 0}
    ).sort("completed_at", -1).to_list(10)

    return {
        "total_sessions": total,
        "completed_sessions": completed,
        "overall_avg_score": overall_avg,
        "recent_sessions": recent
    }


@api_router.get("/dashboard/skill-radar")
async def skill_radar():
    pipeline = [
        {"$match": {"status": "completed", "avg_score": {"$ne": None}}},
        {"$group": {
            "_id": "$category",
            "avg_score": {"$avg": "$avg_score"},
            "count": {"$sum": 1}
        }}
    ]
    results = await db.sessions.aggregate(pipeline).to_list(100)
    return [
        {"category": r["_id"], "avg_score": round(r["avg_score"], 1), "sessions": r["count"]}
        for r in results
    ]


@api_router.get("/dashboard/trend")
async def score_trend():
    sessions = await db.sessions.find(
        {"status": "completed", "avg_score": {"$ne": None}},
        {"_id": 0, "id": 1, "avg_score": 1, "category": 1, "tech_stack": 1, "difficulty": 1, "completed_at": 1}
    ).sort("completed_at", 1).to_list(50)
    return sessions


@api_router.get("/dashboard/category-stats")
async def category_stats():
    pipeline = [
        {"$match": {"status": "completed", "avg_score": {"$ne": None}}},
        {"$group": {
            "_id": {"category": "$category", "difficulty": "$difficulty"},
            "avg_score": {"$avg": "$avg_score"},
            "count": {"$sum": 1}
        }}
    ]
    results = await db.sessions.aggregate(pipeline).to_list(100)
    return [
        {
            "category": r["_id"]["category"],
            "difficulty": r["_id"]["difficulty"],
            "avg_score": round(r["avg_score"], 1),
            "sessions": r["count"]
        }
        for r in results
    ]


# --- Bookmarks ---
class BookmarkCreate(BaseModel):
    session_id: str
    round_id: str


@api_router.post("/bookmarks")
async def create_bookmark(data: BookmarkCreate, request: Request):
    user = await get_optional_user(request)
    round_doc = await db.rounds.find_one({"id": data.round_id}, {"_id": 0})
    if not round_doc:
        raise HTTPException(404, "Round not found")
    bookmark = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"] if user else None,
        "session_id": data.session_id,
        "round_id": data.round_id,
        "question": round_doc.get("question", ""),
        "topic": round_doc.get("topic", ""),
        "question_type": round_doc.get("question_type", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bookmarks.insert_one(bookmark)
    bookmark.pop("_id", None)
    return bookmark


@api_router.get("/bookmarks")
async def list_bookmarks(request: Request):
    user = await get_optional_user(request)
    query = {"user_id": user["_id"]} if user else {}
    bookmarks = await db.bookmarks.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return bookmarks


@api_router.delete("/bookmarks/{bookmark_id}")
async def delete_bookmark(bookmark_id: str):
    result = await db.bookmarks.delete_one({"id": bookmark_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Bookmark not found")
    return {"message": "Bookmark deleted"}


# --- Session Comparison ---
@api_router.get("/comparison")
async def compare_sessions(session1: str, session2: str):
    s1 = await db.sessions.find_one({"id": session1}, {"_id": 0})
    s2 = await db.sessions.find_one({"id": session2}, {"_id": 0})
    if not s1 or not s2:
        raise HTTPException(404, "One or both sessions not found")
    r1 = await db.rounds.find(
        {"session_id": session1, "score": {"$ne": None}}, {"_id": 0}
    ).sort("order", 1).to_list(100)
    r2 = await db.rounds.find(
        {"session_id": session2, "score": {"$ne": None}}, {"_id": 0}
    ).sort("order", 1).to_list(100)

    score_a = s1.get("avg_score") or 0
    score_b = s2.get("avg_score") or 0
    winner = "a" if score_a > score_b else ("b" if score_b > score_a else "tie")

    return {
        "session_a": s1,
        "session_b": s2,
        "rounds_a": r1,
        "rounds_b": r2,
        "winner": winner
    }


# --- Weak Topics ---
@api_router.get("/dashboard/weak-topics")
async def weak_topics():
    pipeline = [
        {"$match": {"score": {"$ne": None}, "topic": {"$ne": None}}},
        {"$group": {
            "_id": "$topic",
            "avg_score": {"$avg": "$score"},
            "count": {"$sum": 1}
        }},
        {"$match": {"count": {"$gte": 1}}},
        {"$sort": {"avg_score": 1}},
        {"$limit": 15}
    ]
    results = await db.rounds.aggregate(pipeline).to_list(15)
    return [
        {"topic": r["_id"], "avg_score": round(r["avg_score"], 1), "attempts": r["count"]}
        for r in results
    ]


app.include_router(api_router)
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await seed_admin()
    logger.info("Admin seeded successfully")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
