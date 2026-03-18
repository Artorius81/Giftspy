import aiosqlite
import logging
from datetime import datetime

DB_PATH = 'agency.db'

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS cases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER,
                target TEXT,
                holiday TEXT,
                context TEXT,
                persona TEXT,
                budget TEXT,
                status TEXT DEFAULT 'pending',
                report TEXT,
                spy_message_id INTEGER DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        await db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                nickname TEXT DEFAULT NULL,
                balance INTEGER DEFAULT 1,
                spy_mode BOOLEAN DEFAULT 0,
                notifications_enabled BOOLEAN DEFAULT 1,
                birthday TEXT DEFAULT NULL,
                description TEXT DEFAULT NULL,
                photo_file_id TEXT DEFAULT NULL,
                registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        await db.execute('''
            CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER,
                sender TEXT,
                message TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (case_id) REFERENCES cases (id)
            )
        ''')
        await db.execute('''
            CREATE TABLE IF NOT EXISTS targets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id INTEGER,
                identifier TEXT,
                name TEXT,
                habits TEXT,
                birthday TEXT,
                photo_file_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        await db.execute('''
            CREATE TABLE IF NOT EXISTS wishlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                target_id INTEGER,
                gift_description TEXT,
                category TEXT DEFAULT 'Другое',
                added_by TEXT DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (target_id) REFERENCES targets (id)
            )
        ''')
        await db.execute('''
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER,
                case_id INTEGER,
                target_name TEXT,
                remind_at TIMESTAMP,
                is_sent BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Миграции
        for col_sql in [
            "ALTER TABLE users ADD COLUMN nickname TEXT DEFAULT NULL",
            "ALTER TABLE users ADD COLUMN spy_mode BOOLEAN DEFAULT 0",
            "ALTER TABLE users ADD COLUMN notifications_enabled BOOLEAN DEFAULT 1",
            "ALTER TABLE users ADD COLUMN birthday TEXT DEFAULT NULL",
            "ALTER TABLE users ADD COLUMN description TEXT DEFAULT NULL",
            "ALTER TABLE users ADD COLUMN photo_file_id TEXT DEFAULT NULL",
            "ALTER TABLE users ADD COLUMN registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE cases ADD COLUMN spy_message_id INTEGER DEFAULT NULL",
            "ALTER TABLE cases ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE targets ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE wishlist ADD COLUMN category TEXT DEFAULT 'Другое'",
            "ALTER TABLE wishlist ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        ]:
            try:
                await db.execute(col_sql)
            except Exception:
                pass
        
        await db.commit()
        logging.info("Database initialized.")

# ================= CASES =================

async def add_case(customer_id, target, holiday, context, persona, budget):
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute('''
            INSERT INTO cases (customer_id, target, holiday, context, persona, budget)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (customer_id, target, holiday, context, persona, budget))
        await db.commit()
        return cursor.lastrowid

async def get_pending_cases():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute('''
            SELECT id, customer_id, target, holiday, context, persona, budget, status, report 
            FROM cases 
            WHERE status = 'pending'
        ''') as cursor:
            return await cursor.fetchall()

async def get_started_cases():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id, customer_id, target FROM cases WHERE status = 'started'") as cursor:
            return await cursor.fetchall()

async def get_done_cases():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id, customer_id, target, report FROM cases WHERE status = 'done'") as cursor:
            return await cursor.fetchall()

async def update_case_status(case_id, status, report=""):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('''
            UPDATE cases SET status = ?, report = ? WHERE id = ?
        ''', (status, report, case_id))
        await db.commit()

async def mark_case_delivered(case_id):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE cases SET status = 'delivered' WHERE id = ?", (case_id,))
        await db.commit()

async def get_user_active_cases(customer_id):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute('''
            SELECT id, target, status 
            FROM cases 
            WHERE customer_id = ? AND status IN ('pending', 'started', 'in_progress', 'manual_mode')
        ''', (customer_id,)) as cursor:
            return await cursor.fetchall()

async def get_user_finished_cases(customer_id):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute('''
            SELECT id, target, report 
            FROM cases 
            WHERE customer_id = ? AND status IN ('done', 'delivered')
            ORDER BY id DESC
        ''', (customer_id,)) as cursor:
            return await cursor.fetchall()

async def get_case_report(case_id):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT target, report FROM cases WHERE id = ?", (case_id,)) as cursor:
            return await cursor.fetchone()

async def check_target_status(target):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute('''
            SELECT status, report 
            FROM cases 
            WHERE target = ? 
            ORDER BY id DESC LIMIT 1
        ''', (target,)) as cursor:
            return await cursor.fetchone()

async def get_active_case_by_target(target):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute('''
            SELECT id, customer_id, target, holiday, context, persona, budget, status, report 
            FROM cases 
            WHERE target = ? AND status IN ('pending', 'started', 'in_progress', 'manual_mode')
            ORDER BY id DESC LIMIT 1
        ''', (target,)) as cursor:
            return await cursor.fetchone()

async def get_case_by_id(case_id):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute('''
            SELECT id, customer_id, target, holiday, context, persona, budget, status, report 
            FROM cases WHERE id = ?
        ''', (case_id,)) as cursor:
            return await cursor.fetchone()

# ================= SPY MESSAGE TRACKING =================

async def set_spy_message_id(case_id, message_id):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE cases SET spy_message_id = ? WHERE id = ?", (message_id, case_id))
        await db.commit()

async def get_spy_message_id(case_id):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT spy_message_id FROM cases WHERE id = ?", (case_id,)) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else None

# ================= CHAT HISTORY =================

async def save_chat_message(case_id, sender, message):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('''
            INSERT INTO chat_history (case_id, sender, message)
            VALUES (?, ?, ?)
        ''', (case_id, sender, message))
        await db.commit()

async def get_chat_history(case_id):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute('''
            SELECT sender, message 
            FROM chat_history 
            WHERE case_id = ? 
            ORDER BY timestamp ASC
        ''', (case_id,)) as cursor:
            return await cursor.fetchall()

async def get_chat_history_count(case_id):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT COUNT(*) FROM chat_history WHERE case_id = ?", (case_id,)) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else 0

async def get_chat_message_at(case_id, index):
    """Получает сообщение по индексу (0-based) для пагинации spy mode."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute('''
            SELECT sender, message FROM chat_history 
            WHERE case_id = ? ORDER BY timestamp ASC 
            LIMIT 1 OFFSET ?
        ''', (case_id, index)) as cursor:
            return await cursor.fetchone()

# ================= USER PROFILE =================

async def get_user_profile(user_id):
    """Returns (balance, successful, active, nickname, spy_mode, birthday, description, photo_file_id)"""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("INSERT OR IGNORE INTO users (id) VALUES (?)", (user_id,))
        await db.commit()
        
        async with db.execute("SELECT balance, nickname, spy_mode, birthday, description, photo_file_id FROM users WHERE id = ?", (user_id,)) as cursor:
            row = await cursor.fetchone()
            balance = row[0] if row else 1
            nickname = row[1] if row else None
            spy_mode = bool(row[2]) if row else False
            birthday = row[3] if row else None
            description = row[4] if row else None
            photo = row[5] if row else None
            
        async with db.execute('''
            SELECT 
                SUM(CASE WHEN status IN ('done', 'delivered') THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN status IN ('pending', 'started', 'in_progress', 'manual_mode') THEN 1 ELSE 0 END) as active
            FROM cases WHERE customer_id = ?
        ''', (user_id,)) as cursor:
            stats = await cursor.fetchone()
            successful = stats[0] or 0
            active = stats[1] or 0
            
        return balance, successful, active, nickname, spy_mode, birthday, description, photo

async def get_user_balance(user_id):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT balance FROM users WHERE id = ?", (user_id,)) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else 1

async def deduct_balance(user_id, amount=1):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?", (amount, user_id, amount))
        await db.commit()

async def update_user_nickname(user_id, nickname):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("INSERT OR IGNORE INTO users (id) VALUES (?)", (user_id,))
        await db.execute("UPDATE users SET nickname = ? WHERE id = ?", (nickname, user_id))
        await db.commit()

async def update_user_field(user_id, field, value):
    """Updates a single user profile field."""
    allowed = ('nickname', 'birthday', 'description', 'photo_file_id')
    if field not in allowed:
        return
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("INSERT OR IGNORE INTO users (id) VALUES (?)", (user_id,))
        await db.execute(f"UPDATE users SET {field} = ? WHERE id = ?", (value, user_id))
        await db.commit()

async def toggle_spy_mode(user_id):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("INSERT OR IGNORE INTO users (id) VALUES (?)", (user_id,))
        async with db.execute("SELECT spy_mode FROM users WHERE id = ?", (user_id,)) as cursor:
            row = await cursor.fetchone()
            current = bool(row[0]) if row else False
        new_value = not current
        await db.execute("UPDATE users SET spy_mode = ? WHERE id = ?", (int(new_value), user_id))
        await db.commit()
        return new_value

async def get_user_spy_mode(user_id):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("INSERT OR IGNORE INTO users (id) VALUES (?)", (user_id,))
        await db.commit()
        async with db.execute("SELECT spy_mode FROM users WHERE id = ?", (user_id,)) as cursor:
            row = await cursor.fetchone()
            return bool(row[0]) if row else False

async def get_all_user_cases(customer_id):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute('''
            SELECT id, target, status, report 
            FROM cases 
            WHERE customer_id = ?
            ORDER BY id DESC
        ''', (customer_id,)) as cursor:
            return await cursor.fetchall()

# ================= TARGETS =================

async def add_target(owner_id, identifier, name=None, habits=None, birthday=None, photo_file_id=None):
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute('''
            INSERT INTO targets (owner_id, identifier, name, habits, birthday, photo_file_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (owner_id, identifier, name, habits, birthday, photo_file_id))
        await db.commit()
        return cursor.lastrowid

async def get_user_targets(owner_id):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute('''
            SELECT id, identifier, name, habits, birthday, photo_file_id 
            FROM targets 
            WHERE owner_id = ?
            ORDER BY id DESC
        ''', (owner_id,)) as cursor:
            return await cursor.fetchall()

async def get_target_by_id(target_id):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute('''
            SELECT id, owner_id, identifier, name, habits, birthday, photo_file_id 
            FROM targets WHERE id = ?
        ''', (target_id,)) as cursor:
            return await cursor.fetchone()

async def update_target(target_id, **kwargs):
    async with aiosqlite.connect(DB_PATH) as db:
        for key, value in kwargs.items():
            if key in ('name', 'habits', 'birthday', 'photo_file_id', 'identifier'):
                await db.execute(f"UPDATE targets SET {key} = ? WHERE id = ?", (value, target_id))
        await db.commit()

async def delete_target(target_id):
    """Удаляет цель, её вишлист и отменяет активные дела."""
    async with aiosqlite.connect(DB_PATH) as db:
        # Получаем данные цели перед удалением для поиска активных дел
        async with db.execute("SELECT identifier, owner_id FROM targets WHERE id = ?", (target_id,)) as cursor:
            target_data = await cursor.fetchone()
        
        if target_data:
            identifier, owner_id = target_data
            # Отменяем активные дела для этой цели
            await db.execute('''
                UPDATE cases 
                SET status = 'cancelled' 
                WHERE customer_id = ? AND target = ? AND status IN ('pending', 'started', 'in_progress', 'manual_mode')
            ''', (owner_id, identifier))

        await db.execute("DELETE FROM wishlist WHERE target_id = ?", (target_id,))
        await db.execute("DELETE FROM targets WHERE id = ?", (target_id,))
        await db.commit()

async def find_target_by_identifier(owner_id, identifier):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute('''
            SELECT id, identifier, name, habits, birthday, photo_file_id 
            FROM targets 
            WHERE owner_id = ? AND identifier = ?
        ''', (owner_id, identifier)) as cursor:
            return await cursor.fetchone()

# ================= WISHLIST =================

async def add_to_wishlist(target_id, gift_description, category='Другое', added_by='user'):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('''
            INSERT INTO wishlist (target_id, gift_description, category, added_by)
            VALUES (?, ?, ?, ?)
        ''', (target_id, gift_description, category, added_by))
        await db.commit()

async def get_wishlist(target_id):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute('''
            SELECT id, gift_description, added_by, created_at, category 
            FROM wishlist 
            WHERE target_id = ?
            ORDER BY category, id DESC
        ''', (target_id,)) as cursor:
            return await cursor.fetchall()

async def delete_wishlist_item(item_id):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM wishlist WHERE id = ?", (item_id,))
        await db.commit()

# ================= REMINDERS =================

async def add_reminder(customer_id, case_id, target_name, remind_at):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('''
            INSERT INTO reminders (customer_id, case_id, target_name, remind_at)
            VALUES (?, ?, ?, ?)
        ''', (customer_id, case_id, target_name, remind_at))
        await db.commit()

async def get_due_reminders():
    now = datetime.utcnow().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute('''
            SELECT id, customer_id, case_id, target_name, remind_at 
            FROM reminders 
            WHERE is_sent = 0 AND remind_at <= ?
        ''', (now,)) as cursor:
            return await cursor.fetchall()

async def mark_reminder_sent(reminder_id):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE reminders SET is_sent = 1 WHERE id = ?", (reminder_id,))
        await db.commit()

async def get_user_reminders(customer_id):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute('''
            SELECT id, case_id, target_name, remind_at, is_sent 
            FROM reminders 
            WHERE customer_id = ? AND is_sent = 0
            ORDER BY remind_at ASC
        ''', (customer_id,)) as cursor:
            return await cursor.fetchall()
