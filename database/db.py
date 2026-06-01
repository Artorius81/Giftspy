import asyncio
import logging
from datetime import datetime
from supabase import create_client, Client
import config

_client: Client = None


async def init_db():
    """Initialize Supabase client (replaces SQLite init) and run auto-migration."""
    global _client
    _client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)
    logging.info("Supabase client initialized.")
    
    # Run auto-migration
    try:
        import os
        from sqlalchemy import create_engine
        from database.auto_migrate import perform_auto_migration
        
        db_url = os.getenv("DATABASE_URL")
        if db_url:
            logging.info("Starting database auto-migration via SQLAlchemy...")
            engine = create_engine(db_url)
            await asyncio.to_thread(perform_auto_migration, engine)
        else:
            logging.warning("DATABASE_URL not found in environment, skipping auto-migration.")
    except Exception as e:
        logging.error(f"Failed to run auto-migration: {e}")


# ================= CASES =================

async def add_case(customer_id, target, holiday, context, persona, budget, ai_model='deepseek-v4'):
    result = await asyncio.to_thread(
        lambda: _client.table('cases').insert({
            'customer_id': customer_id,
            'target': target,
            'holiday': holiday,
            'context': context,
            'persona': persona,
            'budget': budget,
            'ai_model': ai_model
        }).execute()
    )
    return result.data[0]['id']


async def get_pending_cases():
    result = await asyncio.to_thread(
        lambda: _client.table('cases')
            .select('id, customer_id, target, holiday, context, persona, budget, status, report, ai_model')
            .eq('status', 'pending')
            .execute()
    )
    return [(r['id'], r['customer_id'], r['target'], r['holiday'], r['context'],
             r['persona'], r['budget'], r['status'], r['report'], r.get('ai_model', 'deepseek-v4')) for r in result.data]


async def get_case_ai_model(case_id):
    result = await asyncio.to_thread(
        lambda: _client.table('cases')
            .select('ai_model')
            .eq('id', case_id)
            .execute()
    )
    if result.data and 'ai_model' in result.data[0]:
        return result.data[0]['ai_model'] or 'deepseek-v4'
    return 'deepseek-v4'


async def get_started_cases():
    result = await asyncio.to_thread(
        lambda: _client.table('cases')
            .select('id, customer_id, target')
            .eq('status', 'started')
            .execute()
    )
    return [(r['id'], r['customer_id'], r['target']) for r in result.data]


async def get_done_cases():
    result = await asyncio.to_thread(
        lambda: _client.table('cases')
            .select('id, customer_id, target, report')
            .eq('status', 'done')
            .execute()
    )
    return [(r['id'], r['customer_id'], r['target'], r['report']) for r in result.data]


async def update_case_status(case_id, status, report=""):
    update_data = {'status': status, 'report': report}
    # Auto-set completed_at for terminal statuses
    if status in ('done', 'delivered', 'cancelled', 'error'):
        try:
            update_data['completed_at'] = datetime.utcnow().isoformat()
        except Exception:
            pass
    await asyncio.to_thread(
        lambda: _client.table('cases')
            .update(update_data)
            .eq('id', case_id)
            .execute()
    )


async def mark_case_delivered(case_id):
    await asyncio.to_thread(
        lambda: _client.table('cases')
            .update({'status': 'delivered'})
            .eq('id', case_id)
            .execute()
    )


async def get_user_active_cases(customer_id):
    result = await asyncio.to_thread(
        lambda: _client.table('cases')
            .select('id, target, status')
            .eq('customer_id', customer_id)
            .in_('status', ['pending', 'started', 'in_progress', 'manual_mode'])
            .execute()
    )
    return [(r['id'], r['target'], r['status']) for r in result.data]


async def get_user_finished_cases(customer_id):
    result = await asyncio.to_thread(
        lambda: _client.table('cases')
            .select('id, target, report')
            .eq('customer_id', customer_id)
            .in_('status', ['done', 'delivered'])
            .order('id', desc=True)
            .execute()
    )
    return [(r['id'], r['target'], r['report']) for r in result.data]


async def get_case_report(case_id):
    result = await asyncio.to_thread(
        lambda: _client.table('cases')
            .select('target, report')
            .eq('id', case_id)
            .execute()
    )
    if result.data:
        r = result.data[0]
        return (r['target'], r['report'])
    return None


async def check_target_status(target):
    result = await asyncio.to_thread(
        lambda: _client.table('cases')
            .select('status, report')
            .eq('target', target)
            .order('id', desc=True)
            .limit(1)
            .execute()
    )
    if result.data:
        r = result.data[0]
        return (r['status'], r['report'])
    return None


async def get_active_case_by_target(target):
    result = await asyncio.to_thread(
        lambda: _client.table('cases')
            .select('id, customer_id, target, holiday, context, persona, budget, status, report')
            .eq('target', target)
            .in_('status', ['pending', 'started', 'in_progress', 'manual_mode'])
            .order('id', desc=True)
            .limit(1)
            .execute()
    )
    if result.data:
        r = result.data[0]
        return (r['id'], r['customer_id'], r['target'], r['holiday'], r['context'],
                r['persona'], r['budget'], r['status'], r['report'])
    return None


async def get_case_by_id(case_id):
    try:
        result = await asyncio.to_thread(
            lambda: _client.table('cases')
                .select('id, customer_id, target, holiday, context, persona, budget, status, report, created_at, completed_at')
                .eq('id', case_id)
                .execute()
        )
    except Exception:
        # Fallback if completed_at column doesn't exist yet
        result = await asyncio.to_thread(
            lambda: _client.table('cases')
                .select('id, customer_id, target, holiday, context, persona, budget, status, report, created_at')
                .eq('id', case_id)
                .execute()
        )
    if result.data:
        r = result.data[0]
        return (r['id'], r['customer_id'], r['target'], r['holiday'], r['context'],
                r['persona'], r['budget'], r['status'], r['report'], r.get('created_at'), r.get('completed_at'))
    return None


# ================= SPY MESSAGE TRACKING =================

async def set_spy_message_id(case_id, message_id):
    await asyncio.to_thread(
        lambda: _client.table('cases')
            .update({'spy_message_id': message_id})
            .eq('id', case_id)
            .execute()
    )


async def get_spy_message_id(case_id):
    result = await asyncio.to_thread(
        lambda: _client.table('cases')
            .select('spy_message_id')
            .eq('id', case_id)
            .execute()
    )
    if result.data:
        return result.data[0]['spy_message_id']
    return None


# ================= CHAT HISTORY =================

async def save_chat_message(case_id, sender, message):
    await asyncio.to_thread(
        lambda: _client.table('chat_history').insert({
            'case_id': case_id,
            'sender': sender,
            'message': message
        }).execute()
    )


async def get_chat_history(case_id):
    result = await asyncio.to_thread(
        lambda: _client.table('chat_history')
            .select('sender, message, timestamp')
            .eq('case_id', case_id)
            .order('timestamp')
            .execute()
    )
    return [(r['sender'], r['message'], r['timestamp']) for r in result.data]


async def get_chat_history_count(case_id):
    result = await asyncio.to_thread(
        lambda: _client.table('chat_history')
            .select('id', count='exact')
            .eq('case_id', case_id)
            .execute()
    )
    return result.count or 0


async def get_chat_message_at(case_id, index):
    """Получает сообщение по индексу (0-based) для пагинации spy mode."""
    result = await asyncio.to_thread(
        lambda: _client.table('chat_history')
            .select('sender, message')
            .eq('case_id', case_id)
            .order('timestamp')
            .range(index, index)
            .execute()
    )
    if result.data:
        r = result.data[0]
        return (r['sender'], r['message'])
    return None


# ================= USER PROFILE =================

async def upload_profile_photo(user_id: int, file_bytes: bytes) -> str:
    """Uploads photo to Supabase storage and returns public URL."""
    import time
    file_name = f"{user_id}_{int(time.time())}.jpg"
    
    # Upload to storage
    await asyncio.to_thread(
        lambda: _client.storage.from_("profile_photo").upload(
            path=file_name,
            file=file_bytes,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
    )
    
    # Get public URL
    url = _client.storage.from_("profile_photo").get_public_url(file_name)
    return url


async def upload_target_photo(target_identifier: str, file_bytes: bytes) -> str:
    """Uploads target's photo to Supabase storage and returns public URL."""
    import time
    import re
    # Replace non-alphanumeric chars for safety
    safe_id = re.sub(r'[^a-zA-Z0-9_]', '_', str(target_identifier))
    file_name = f"{safe_id}_{int(time.time())}.jpg"
    
    # Try to create bucket if it doesn't exist
    try:
        await asyncio.to_thread(
            lambda: _client.storage.create_bucket(
                "targets_photo",
                options={"public": True}
            )
        )
    except Exception:
        pass  # Bucket already exists
    
    # Upload to storage
    await asyncio.to_thread(
        lambda: _client.storage.from_("targets_photo").upload(
            path=file_name,
            file=file_bytes,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
    )
    
    # Get public URL
    url = _client.storage.from_("targets_photo").get_public_url(file_name)
    return url


async def upload_target_photo_fallback(target_identifier: str, file_bytes: bytes) -> str:
    """Fallback: uploads target photo to the profile_photo bucket which is known to work."""
    import time
    import re
    safe_id = re.sub(r'[^a-zA-Z0-9_]', '_', str(target_identifier))
    file_name = f"target_{safe_id}_{int(time.time())}.jpg"
    
    await asyncio.to_thread(
        lambda: _client.storage.from_("profile_photo").upload(
            path=file_name,
            file=file_bytes,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
    )
    
    url = _client.storage.from_("profile_photo").get_public_url(file_name)
    return url


async def is_user_exists(user_id: int) -> bool:
    """Checks if user already exists in DB."""
    result = await asyncio.to_thread(
        lambda: _client.table('users').select('id').eq('id', user_id).execute()
    )
    return len(result.data) > 0


async def _ensure_user(user_id):
    """Ensures user exists in DB (INSERT IF NOT EXISTS)."""
    await asyncio.to_thread(
        lambda: _client.table('users').upsert(
            {'id': user_id},
            on_conflict='id',
            ignore_duplicates=True
        ).execute()
    )


async def get_user_profile(user_id):
    """Returns (balance, premium_until, successful, active, nickname, spy_mode, birthday, description, photo_file_id)"""
    await _ensure_user(user_id)
    
    user_result = await asyncio.to_thread(
        lambda: _client.table('users')
            .select('balance, premium_until, nickname, spy_mode, birthday, description, photo_file_id')
            .eq('id', user_id)
            .execute()
    )
    
    row = user_result.data[0] if user_result.data else {}
    balance = row.get('balance', 1)
    premium_until = row.get('premium_until')
    nickname = row.get('nickname')
    spy_mode = bool(row.get('spy_mode', False))
    birthday = row.get('birthday')
    description = row.get('description')
    photo = row.get('photo_file_id')
    
    cases_result = await asyncio.to_thread(
        lambda: _client.table('cases')
            .select('status')
            .eq('customer_id', user_id)
            .execute()
    )
    
    successful = sum(1 for c in cases_result.data if c['status'] in ('done', 'delivered'))
    active = sum(1 for c in cases_result.data if c['status'] in ('pending', 'started', 'in_progress', 'manual_mode'))
    
    return balance, premium_until, successful, active, nickname, spy_mode, birthday, description, photo


async def get_user_balance(user_id):
    await _ensure_user(user_id)
    result = await asyncio.to_thread(
        lambda: _client.table('users')
            .select('balance, premium_until')
            .eq('id', user_id)
            .execute()
    )
    if result.data:
        balance = result.data[0]['balance']
        premium_until = result.data[0]['premium_until']
        
        # Give unlimited if premium
        if premium_until:
            from datetime import datetime
            if datetime.fromisoformat(premium_until) > datetime.utcnow():
                return "Безлимит 👑"
            
        return balance
    return 1


async def deduct_balance(user_id, amount=1):
    # Check if premium first
    result = await asyncio.to_thread(
        lambda: _client.table('users').select('premium_until').eq('id', user_id).execute()
    )
    if result.data and result.data[0]['premium_until']:
        from datetime import datetime
        if datetime.fromisoformat(result.data[0]['premium_until']) > datetime.utcnow():
            return # Don't deduct, user has premium
            
    await asyncio.to_thread(
        lambda: _client.rpc('deduct_balance', {
            'p_user_id': user_id,
            'p_amount': amount
        }).execute()
    )

async def add_balance(user_id, amount):
    await _ensure_user(user_id)
    # Fetch current balance
    result = await asyncio.to_thread(
        lambda: _client.table('users').select('balance').eq('id', user_id).execute()
    )
    current_balance = result.data[0]['balance'] if result.data else 0
    new_balance = current_balance + amount
    
    await asyncio.to_thread(
        lambda: _client.table('users')
            .update({'balance': new_balance})
            .eq('id', user_id)
            .execute()
    )

async def set_premium(user_id, days):
    await _ensure_user(user_id)
    from datetime import datetime, timedelta
    
    # Check if user already has premium to stack it
    result = await asyncio.to_thread(
        lambda: _client.table('users').select('premium_until').eq('id', user_id).execute()
    )
    
    current_premium = None
    if result.data and result.data[0]['premium_until']:
        try:
            current_premium = datetime.fromisoformat(result.data[0]['premium_until'])
        except:
            pass
            
    now = datetime.utcnow()
    if current_premium and current_premium > now:
        new_premium_until = current_premium + timedelta(days=days)
    else:
        new_premium_until = now + timedelta(days=days)
        
    await asyncio.to_thread(
        lambda: _client.table('users')
            .update({
                'premium_until': new_premium_until.isoformat(),
                'spy_mode': True # also enable spy mode for premium users
            })
            .eq('id', user_id)
            .execute()
    )


async def is_premium(user_id) -> bool:
    """Checks if user has active premium subscription."""
    await _ensure_user(user_id)
    result = await asyncio.to_thread(
        lambda: _client.table('users').select('premium_until').eq('id', user_id).execute()
    )
    if result.data and result.data[0]['premium_until']:
        if datetime.fromisoformat(result.data[0]['premium_until']) > datetime.utcnow():
            return True
    return False


async def update_user_nickname(user_id, nickname):
    await _ensure_user(user_id)
    await asyncio.to_thread(
        lambda: _client.table('users')
            .update({'nickname': nickname})
            .eq('id', user_id)
            .execute()
    )


async def update_user_field(user_id, field, value):
    """Updates a single user profile field."""
    allowed = ('nickname', 'birthday', 'description', 'photo_file_id')
    if field not in allowed:
        return
    await _ensure_user(user_id)
    await asyncio.to_thread(
        lambda: _client.table('users')
            .update({field: value})
            .eq('id', user_id)
            .execute()
    )


async def toggle_spy_mode(user_id):
    result = await asyncio.to_thread(
        lambda: _client.rpc('toggle_spy_mode', {
            'p_user_id': user_id
        }).execute()
    )
    return bool(result.data)


async def get_user_spy_mode(user_id):
    await _ensure_user(user_id)
    result = await asyncio.to_thread(
        lambda: _client.table('users')
            .select('spy_mode')
            .eq('id', user_id)
            .execute()
    )
    if result.data:
        return bool(result.data[0]['spy_mode'])
    return False


async def get_user_model_selector_enabled(user_id) -> bool:
    await _ensure_user(user_id)
    result = await asyncio.to_thread(
        lambda: _client.table('users')
            .select('model_selector_enabled')
            .eq('id', user_id)
            .execute()
    )
    if result.data and 'model_selector_enabled' in result.data[0]:
        val = result.data[0]['model_selector_enabled']
        return bool(val) if val is not None else False
    return False


async def toggle_model_selector(user_id) -> bool:
    current = await get_user_model_selector_enabled(user_id)
    new_val = not current
    await asyncio.to_thread(
        lambda: _client.table('users')
            .update({'model_selector_enabled': new_val})
            .eq('id', user_id)
            .execute()
    )
    return new_val


async def get_all_user_cases(customer_id):
    try:
        result = await asyncio.to_thread(
            lambda: _client.table('cases')
                .select('id, target, status, report, holiday, persona, budget, created_at, completed_at')
                .eq('customer_id', customer_id)
                .order('id', desc=True)
                .execute()
        )
    except Exception:
        # Fallback if completed_at column doesn't exist yet
        result = await asyncio.to_thread(
            lambda: _client.table('cases')
                .select('id, target, status, report, holiday, persona, budget, created_at')
                .eq('customer_id', customer_id)
                .order('id', desc=True)
                .execute()
        )
    return [(r['id'], r['target'], r['status'], r['report'], r.get('holiday'), r.get('persona'),
             r.get('budget'), r.get('created_at'), r.get('completed_at')) for r in result.data]


# ================= TARGETS =================

async def add_target(owner_id, identifier, name=None, habits=None, birthday=None, photo_file_id=None):
    data = {'owner_id': owner_id, 'identifier': identifier}
    if name is not None:
        data['name'] = name
    if habits is not None:
        data['habits'] = habits
    if birthday is not None:
        data['birthday'] = birthday
    if photo_file_id is not None:
        data['photo_file_id'] = photo_file_id
    
    result = await asyncio.to_thread(
        lambda: _client.table('targets').insert(data).execute()
    )
    return result.data[0]['id']


async def get_user_targets(owner_id):
    targets_res = await asyncio.to_thread(
        lambda: _client.table('targets')
            .select('id, identifier, name, habits, birthday, photo_file_id')
            .eq('owner_id', owner_id)
            .order('id', desc=True)
            .execute()
    )
    if not targets_res.data:
        return []
        
    target_ids = [t['id'] for t in targets_res.data]
    
    # Запрашиваем количество подарков для каждой цели
    wishlist_counts_res = await asyncio.to_thread(
        lambda: _client.table('wishlist')
            .select('target_id')
            .in_('target_id', target_ids)
            .execute()
    )
    
    # Считаем количество в Python
    counts = {}
    for w in wishlist_counts_res.data:
        tid = w['target_id']
        counts[tid] = counts.get(tid, 0) + 1
        
    return [
        (r['id'], r['identifier'], r['name'], r['habits'], r['birthday'], r['photo_file_id'], counts.get(r['id'], 0))
        for r in targets_res.data
    ]


async def get_target_by_id(target_id):
    result = await asyncio.to_thread(
        lambda: _client.table('targets')
            .select('id, owner_id, identifier, name, habits, birthday, photo_file_id')
            .eq('id', target_id)
            .execute()
    )
    if result.data:
        r = result.data[0]
        return (r['id'], r['owner_id'], r['identifier'], r['name'], r['habits'], r['birthday'], r['photo_file_id'])
    return None


async def update_target(target_id, **kwargs):
    allowed = {'name', 'habits', 'birthday', 'photo_file_id', 'identifier'}
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if updates:
        await asyncio.to_thread(
            lambda: _client.table('targets')
                .update(updates)
                .eq('id', target_id)
                .execute()
        )


async def delete_target(target_id):
    """Удаляет цель, её вишлист и отменяет активные дела."""
    # Get target data before deleting
    result = await asyncio.to_thread(
        lambda: _client.table('targets')
            .select('identifier, owner_id')
            .eq('id', target_id)
            .execute()
    )
    
    if result.data:
        identifier = result.data[0]['identifier']
        owner_id = result.data[0]['owner_id']
        # Cancel active cases for this target
        await asyncio.to_thread(
            lambda: _client.table('cases')
                .update({'status': 'cancelled'})
                .eq('customer_id', owner_id)
                .eq('target', identifier)
                .in_('status', ['pending', 'started', 'in_progress', 'manual_mode'])
                .execute()
        )
    
    # Wishlist cascade-deletes via FK; delete target
    await asyncio.to_thread(
        lambda: _client.table('targets')
            .delete()
            .eq('id', target_id)
            .execute()
    )


async def find_target_by_identifier(owner_id, identifier):
    result = await asyncio.to_thread(
        lambda: _client.table('targets')
            .select('id, identifier, name, habits, birthday, photo_file_id')
            .eq('owner_id', owner_id)
            .eq('identifier', identifier)
            .execute()
    )
    if result.data:
        r = result.data[0]
        return (r['id'], r['identifier'], r['name'], r['habits'], r['birthday'], r['photo_file_id'])
    return None


# ================= WISHLIST =================

async def add_to_wishlist(target_id, gift_description, category='Другое', added_by='user', case_id=None, holiday=None):
    data = {
        'target_id': target_id,
        'gift_description': gift_description,
        'category': category,
        'added_by': added_by
    }
    if case_id is not None:
        data['case_id'] = case_id
    if holiday is not None:
        data['holiday'] = holiday
    await asyncio.to_thread(
        lambda: _client.table('wishlist').insert(data).execute()
    )


async def get_wishlist(target_id):
    result = await asyncio.to_thread(
        lambda: _client.table('wishlist')
            .select('id, gift_description, added_by, created_at, category')
            .eq('target_id', target_id)
            .order('category')
            .order('id', desc=True)
            .execute()
    )
    return [(r['id'], r['gift_description'], r['added_by'], r['created_at'], r['category'])
            for r in result.data]


async def get_wishlist_grouped(target_id):
    """Возвращает вишлист с данными расследования."""
    # Fetch wishlist with embedded case data via FK
    result = await asyncio.to_thread(
        lambda: _client.table('wishlist')
            .select('id, gift_description, added_by, created_at, category, case_id, received, holiday, cases(holiday, created_at)')
            .eq('target_id', target_id)
            .order('case_id', desc=True)
            .order('id', desc=True)
            .execute()
    )
    rows = []
    for r in result.data:
        case_data = r.get('cases')
        holiday = case_data['holiday'] if case_data else r.get('holiday')
        case_date = r['created_at']  # use wishlist created_at as date
        rows.append((r['id'], r['gift_description'], r['added_by'], r['created_at'],
                      r['category'], r['case_id'], holiday, case_date, r.get('received', False)))
    return rows


async def delete_wishlist_item(item_id):
    await asyncio.to_thread(
        lambda: _client.table('wishlist')
            .delete()
            .eq('id', item_id)
            .execute()
    )


async def get_or_create_self_target(user_id: int) -> int:
    """Получает или создает специальную запись 'self' в targets для хранения личного вишлиста пользователя."""
    result = await asyncio.to_thread(
        lambda: _client.table('targets')
            .select('id')
            .eq('owner_id', user_id)
            .eq('identifier', 'self')
            .execute()
    )
    if result.data:
        return result.data[0]['id']

    # Если не найдено, создаем запись 'self'
    profile_res = await asyncio.to_thread(
        lambda: _client.table('users')
            .select('nickname, birthday')
            .eq('id', user_id)
            .execute()
    )
    name = "Мой вишлист"
    birthday = None
    if profile_res.data:
        name = profile_res.data[0].get('nickname') or "Мой вишлист"
        birthday = profile_res.data[0].get('birthday')

    insert_res = await asyncio.to_thread(
        lambda: _client.table('targets').insert({
            'owner_id': user_id,
            'identifier': 'self',
            'name': name,
            'birthday': birthday
        }).execute()
    )
    return insert_res.data[0]['id']


async def get_wishlist_item_by_id(item_id: int):
    """Возвращает элемент вишлиста по его id."""
    result = await asyncio.to_thread(
        lambda: _client.table('wishlist')
            .select('id, target_id, gift_description, category, added_by, case_id, received, created_at')
            .eq('id', item_id)
            .execute()
    )
    if result.data:
        return result.data[0]
    return None


async def set_wishlist_item_received(item_id: int, received: bool):
    """Обновляет статус 'received' для элемента вишлиста."""
    await asyncio.to_thread(
        lambda: _client.table('wishlist')
            .update({'received': received})
            .eq('id', item_id)
            .execute()
    )


# ================= REMINDERS =================

async def add_reminder(customer_id, case_id, target_name, remind_at):
    await asyncio.to_thread(
        lambda: _client.table('reminders').insert({
            'customer_id': customer_id,
            'case_id': case_id,
            'target_name': target_name,
            'remind_at': remind_at.isoformat() if isinstance(remind_at, datetime) else str(remind_at)
        }).execute()
    )


async def get_due_reminders():
    now = datetime.utcnow().isoformat()
    result = await asyncio.to_thread(
        lambda: _client.table('reminders')
            .select('id, customer_id, case_id, target_name, remind_at')
            .eq('is_sent', False)
            .lte('remind_at', now)
            .execute()
    )
    return [(r['id'], r['customer_id'], r['case_id'], r['target_name'], r['remind_at'])
            for r in result.data]


async def mark_reminder_sent(reminder_id):
    await asyncio.to_thread(
        lambda: _client.table('reminders')
            .update({'is_sent': True})
            .eq('id', reminder_id)
            .execute()
    )


async def get_user_reminders(customer_id):
    result = await asyncio.to_thread(
        lambda: _client.table('reminders')
            .select('id, case_id, target_name, remind_at, is_sent')
            .eq('customer_id', customer_id)
            .eq('is_sent', False)
            .order('remind_at')
            .execute()
    )
    return [(r['id'], r['case_id'], r['target_name'], r['remind_at'], r['is_sent'])
            for r in result.data]


# ================= CASE MANAGEMENT =================

async def cancel_case(case_id):
    """Отменяет дело и ставит статус cancelled."""
    await asyncio.to_thread(
        lambda: _client.table('cases')
            .update({'status': 'cancelled'})
            .eq('id', case_id)
            .execute()
    )


async def delete_case(case_id):
    """Полностью удаляет дело (chat_history cascade-deletes via FK)."""
    # Delete wishlist items linked to this case
    await asyncio.to_thread(
        lambda: _client.table('wishlist')
            .update({'case_id': None})
            .eq('case_id', case_id)
            .execute()
    )
    # Delete reminders
    await asyncio.to_thread(
        lambda: _client.table('reminders')
            .delete()
            .eq('case_id', case_id)
            .execute()
    )
    # Delete case (chat_history cascades)
    await asyncio.to_thread(
        lambda: _client.table('cases')
            .delete()
            .eq('id', case_id)
            .execute()
    )


async def refund_balance(user_id, amount=1):
    """Возвращает монетки пользователю."""
    await asyncio.to_thread(
        lambda: _client.rpc('refund_balance', {
            'p_user_id': user_id,
            'p_amount': amount
        }).execute()
    )


# ================= GRANULAR NOTIFICATIONS =================

async def get_all_targets_with_birthdays():
    """Возвращает все цели с непустым днем рождения."""
    result = await asyncio.to_thread(
        lambda: _client.table('targets')
            .select('id, owner_id, name, identifier, birthday')
            .not_.is_('birthday', 'null')
            .execute()
    )
    return [(r['id'], r['owner_id'], r['name'] or r['identifier'], r['birthday']) for r in result.data]


async def get_user_notifications(user_id):
    """Возвращает словарь настроек уведомлений пользователя."""
    await _ensure_user(user_id)
    try:
        result = await asyncio.to_thread(
            lambda: _client.table('users')
                .select('notify_birthdays, notify_dialogue, notify_reports')
                .eq('id', user_id)
                .execute()
        )
        row = result.data[0] if result.data else {}
        bday = row.get('notify_birthdays')
        dial = row.get('notify_dialogue')
        rep = row.get('notify_reports')
        
        return {
            "notify_birthdays": True if bday is None else bool(bday),
            "notify_dialogue": True if dial is None else bool(dial),
            "notify_reports": True if rep is None else bool(rep)
        }
    except Exception as e:
        logging.error(f"Error fetching notifications: {e}")
        return {
            "notify_birthdays": True,
            "notify_dialogue": True,
            "notify_reports": True
        }


async def update_user_notifications(user_id, field, value):
    """Обновляет статус конкретного типа уведомлений пользователя."""
    await _ensure_user(user_id)
    allowed = ('notify_birthdays', 'notify_dialogue', 'notify_reports')
    if field not in allowed:
        return
    await asyncio.to_thread(
        lambda: _client.table('users')
            .update({field: bool(value)})
            .eq('id', user_id)
            .execute()
    )


# ================= DETECTIVES (PERSONAS) =================

async def get_personas(user_id=None):
    """Возвращает актуальный список детективов из БД (включая личные и добавленные)."""
    personas_data = []
    
    try:
        # Системные детективы (без создателя)
        sys_res = await asyncio.to_thread(
            lambda: _client.table('detectives')
                .select('*')
                .is_('creator_id', 'null')
                .order('id')
                .execute()
        )
        if sys_res.data:
            personas_data.extend(sys_res.data)
    except Exception as e:
        logging.error(f"Error fetching system personas: {e}")
        
    if user_id:
        try:
            # Собственные кастомные детективы
            own_res = await asyncio.to_thread(
                lambda: _client.table('detectives')
                    .select('*')
                    .eq('creator_id', user_id)
                    .order('id')
                    .execute()
            )
            if own_res.data:
                personas_data.extend(own_res.data)
        except Exception as e:
            logging.error(f"Error fetching user's own personas: {e}")
            
        try:
            # Добавленные из библиотеки
            added_res = await asyncio.to_thread(
                lambda: _client.table('added_detectives')
                    .select('detective_id, detectives(*)')
                    .eq('user_id', user_id)
                    .execute()
            )
            if added_res.data:
                for r in added_res.data:
                    det = r.get('detectives')
                    if det:
                        # Исключаем дубликаты
                        if det['id'] not in [p['id'] for p in personas_data]:
                            personas_data.append(det)
        except Exception as e:
            logging.error(f"Error fetching added community personas: {e}")

    personas = []
    for r in personas_data:
        personas.append({
            "id": r['id'],
            "name": r['name'],
            "desc": r.get('description') or '',
            "photo": r.get('photo_url') or '',
            "emojis": r.get('emojis') or '🕵️‍♂️, 🎁, ✨, 🤫, 🔍',
            "ai_description": r.get('ai_description') or '',
            "creator_id": r.get('creator_id'),
            "is_public": bool(r.get('is_public', False)),
            "is_approved": bool(r.get('is_approved', True)),
            "specialty": r.get('specialty') or 'Секретное расследование 🕵️‍♂️',
            "skills": r.get('skills') or []
        })
    return personas


async def get_public_detectives(user_id):
    """Возвращает все одобренные публичные детективы других пользователей для отображения в Библиотеке."""
    result = await asyncio.to_thread(
        lambda: _client.table('detectives')
            .select('*')
            .not_.is_('creator_id', 'null')
            .neq('creator_id', user_id)
            .eq('is_public', True)
            .eq('is_approved', True)
            .order('id')
            .execute()
    )
    
    # Получаем список уже добавленных детективов этим пользователем
    added_res = await asyncio.to_thread(
        lambda: _client.table('added_detectives')
            .select('detective_id')
            .eq('user_id', user_id)
            .execute()
    )
    added_ids = {r['detective_id'] for r in added_res.data} if added_res.data else set()
    
    public_detectives = []
    for r in result.data:
        public_detectives.append({
            "id": r['id'],
            "name": r['name'],
            "desc": r.get('description') or '',
            "photo": r.get('photo_url') or '',
            "emojis": r.get('emojis') or '🕵️‍♂️, 🎁, ✨, 🤫, 🔍',
            "ai_description": r.get('ai_description') or '',
            "creator_id": r.get('creator_id'),
            "is_public": bool(r.get('is_public', False)),
            "is_approved": bool(r.get('is_approved', True)),
            "specialty": r.get('specialty') or 'Секретное расследование 🕵️‍♂️',
            "skills": r.get('skills') or [],
            "is_added": r['id'] in added_ids
        })
    return public_detectives


async def add_detective_to_library(user_id: int, detective_id: int):
    """Связывает публичного детектива с пользователем (Добавить себе)."""
    exists = await asyncio.to_thread(
        lambda: _client.table('added_detectives')
            .select('id')
            .eq('user_id', user_id)
            .eq('detective_id', detective_id)
            .execute()
    )
    if not exists.data:
        await asyncio.to_thread(
            lambda: _client.table('added_detectives')
                .insert({'user_id': user_id, 'detective_id': detective_id})
                .execute()
        )


async def remove_detective_from_library(user_id: int, detective_id: int):
    """Удаляет связь чужого детектива со своим профилем."""
    await asyncio.to_thread(
        lambda: _client.table('added_detectives')
            .delete()
            .eq('user_id', user_id)
            .eq('detective_id', detective_id)
            .execute()
    )


async def create_custom_detective(creator_id: int, name: str, description: str, ai_description: str, photo_url: str, emojis: str, is_public: bool, is_approved: bool, specialty: str, skills: list):
    """Создает нового кастомного детектива в Supabase."""
    result = await asyncio.to_thread(
        lambda: _client.table('detectives').insert({
            'name': name,
            'description': description,
            'ai_description': ai_description,
            'photo_url': photo_url,
            'emojis': emojis,
            'creator_id': creator_id,
            'is_public': is_public,
            'is_approved': is_approved,
            'specialty': specialty,
            'skills': skills
        }).execute()
    )
    return result.data[0]['id']


async def delete_custom_detective(creator_id: int, detective_id: int):
    """Удаляет собственного кастомного детектива из Supabase."""
    await asyncio.to_thread(
        lambda: _client.table('detectives')
            .delete()
            .eq('creator_id', creator_id)
            .eq('id', detective_id)
            .execute()
    )


async def update_custom_detective(user_id: int, detective_id: int, name: str, description: str, ai_description: str, photo_url: str, emojis: str, is_public: bool, specialty: str, skills: list):
    """Обновляет собственного кастомного детектива в Supabase."""
    await asyncio.to_thread(
        lambda: _client.table('detectives')
            .update({
                'name': name,
                'description': description,
                'ai_description': ai_description,
                'photo_url': photo_url,
                'emojis': emojis,
                'is_public': is_public,
                'specialty': specialty,
                'skills': skills
            })
            .eq('creator_id', user_id)
            .eq('id', detective_id)
            .execute()
    )


async def get_detective_by_id(detective_id: int):
    """Возвращает одного детектива по ID."""
    result = await asyncio.to_thread(
        lambda: _client.table('detectives')
            .select('*')
            .eq('id', detective_id)
            .execute()
    )
    if result.data:
        r = result.data[0]
        return {
            "id": r['id'],
            "name": r['name'],
            "desc": r.get('description') or '',
            "photo": r.get('photo_url') or '',
            "emojis": r.get('emojis') or '🕵️‍♂️, 🎁, ✨, 🤫, 🔍',
            "ai_description": r.get('ai_description') or '',
            "creator_id": r.get('creator_id'),
            "is_public": bool(r.get('is_public', False)),
            "is_approved": bool(r.get('is_approved', True)),
            "specialty": r.get('specialty') or 'Секретное расследование 🕵️‍♂️',
            "skills": r.get('skills') or []
        }
    return None


async def get_user_custom_detectives_enabled(user_id) -> bool:
    """Проверяет, включен ли конструктор детективов у пользователя."""
    await _ensure_user(user_id)
    result = await asyncio.to_thread(
        lambda: _client.table('users')
            .select('custom_detectives_enabled')
            .eq('id', user_id)
            .execute()
    )
    if result.data and 'custom_detectives_enabled' in result.data[0]:
        val = result.data[0]['custom_detectives_enabled']
        return bool(val) if val is not None else False
    return False


async def toggle_custom_detectives(user_id) -> bool:
    """Тогглит настройку конструктора детективов."""
    current = await get_user_custom_detectives_enabled(user_id)
    new_val = not current
    await asyncio.to_thread(
        lambda: _client.table('users')
            .update({'custom_detectives_enabled': new_val})
            .eq('id', user_id)
            .execute()
    )
    return new_val


async def upload_detective_avatar(user_id: int, file_bytes: bytes) -> str:
    """Загружает аватар детектива в Supabase Storage и возвращает публичный URL."""
    import time
    file_name = f"custom_det_{user_id}_{int(time.time())}.jpg"
    
    try:
        await asyncio.to_thread(
            lambda: _client.storage.from_("detectives").upload(
                path=file_name,
                file=file_bytes,
                file_options={"content-type": "image/jpeg", "upsert": "true"}
            )
        )
        url = _client.storage.from_("detectives").get_public_url(file_name)
        return url
    except Exception as e:
        logging.warning(f"Failed uploading to detectives storage bucket: {e}. Falling back to profile_photo...")
        
    # Резервный вариант — загрузка в работающий бакет фото профиля
    try:
        await asyncio.to_thread(
            lambda: _client.storage.from_("profile_photo").upload(
                path=file_name,
                file=file_bytes,
                file_options={"content-type": "image/jpeg", "upsert": "true"}
            )
        )
        url = _client.storage.from_("profile_photo").get_public_url(file_name)
        return url
    except Exception as e2:
        logging.error(f"Failed fallback upload to profile_photo storage bucket: {e2}")
        
    # Буленепробиваемый резервный вариант — возврат Base64 data-uri
    import base64
    base64_str = base64.b64encode(file_bytes).decode('utf-8')
    return f"data:image/jpeg;base64,{base64_str}"


async def has_user_tested_detective(user_id: int) -> bool:
    """Checks if user already used their free test on themselves."""
    await _ensure_user(user_id)
    result = await asyncio.to_thread(
        lambda: _client.table('users')
            .select('has_tested_detective')
            .eq('id', user_id)
            .execute()
    )
    if result.data and 'has_tested_detective' in result.data[0]:
        val = result.data[0]['has_tested_detective']
        return bool(val) if val is not None else False
    return False


async def set_user_tested_detective(user_id: int, value: bool = True):
    """Sets the has_tested_detective flag for the user."""
    await _ensure_user(user_id)
    await asyncio.to_thread(
        lambda: _client.table('users')
            .update({'has_tested_detective': value})
            .eq('id', user_id)
            .execute()
    )

