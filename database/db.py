import asyncio
import logging
from datetime import datetime
from supabase import create_client, Client
import config

_client: Client = None


async def init_db():
    """Initialize Supabase client (replaces SQLite init)."""
    global _client
    _client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)
    logging.info("Supabase client initialized.")


# ================= CASES =================

async def add_case(customer_id, target, holiday, context, persona, budget):
    result = await asyncio.to_thread(
        lambda: _client.table('cases').insert({
            'customer_id': customer_id,
            'target': target,
            'holiday': holiday,
            'context': context,
            'persona': persona,
            'budget': budget
        }).execute()
    )
    return result.data[0]['id']


async def get_pending_cases():
    result = await asyncio.to_thread(
        lambda: _client.table('cases')
            .select('id, customer_id, target, holiday, context, persona, budget, status, report')
            .eq('status', 'pending')
            .execute()
    )
    return [(r['id'], r['customer_id'], r['target'], r['holiday'], r['context'],
             r['persona'], r['budget'], r['status'], r['report']) for r in result.data]


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
    await asyncio.to_thread(
        lambda: _client.table('cases')
            .update({'status': status, 'report': report})
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
    result = await asyncio.to_thread(
        lambda: _client.table('cases')
            .select('id, customer_id, target, holiday, context, persona, budget, status, report')
            .eq('id', case_id)
            .execute()
    )
    if result.data:
        r = result.data[0]
        return (r['id'], r['customer_id'], r['target'], r['holiday'], r['context'],
                r['persona'], r['budget'], r['status'], r['report'])
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
    """Returns (balance, successful, active, nickname, spy_mode, birthday, description, photo_file_id)"""
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


async def get_all_user_cases(customer_id):
    result = await asyncio.to_thread(
        lambda: _client.table('cases')
            .select('id, target, status, report')
            .eq('customer_id', customer_id)
            .order('id', desc=True)
            .execute()
    )
    return [(r['id'], r['target'], r['status'], r['report']) for r in result.data]


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
    result = await asyncio.to_thread(
        lambda: _client.table('targets')
            .select('id, identifier, name, habits, birthday, photo_file_id')
            .eq('owner_id', owner_id)
            .order('id', desc=True)
            .execute()
    )
    return [(r['id'], r['identifier'], r['name'], r['habits'], r['birthday'], r['photo_file_id'])
            for r in result.data]


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

async def add_to_wishlist(target_id, gift_description, category='Другое', added_by='user', case_id=None):
    data = {
        'target_id': target_id,
        'gift_description': gift_description,
        'category': category,
        'added_by': added_by
    }
    if case_id is not None:
        data['case_id'] = case_id
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
            .select('id, gift_description, added_by, created_at, category, case_id, cases(holiday, created_at)')
            .eq('target_id', target_id)
            .order('case_id', desc=True)
            .order('id', desc=True)
            .execute()
    )
    rows = []
    for r in result.data:
        case_data = r.get('cases')
        holiday = case_data['holiday'] if case_data else None
        case_date = r['created_at']  # use wishlist created_at as date
        rows.append((r['id'], r['gift_description'], r['added_by'], r['created_at'],
                      r['category'], r['case_id'], holiday, case_date))
    return rows


async def delete_wishlist_item(item_id):
    await asyncio.to_thread(
        lambda: _client.table('wishlist')
            .delete()
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
