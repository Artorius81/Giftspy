"""
FastAPI backend for Giftspy Telegram Mini App.
Imports existing database functions from database/db.py — no modifications needed.
"""
import asyncio
import logging
from typing import Optional

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from database import db
from webapp.auth import get_user_id_from_init_data
from bot.keyboards.common import PERSONAS

app = FastAPI(title="Giftspy Mini App API")

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================= AUTH DEPENDENCY =================

async def get_current_user(request: Request) -> int:
    """Extract and validate user_id from Telegram initData header."""
    init_data = request.headers.get("X-Telegram-Init-Data", "")
    
    # Dev mode: allow direct user_id header for testing
    dev_user_id = request.headers.get("X-Dev-User-Id")
    if dev_user_id and not init_data:
        return int(dev_user_id)
    
    user_id = get_user_id_from_init_data(init_data)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid Telegram auth")
    return user_id


# ================= MODELS =================

class TargetCreate(BaseModel):
    identifier: str
    name: Optional[str] = None
    habits: Optional[str] = None
    birthday: Optional[str] = None


class TargetUpdate(BaseModel):
    name: Optional[str] = None
    habits: Optional[str] = None
    birthday: Optional[str] = None


class CaseCreate(BaseModel):
    target: str
    holiday: str = "Без повода"
    context: str = "Нет данных"
    persona: str
    budget: str = "Не указан"


# ================= PROFILE =================

@app.get("/api/profile")
async def get_profile(user_id: int = Depends(get_current_user)):
    balance, premium_until, successful, active, nickname, spy_mode, birthday, description, photo = await db.get_user_profile(user_id)
    return {
        "user_id": user_id,
        "balance": balance,
        "premium_until": premium_until,
        "successful_cases": successful,
        "active_cases": active,
        "nickname": nickname,
        "spy_mode": spy_mode,
        "birthday": birthday,
        "description": description,
        "photo": photo
    }


# ================= TARGETS =================

@app.get("/api/targets")
async def list_targets(user_id: int = Depends(get_current_user)):
    targets = await db.get_user_targets(user_id)
    return [
        {
            "id": t[0],
            "identifier": t[1],
            "name": t[2],
            "habits": t[3],
            "birthday": t[4],
            "photo": t[5]
        }
        for t in targets
    ]


@app.get("/api/targets/{target_id}")
async def get_target(target_id: int, user_id: int = Depends(get_current_user)):
    target = await db.get_target_by_id(target_id)
    if not target or target[1] != user_id:
        raise HTTPException(status_code=404, detail="Target not found")
    
    wishlist = await db.get_wishlist_grouped(target_id)
    
    return {
        "id": target[0],
        "owner_id": target[1],
        "identifier": target[2],
        "name": target[3],
        "habits": target[4],
        "birthday": target[5],
        "photo": target[6],
        "wishlist": [
            {
                "id": w[0],
                "description": w[1],
                "added_by": w[2],
                "created_at": w[3],
                "category": w[4],
                "case_id": w[5],
                "holiday": w[6],
                "case_date": w[7]
            }
            for w in wishlist
        ]
    }


@app.post("/api/targets")
async def create_target(data: TargetCreate, user_id: int = Depends(get_current_user)):
    existing = await db.find_target_by_identifier(user_id, data.identifier)
    if existing:
        raise HTTPException(status_code=409, detail="Target already exists")
    
    target_id = await db.add_target(
        owner_id=user_id,
        identifier=data.identifier,
        name=data.name,
        habits=data.habits,
        birthday=data.birthday
    )
    return {"id": target_id}


@app.put("/api/targets/{target_id}")
async def update_target(target_id: int, data: TargetUpdate, user_id: int = Depends(get_current_user)):
    target = await db.get_target_by_id(target_id)
    if not target or target[1] != user_id:
        raise HTTPException(status_code=404, detail="Target not found")
    
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if updates:
        await db.update_target(target_id, **updates)
    return {"ok": True}


@app.delete("/api/targets/{target_id}")
async def delete_target(target_id: int, user_id: int = Depends(get_current_user)):
    target = await db.get_target_by_id(target_id)
    if not target or target[1] != user_id:
        raise HTTPException(status_code=404, detail="Target not found")
    await db.delete_target(target_id)
    return {"ok": True}


# ================= CASES (DOSSIER) =================

@app.get("/api/cases")
async def list_cases(user_id: int = Depends(get_current_user)):
    cases = await db.get_all_user_cases(user_id)
    result = []
    for c in cases:
        case_id, target, status, report = c
        # Try to resolve display name
        saved = await db.find_target_by_identifier(user_id, target)
        display_name = saved[2] if saved and saved[2] else target
        result.append({
            "id": case_id,
            "target": target,
            "display_name": display_name,
            "status": status,
            "has_report": bool(report)
        })
    return result


@app.get("/api/cases/{case_id}")
async def get_case(case_id: int, user_id: int = Depends(get_current_user)):
    case = await db.get_case_by_id(case_id)
    if not case or case[1] != user_id:
        raise HTTPException(status_code=404, detail="Case not found")
    
    _, _, target, holiday, context, persona, budget, status, report = case
    saved = await db.find_target_by_identifier(user_id, target)
    display_name = saved[2] if saved and saved[2] else target
    
    # Check if spy mode is enabled
    spy_mode = await db.get_user_spy_mode(user_id)
    
    return {
        "id": case_id,
        "target": target,
        "display_name": display_name,
        "holiday": holiday,
        "context": context,
        "persona": persona,
        "budget": budget,
        "status": status,
        "report": report,
        "spy_mode": spy_mode
    }

@app.get("/api/cases/{case_id}/chat")
async def get_case_chat(case_id: int, user_id: int = Depends(get_current_user)):
    case = await db.get_case_by_id(case_id)
    if not case or case[1] != user_id:
        raise HTTPException(status_code=404, detail="Case not found")
    
    spy_mode = await db.get_user_spy_mode(user_id)
    if not spy_mode:
         raise HTTPException(status_code=403, detail="Spy mode required")

    history = await db.get_chat_history(case_id)
    return [
        {"sender": sender, "message": message}
        for sender, message in history
    ]


@app.post("/api/cases")
async def create_case(data: CaseCreate, user_id: int = Depends(get_current_user)):
    balance = await db.get_user_balance(user_id)
    if isinstance(balance, int) and balance <= 0:
        raise HTTPException(status_code=402, detail="Insufficient balance")
    
    # Check no active case for this target
    existing = await db.get_active_case_by_target(data.target)
    if existing:
        raise HTTPException(status_code=409, detail="Active case already exists for this target")
    
    await db.deduct_balance(user_id)
    case_id = await db.add_case(user_id, data.target, data.holiday, data.context, data.persona, data.budget)
    
    # Auto-save target if not exists
    saved = await db.find_target_by_identifier(user_id, data.target)
    if not saved:
        await db.add_target(user_id, data.target)
    
    return {"id": case_id}


# ================= PERSONAS =================

@app.get("/api/personas")
async def list_personas():
    return [
        {
            "index": i,
            "name": p["name"],
            "desc": p["desc"],
            "photo": p["photo"]
        }
        for i, p in enumerate(PERSONAS)
    ]


# ================= SETTINGS =================

class ChatMessage(BaseModel):
    message: str

@app.post("/api/settings/spy-mode")
async def toggle_spy_mode_endpoint(user_id: int = Depends(get_current_user)):
    new_val = await db.toggle_spy_mode(user_id)
    return {"spy_mode": bool(new_val)}

@app.post("/api/cases/{case_id}/chat")
async def send_chat_message(case_id: int, data: ChatMessage, user_id: int = Depends(get_current_user)):
    case = await db.get_case_by_id(case_id)
    if not case or case[1] != user_id:
        raise HTTPException(status_code=404, detail="Case not found")
    
    status = case[7]
    if status != 'manual_mode':
        raise HTTPException(status_code=400, detail="Case not in manual mode")
    
    # Save the message
    await db.save_chat_message(case_id, 'ai', data.message)
    
    # Send via Telethon client
    target = case[2]
    try:
        from main import client
        from services.scheduler import resolve_target
        target_entity = await resolve_target(client, target)
        if target_entity:
            await client.send_message(target_entity, data.message)
    except Exception as e:
        logging.error(f"Failed to send message via Telethon: {e}")
    
    return {"ok": True}

@app.post("/api/cases/{case_id}/intercept")
async def intercept_case(case_id: int, user_id: int = Depends(get_current_user)):
    case = await db.get_case_by_id(case_id)
    if not case or case[1] != user_id:
        raise HTTPException(status_code=404, detail="Case not found")
    
    status = case[7]
    if status not in ('started', 'in_progress'):
        raise HTTPException(status_code=400, detail="Cannot intercept in this status")
    
    await db.update_case_status(case_id, 'manual_mode')
    return {"ok": True, "status": "manual_mode"}

@app.post("/api/cases/{case_id}/return-detective")
async def return_detective_case(case_id: int, user_id: int = Depends(get_current_user)):
    case = await db.get_case_by_id(case_id)
    if not case or case[1] != user_id:
        raise HTTPException(status_code=404, detail="Case not found")
    
    status = case[7]
    if status != 'manual_mode':
        raise HTTPException(status_code=400, detail="Case not in manual mode")
    
    await db.update_case_status(case_id, 'in_progress')
    return {"ok": True, "status": "in_progress"}


# ================= BALANCE =================

@app.get("/api/balance")
async def get_balance(user_id: int = Depends(get_current_user)):
    balance = await db.get_user_balance(user_id)
    return {"balance": balance}


# ================= STARTUP =================

@app.on_event("startup")
async def startup():
    await db.init_db()
    logging.info("Mini App API started")
