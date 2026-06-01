"""
FastAPI backend for Giftspy Telegram Mini App.
Imports existing database functions from database/db.py — no modifications needed.
"""
import asyncio
from datetime import datetime
import logging
from typing import Optional

from fastapi import FastAPI, Request, Response, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from database import db
from webapp.auth import get_user_id_from_init_data

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
        logging.info(f"get_current_user: Dev mode active, user_id={dev_user_id}")
        return int(dev_user_id)
    
    logging.info(f"get_current_user: Received request with initData length = {len(init_data)}")
    user_id = get_user_id_from_init_data(init_data)
    if not user_id:
        logging.warning("get_current_user: Failed to authenticate Telegram initData")
        raise HTTPException(status_code=401, detail="Invalid Telegram auth")
    return user_id


def get_case_number(case_id: int) -> str:
    """Генерирует детерминированный буквенно-цифровой номер дела."""
    if case_id == 1:
        return "oX874F"
    if case_id == 2:
        return "kM391P"
    if case_id == 3:
        return "zW802T"
        
    val = (case_id * 1234567) ^ 987654321
    p = "abcdefghijklmnopqrstuvwxyz"[(val % 26)]
    m = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[((val // 26) % 26)]
    d1 = "0123456789"[((val // 676) % 10)]
    d2 = "0123456789"[((val // 6760) % 10)]
    d3 = "0123456789"[((val // 67600) % 10)]
    s = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[((val // 676000) % 26)]
    return f"{p}{m}{d1}{d2}{d3}{s}"


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


class ProfileUpdate(BaseModel):
    nickname: Optional[str] = None
    birthday: Optional[str] = None
    description: Optional[str] = None


class NotificationsUpdate(BaseModel):
    notify_birthdays: Optional[bool] = None
    notify_dialogue: Optional[bool] = None
    notify_reports: Optional[bool] = None


class CaseCreate(BaseModel):
    target: str
    holiday: str = "Без повода"
    context: str = "Нет данных"
    persona: str
    budget: str = "Не указан"
    ai_model: Optional[str] = "deepseek-v4"


class TestCaseCreate(BaseModel):
    persona: str
    target_username: str
    holiday: Optional[str] = "Тестовое расследование 🧪"
    context: Optional[str] = None
    budget: Optional[str] = "Любой"
    ai_model: Optional[str] = "deepseek-v4"


class WishlistItemCreate(BaseModel):
    target_id: int
    description: str
    category: Optional[str] = "Другое"
    holiday: Optional[str] = "Без повода"


# ================= PROFILE =================

@app.get("/api/profile")
async def get_profile(user_id: int = Depends(get_current_user)):
    try:
        balance, premium_until, successful, active, nickname, spy_mode, birthday, description, photo = await db.get_user_profile(user_id)
    except Exception as e:
        logging.error(f"Error in db.get_user_profile for user {user_id}: {e}")
        balance, premium_until, successful, active, nickname, spy_mode, birthday, description, photo = 1, None, 0, 0, None, False, None, None, None

    try:
        notif = await db.get_user_notifications(user_id)
    except Exception as e:
        logging.error(f"Error in db.get_user_notifications for user {user_id}: {e}")
        notif = {
            "notify_birthdays": True,
            "notify_dialogue": True,
            "notify_reports": True
        }

    try:
        has_tested_detective = await db.has_user_tested_detective(user_id)
    except Exception as e:
        logging.error(f"Error in db.has_user_tested_detective for user {user_id}: {e}")
        has_tested_detective = False
    
    # Compute is_premium based on date check
    is_premium = False
    if premium_until:
        try:
            is_premium = datetime.fromisoformat(premium_until) > datetime.utcnow()
        except (ValueError, TypeError):
            pass
            
    try:
        self_target_id = await db.get_or_create_self_target(user_id)
    except Exception as e:
        logging.error(f"Error in db.get_or_create_self_target for user {user_id}: {e}")
        self_target_id = None

    wishlist = []
    if self_target_id is not None:
        try:
            wishlist = await db.get_wishlist_grouped(self_target_id)
        except Exception as e:
            logging.error(f"Error in db.get_wishlist_grouped for self_target {self_target_id}: {e}")

    try:
        model_selector_enabled = await db.get_user_model_selector_enabled(user_id)
    except Exception as e:
        logging.error(f"Error in db.get_user_model_selector_enabled for user {user_id}: {e}")
        model_selector_enabled = False

    try:
        custom_detectives_enabled = await db.get_user_custom_detectives_enabled(user_id)
    except Exception as e:
        logging.error(f"Error in db.get_user_custom_detectives_enabled for user {user_id}: {e}")
        custom_detectives_enabled = False
    
    return {
        "user_id": user_id,
        "balance": balance,
        "premium_until": premium_until,
        "is_premium": is_premium,
        "successful_cases": successful,
        "active_cases": active,
        "nickname": nickname,
        "spy_mode": spy_mode,
        "model_selector_enabled": model_selector_enabled,
        "custom_detectives_enabled": custom_detectives_enabled,
        "has_tested_detective": has_tested_detective,
        "birthday": birthday,
        "description": description,
        "photo": photo,
        "phone": None,
        "notify_birthdays": notif["notify_birthdays"],
        "notify_dialogue": notif["notify_dialogue"],
        "notify_reports": notif["notify_reports"],
        "self_target_id": self_target_id,
        "wishlist": [
            {
                "id": w[0],
                "description": w[1],
                "added_by": w[2],
                "created_at": w[3],
                "category": w[4],
                "case_id": w[5],
                "holiday": w[6],
                "case_date": w[7],
                "received": w[8]
            }
            for w in wishlist
        ]
    }


@app.put("/api/profile")
async def update_profile(data: ProfileUpdate, user_id: int = Depends(get_current_user)):
    if data.nickname is not None:
        nick = data.nickname.strip()[:32]
        if nick:
            await db.update_user_nickname(user_id, nick)
    if data.birthday is not None:
        await db.update_user_field(user_id, 'birthday', data.birthday.strip() or None)
    if data.description is not None:
        desc = data.description.strip()[:200]
        await db.update_user_field(user_id, 'description', desc or None)
    return {"ok": True}


@app.put("/api/profile/notifications")
async def update_notifications(data: NotificationsUpdate, user_id: int = Depends(get_current_user)):
    if data.notify_birthdays is not None:
        await db.update_user_notifications(user_id, 'notify_birthdays', data.notify_birthdays)
    if data.notify_dialogue is not None:
        await db.update_user_notifications(user_id, 'notify_dialogue', data.notify_dialogue)
    if data.notify_reports is not None:
        await db.update_user_notifications(user_id, 'notify_reports', data.notify_reports)
    return {"ok": True}


@app.post("/api/profile/photo")
async def upload_profile_photo_endpoint(file: UploadFile = File(...), user_id: int = Depends(get_current_user)):
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="File too large")
    photo_url = await db.upload_profile_photo(user_id, file_bytes)
    await db.update_user_field(user_id, 'photo_file_id', photo_url)
    return {"photo": photo_url}


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
            "photo": t[5],
            "wishlist_count": t[6] if len(t) > 6 else 0
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
                "case_date": w[7],
                "received": w[8]
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


@app.post("/api/targets/{target_id}/photo")
async def upload_target_photo_endpoint(target_id: int, file: UploadFile = File(...), user_id: int = Depends(get_current_user)):
    target = await db.get_target_by_id(target_id)
    if not target or target[1] != user_id:
        raise HTTPException(status_code=404, detail="Target not found")
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="File too large")
    identifier = target[2]
    try:
        photo_url = await db.upload_target_photo(identifier, file_bytes)
    except Exception as e:
        logging.error(f"Failed to upload target photo: {e}")
        # Fallback: use profile_photo bucket which is known to work
        try:
            photo_url = await db.upload_target_photo_fallback(identifier, file_bytes)
        except Exception as e2:
            logging.error(f"Fallback upload also failed: {e2}")
            raise HTTPException(status_code=500, detail="Ошибка загрузки фото")
    await db.update_target(target_id, photo_file_id=photo_url)
    return {"photo": photo_url}


# ================= WISHLIST =================

@app.post("/api/wishlist")
async def add_wishlist_item(data: WishlistItemCreate, user_id: int = Depends(get_current_user)):
    target = await db.get_target_by_id(data.target_id)
    if not target or target[1] != user_id:
        raise HTTPException(status_code=404, detail="Target not found")
    
    await db.add_to_wishlist(
        target_id=data.target_id,
        gift_description=data.description,
        category=data.category,
        holiday=data.holiday,
        added_by='user'
    )
    return {"ok": True}


@app.post("/api/wishlist/{item_id}/toggle-received")
async def toggle_wishlist_item_received(item_id: int, received: Optional[bool] = None, user_id: int = Depends(get_current_user)):
    item = await db.get_wishlist_item_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")
        
    target = await db.get_target_by_id(item['target_id'])
    if not target or target[1] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    new_received = received if received is not None else not bool(item.get('received', False))
    await db.set_wishlist_item_received(item_id, new_received)
    return {"ok": True, "received": new_received}


@app.delete("/api/wishlist/{item_id}")
async def delete_wishlist_item_endpoint(item_id: int, user_id: int = Depends(get_current_user)):
    item = await db.get_wishlist_item_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")
        
    target = await db.get_target_by_id(item['target_id'])
    if not target or target[1] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    await db.delete_wishlist_item(item_id)
    return {"ok": True}


# ================= CASES (DOSSIER) =================

@app.get("/api/cases")
async def list_cases(user_id: int = Depends(get_current_user)):
    cases = await db.get_all_user_cases(user_id)
    
    # Fetch personas once outside the loop to avoid N+1 queries
    personas = await db.get_personas(user_id)
    personas_map = {p['name']: p.get('photo') for p in personas if 'name' in p}
    
    result = []
    for c in cases:
        case_id, target, status, report, holiday, persona, budget, created_at, completed_at = c
        # Try to resolve target info
        saved = await db.find_target_by_identifier(user_id, target)
        display_name = saved[2] if saved and saved[2] else target
        target_photo = saved[5] if saved else None
        target_db_id = saved[0] if saved else None
        
        # Resolve persona photo
        persona_photo = personas_map.get(persona)
        
        # Resolve message count for dynamic mathematical progress calculation
        message_count = await db.get_chat_history_count(case_id)
        
        result.append({
            "id": case_id,
            "target": target,
            "display_name": display_name,
            "status": status,
            "has_report": bool(report),
            "target_photo": target_photo,
            "target_db_id": target_db_id,
            "holiday": holiday,
            "persona": persona,
            "persona_photo": persona_photo,
            "message_count": message_count,
            "case_number": get_case_number(case_id),
            "budget": budget,
            "created_at": created_at,
            "completed_at": completed_at,
        })
    return result


@app.get("/api/cases/{case_id}")
async def get_case(case_id: int, user_id: int = Depends(get_current_user)):
    case = await db.get_case_by_id(case_id)
    if not case or case[1] != user_id:
        raise HTTPException(status_code=404, detail="Case not found")
    
    _, _, target, holiday, context, persona, budget, status, report, created_at, completed_at = case
    saved = await db.find_target_by_identifier(user_id, target)
    display_name = saved[2] if saved and saved[2] else target
    target_photo = saved[5] if saved else None
    target_db_id = saved[0] if saved else None
    
    # Try to resolve persona photo
    personas = await db.get_personas(user_id)
    persona_data = next((p for p in personas if p['name'] == persona), None)
    persona_photo = persona_data.get('photo') if persona_data else None
    
    # Resolve message count for dynamic progress math
    message_count = await db.get_chat_history_count(case_id)
    
    # Check if spy mode is enabled
    spy_mode = await db.get_user_spy_mode(user_id)
    
    ai_model = await db.get_case_ai_model(case_id)
    
    return {
        "id": case_id,
        "target": target,
        "display_name": display_name,
        "holiday": holiday,
        "context": context,
        "persona": persona,
        "persona_photo": persona_photo,
        "message_count": message_count,
        "case_number": get_case_number(case_id),
        "budget": budget,
        "status": status,
        "report": report,
        "spy_mode": spy_mode,
        "target_photo": target_photo,
        "target_db_id": target_db_id,
        "created_at": created_at,
        "completed_at": completed_at,
        "ai_model": ai_model,
    }

@app.get("/api/cases/{case_id}/chat")
async def get_case_chat(case_id: int, user_id: int = Depends(get_current_user)):
    case = await db.get_case_by_id(case_id)
    if not case or case[1] != user_id:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Premium check
    if not await db.is_premium(user_id):
        raise HTTPException(status_code=403, detail="Требуется Премиум подписка")
    
    spy_mode = await db.get_user_spy_mode(user_id)
    if not spy_mode:
         raise HTTPException(status_code=403, detail="Spy mode required")

    history = await db.get_chat_history(case_id)
    return [
        {"sender": sender, "message": message, "timestamp": timestamp}
        for sender, message, timestamp in history
    ]


@app.post("/api/cases")
async def create_case(data: CaseCreate, user_id: int = Depends(get_current_user)):
    # Premium users have unlimited investigations
    has_premium = await db.is_premium(user_id)
    if not has_premium:
        balance = await db.get_user_balance(user_id)
        if isinstance(balance, int) and balance <= 0:
            raise HTTPException(status_code=402, detail="Insufficient balance")
    
    # Check no active case for this target
    existing = await db.get_active_case_by_target(data.target)
    if existing:
        raise HTTPException(status_code=409, detail="Active case already exists for this target")
    
    # Secure server-side check: only premium users can select custom models
    selected_model = data.ai_model if has_premium else 'deepseek-v4'
    
    if not has_premium:
        await db.deduct_balance(user_id)
    case_id = await db.add_case(user_id, data.target, data.holiday, data.context, data.persona, data.budget, ai_model=selected_model)
    
    # Auto-save target if not exists
    saved = await db.find_target_by_identifier(user_id, data.target)
    if not saved:
        await db.add_target(user_id, data.target)
    
    return {"id": case_id}


# ================= PERSONAS =================

class CustomDetectiveCreate(BaseModel):
    name: str
    description: str
    ai_description: str
    photo_url: str
    emojis: Optional[str] = "🕵️‍♂️, 🎁, ✨, 🤫, 🔍"
    is_public: Optional[bool] = False
    specialty: Optional[str] = "Секретное расследование 🕵️‍♂️"
    skills: Optional[list] = []

class AvatarGenerate(BaseModel):
    prompt: str
    provider: Optional[str] = "dall-e-3"

@app.get("/api/personas")
async def list_personas(user_id: int = Depends(get_current_user)):
    personas = await db.get_personas(user_id)
    return [
        {
            "index": i,
            "id": p["id"],
            "name": p["name"],
            "desc": p["desc"],
            "photo": p["photo"],
            "emojis": p.get("emojis", ""),
            "ai_description": p.get("ai_description", ""),
            "creator_id": p.get("creator_id"),
            "is_public": p.get("is_public", False),
            "is_approved": p.get("is_approved", True),
            "specialty": p.get("specialty"),
            "skills": p.get("skills")
        }
        for i, p in enumerate(personas)
    ]

@app.get("/api/personas/public")
async def list_public_personas(user_id: int = Depends(get_current_user)):
    return await db.get_public_detectives(user_id)

@app.post("/api/personas")
async def create_persona(data: CustomDetectiveCreate, user_id: int = Depends(get_current_user)):
    if not await db.is_premium(user_id):
        raise HTTPException(status_code=403, detail="Требуется Премиум подписка")
    
    name = data.name.strip()[:32]
    if not name:
        raise HTTPException(status_code=400, detail="Имя не может быть пустым")
        
    desc = data.description.strip()[:200]
    ai_desc = data.ai_description.strip()[:2000]
    
    det_id = await db.create_custom_detective(
        creator_id=user_id,
        name=name,
        description=desc,
        ai_description=ai_desc,
        photo_url=data.photo_url,
        emojis=data.emojis or '🕵️‍♂️, 🎁, ✨, 🤫, 🔍',
        is_public=data.is_public,
        is_approved=True,  # Default to True, moderation check is visual on UI warning
        specialty=data.specialty or 'Секретное расследование 🕵️‍♂️',
        skills=data.skills
    )
    return {"id": det_id}

@app.post("/api/personas/{det_id}/add")
async def add_persona_to_lib(det_id: int, user_id: int = Depends(get_current_user)):
    await db.add_detective_to_library(user_id, det_id)
    return {"ok": True}

@app.delete("/api/personas/{det_id}/remove")
async def remove_persona_from_lib(det_id: int, user_id: int = Depends(get_current_user)):
    await db.remove_detective_from_library(user_id, det_id)
    return {"ok": True}

@app.post("/api/personas/generate-avatar")
async def generate_avatar_endpoint(data: AvatarGenerate, user_id: int = Depends(get_current_user)):
    if not await db.is_premium(user_id):
        raise HTTPException(status_code=403, detail="Требуется Премиум подписка")
        
    if not data.prompt.strip():
        raise HTTPException(status_code=400, detail="Описание не может быть пустым")
        
    try:
        from services.ai_detective import AIDetectiveService
        ai_service = AIDetectiveService()
        image_bytes = await ai_service.generate_avatar(data.prompt.strip(), data.provider)
        
        # Upload to Supabase Storage
        photo_url = await db.upload_detective_avatar(user_id, image_bytes)
        return {"photo_url": photo_url}
    except Exception as e:
        logging.error(f"Failed to generate and upload avatar: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/personas/upload-avatar")
async def upload_avatar_endpoint(file: UploadFile = File(...), user_id: int = Depends(get_current_user)):
    if not await db.is_premium(user_id):
        raise HTTPException(status_code=403, detail="Требуется Премиум подписка")
        
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(status_code=400, detail="Файл слишком большой")
        
    try:
        photo_url = await db.upload_detective_avatar(user_id, file_bytes)
        return {"photo_url": photo_url}
    except Exception as e:
        logging.error(f"Failed to upload avatar: {e}")
        raise HTTPException(status_code=500, detail="Ошибка загрузки изображения")

@app.get("/api/personas/{det_id}")
async def get_persona_endpoint(det_id: int, user_id: int = Depends(get_current_user)):
    p = await db.get_detective_by_id(det_id)
    if not p:
        raise HTTPException(status_code=404, detail="Detective not found")
    
    # Разрешаем просмотр, если это:
    # 1. Системный детектив (creator_id is None)
    # 2. Собственный кастомный детектив (creator_id == user_id)
    # 3. Публичный и одобренный детектив другого пользователя
    is_owner = p.get('creator_id') == user_id
    is_system = p.get('creator_id') is None
    is_public_approved = p.get('is_public', False) and p.get('is_approved', True)
    
    if not (is_system or is_owner or is_public_approved):
        raise HTTPException(status_code=404, detail="Detective not found")
    return p

@app.put("/api/personas/{det_id}")
async def update_persona_endpoint(det_id: int, data: CustomDetectiveCreate, user_id: int = Depends(get_current_user)):
    if not await db.is_premium(user_id):
        raise HTTPException(status_code=403, detail="Требуется Премиум подписка")
    
    await db.update_custom_detective(
        user_id=user_id,
        detective_id=det_id,
        name=data.name.strip()[:32],
        description=data.description.strip()[:200],
        ai_description=data.ai_description.strip()[:2000],
        photo_url=data.photo_url,
        emojis=data.emojis or '🕵️‍♂️, 🎁, ✨, 🤫, 🔍',
        is_public=data.is_public,
        specialty=data.specialty or 'Секретное расследование 🕵️‍♂️',
        skills=data.skills
    )
    return {"ok": True}

@app.delete("/api/personas/{det_id}")
async def delete_persona_endpoint(det_id: int, user_id: int = Depends(get_current_user)):
    if not await db.is_premium(user_id):
        raise HTTPException(status_code=403, detail="Требуется Премиум подписка")
    
    await db.delete_custom_detective(user_id, det_id)
    return {"ok": True}

@app.post("/api/settings/custom-detectives")
async def toggle_custom_detectives_endpoint(user_id: int = Depends(get_current_user)):
    if not await db.is_premium(user_id):
        raise HTTPException(status_code=403, detail="Требуется Премиум подписка для этой функции")
    new_val = await db.toggle_custom_detectives(user_id)
    return {"custom_detectives_enabled": bool(new_val)}


# ================= SETTINGS =================

class ChatMessage(BaseModel):
    message: str

@app.post("/api/settings/spy-mode")
async def toggle_spy_mode_endpoint(user_id: int = Depends(get_current_user)):
    # Premium check
    if not await db.is_premium(user_id):
        raise HTTPException(status_code=403, detail="Требуется Премиум подписка для шпионского режима")
    new_val = await db.toggle_spy_mode(user_id)
    return {"spy_mode": bool(new_val)}

@app.post("/api/settings/model-selector")
async def toggle_model_selector_endpoint(user_id: int = Depends(get_current_user)):
    # Premium check
    if not await db.is_premium(user_id):
        raise HTTPException(status_code=403, detail="Требуется Премиум подписка для этой функции")
    new_val = await db.toggle_model_selector(user_id)
    return {"model_selector_enabled": bool(new_val)}


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
    
    # Premium check
    if not await db.is_premium(user_id):
        raise HTTPException(status_code=403, detail="Требуется Премиум подписка для перехвата")
    
    status = case[7]
    if status not in ('started', 'in_progress'):
        raise HTTPException(status_code=400, detail="Cannot intercept in this status")
    
    await db.update_case_status(case_id, 'manual_mode')
    # Add system message
    await db.save_chat_message(case_id, 'system', '🛑 Вы перехватили управление')
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
    # Add system message
    await db.save_chat_message(case_id, 'system', '🕵️ Управление возвращено детективу')
    
    # Generate comeback message (detective resumes conversation)
    target = case[2]
    asyncio.ensure_future(_send_comeback(case_id, case, target, user_id))
    
    return {"ok": True, "status": "in_progress"}


async def _send_comeback(case_id: int, case, target: str, customer_id: int):
    """Background task: generate and send a comeback message from the detective."""
    try:
        from main import client, update_spy_message
        from services.ai_detective import AIDetectiveService
        from services.scheduler import resolve_target
        from bot.keyboards.common import resolve_target_display_name
        
        ai = AIDetectiveService()
        chat_session = await ai.restore_chat_from_db(
            case_id, case[3], case[4], case[5], case[6]
        )
        comeback_msg = await ai.generate_comeback_message(chat_session)
        
        if comeback_msg:
            target_entity = await resolve_target(client, target)
            if target_entity:
                await client.send_message(target_entity, comeback_msg)
                await db.save_chat_message(case_id, 'ai', comeback_msg)
                
                # Update spy message if enabled
                spy_mode = await db.get_user_spy_mode(customer_id)
                if spy_mode:
                    display_name = await resolve_target_display_name(customer_id, target)
                    await update_spy_message(case_id, customer_id, display_name, case[5])
    except Exception as e:
        logging.error(f"Comeback message failed: {e}")


@app.post("/api/cases/{case_id}/cancel")
async def cancel_case_endpoint(case_id: int, user_id: int = Depends(get_current_user)):
    case = await db.get_case_by_id(case_id)
    if not case or case[1] != user_id:
        raise HTTPException(status_code=404, detail="Case not found")
    
    status = case[7]
    if status not in ('pending', 'started', 'in_progress', 'manual_mode'):
        raise HTTPException(status_code=400, detail="Нельзя отменить завершённое дело")
    
    await db.cancel_case(case_id)
    
    # Refund only for non-premium users
    has_premium = await db.is_premium(user_id)
    refunded = False
    if not has_premium:
        await db.refund_balance(user_id)
        refunded = True
    
    return {"ok": True, "refunded": refunded}


@app.delete("/api/cases/{case_id}")
async def delete_case_endpoint(case_id: int, user_id: int = Depends(get_current_user)):
    case = await db.get_case_by_id(case_id)
    if not case or case[1] != user_id:
        raise HTTPException(status_code=404, detail="Case not found")
    
    status = case[7]
    if status in ('pending', 'started', 'in_progress', 'manual_mode'):
        raise HTTPException(status_code=400, detail="Нельзя удалить активное дело. Сначала отмените его.")
    
    await db.delete_case(case_id)
    return {"ok": True}


# ================= BALANCE =================

@app.get("/api/balance")
async def get_balance(user_id: int = Depends(get_current_user)):
    balance = await db.get_user_balance(user_id)
    return {"balance": balance}


# ================= PAYMENTS (YooKassa Direct) =================

PRODUCTS = {
    "inv_1": {"title": "1 Расследование", "amount": "1.00", "display_price": "1"},
    "inv_3": {"title": "3 Расследования", "amount": "249.00", "display_price": "249"},
    "prem_1": {"title": "Премиум (1 Месяц)", "amount": "1.00", "display_price": "1"},
}

class PaymentCreate(BaseModel):
    product_id: str  # "inv_1", "inv_3", "prem_1"

@app.post("/api/payments/create")
async def create_payment(data: PaymentCreate, user_id: int = Depends(get_current_user)):
    """Creates a YooKassa payment and returns the confirmation URL."""
    import uuid
    from yookassa import Configuration, Payment
    import config

    product = PRODUCTS.get(data.product_id)
    if not product:
        raise HTTPException(status_code=400, detail="Unknown product")

    if not config.YOOKASSA_SHOP_ID or not config.YOOKASSA_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payment system not configured")

    Configuration.account_id = config.YOOKASSA_SHOP_ID
    Configuration.secret_key = config.YOOKASSA_SECRET_KEY

    try:
        payment = Payment.create({
            "amount": {
                "value": product["amount"],
                "currency": "RUB"
            },
            "confirmation": {
                "type": "redirect",
                "return_url": f"https://t.me/{config.BOT_USERNAME}?startapp=store"
            },
            "capture": True,
            "description": product["title"],
            "metadata": {
                "user_id": str(user_id),
                "payload": data.product_id
            }
        }, str(uuid.uuid4()))

        return {"payment_url": payment.confirmation.confirmation_url}
    except Exception as e:
        logging.error(f"YooKassa payment creation error: {e}")
        raise HTTPException(status_code=500, detail="Payment creation failed")


@app.post("/api/payments/webhook")
async def yookassa_webhook(request: Request):
    """Handles YooKassa payment notifications (no auth required — called by YooKassa)."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = body.get("event")
    if event_type != "payment.succeeded":
        return {"ok": True}  # Ignore other events

    payment_obj = body.get("object", {})
    metadata = payment_obj.get("metadata", {})
    user_id_str = metadata.get("user_id")
    payload = metadata.get("payload")

    if not user_id_str or not payload:
        logging.warning(f"YooKassa webhook: missing metadata: {metadata}")
        return {"ok": True}

    user_id = int(user_id_str)
    logging.info(f"YooKassa payment succeeded: user={user_id}, payload={payload}")

    if payload == "inv_1":
        await db.add_balance(user_id, 1)
        logging.info(f"User {user_id}: +1 investigation")
    elif payload == "inv_3":
        await db.add_balance(user_id, 3)
        logging.info(f"User {user_id}: +3 investigations")
    elif payload == "prem_1":
        await db.set_premium(user_id, 30)
        logging.info(f"User {user_id}: Premium activated for 30 days")
    else:
        logging.warning(f"Unknown payload: {payload}")

    # Notify user via bot (best effort)
    try:
        import config as cfg
        from aiogram import Bot
        bot = Bot(token=cfg.BOT_TOKEN)
        if payload == "prem_1":
            await bot.send_message(user_id, "👑 Оплата успешна! Премиум активирован на 1 месяц.")
        else:
            count = 1 if payload == "inv_1" else 3
            await bot.send_message(user_id, f"🎉 Оплата успешна! +{count} расследований добавлено на баланс.")
        await bot.session.close()
    except Exception as e:
        logging.error(f"Failed to notify user {user_id}: {e}")

    return {"ok": True}


@app.post("/api/cases/test-self")
async def create_test_self_case(data: TestCaseCreate, user_id: int = Depends(get_current_user)):
    # Check if they already used it
    has_tested = await db.has_user_tested_detective(user_id)
    if has_tested:
        raise HTTPException(status_code=400, detail="Вы уже воспользовались бесплатным тестом.")
    
    target_username = data.target_username.strip()
    if not target_username:
        raise HTTPException(status_code=400, detail="Имя пользователя цели не может быть пустым.")
        
    if not target_username.startswith('@'):
        target_username = '@' + target_username
        
    # Check no active case for this target
    existing = await db.get_active_case_by_target(target_username)
    if existing:
        raise HTTPException(status_code=409, detail="У вас уже есть активное расследование по этой цели.")
        
    # Create the case
    case_id = await db.add_case(
        customer_id=user_id,
        target=target_username,
        holiday=data.holiday or "Тестовое расследование 🧪",
        context=data.context or "",
        persona=data.persona,
        budget=data.budget or "Любой",
        ai_model=data.ai_model or "deepseek-v4"
    )
    
    # Auto-save target if not exists
    saved = await db.find_target_by_identifier(user_id, target_username)
    if not saved:
        await db.add_target(user_id, target_username)
        
    # Mark as tested
    try:
        await db.set_user_tested_detective(user_id, True)
    except Exception as e:
        logging.error(f"Failed to set has_tested_detective: {e}")
        
    return {"id": case_id}


@app.post("/api/personas/surprise-me")
async def surprise_me_persona(user_id: int = Depends(get_current_user)):
    if not await db.is_premium(user_id):
        raise HTTPException(status_code=403, detail="Требуется Премиум подписка")
        
    try:
        from services.ai_detective import AIDetectiveService
        ai_service = AIDetectiveService()
        result = await ai_service.generate_surprise_detective()
        return result
    except Exception as e:
        logging.error(f"Failed to generate surprise detective: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка генерации персонажа: {str(e)}")


# ================= STARTUP =================

@app.on_event("startup")
async def startup():
    await db.init_db()
    logging.info("Mini App API started")

