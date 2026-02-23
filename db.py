import sqlite3

def init_db():
    """Создает базу данных и таблицу, если их еще нет"""
    conn = sqlite3.connect('agency.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER,       -- ID заказчика в Telegram
            target TEXT,               -- Юзернейм или номер цели
            holiday TEXT,              -- Повод (праздник)
            context TEXT,              -- Хобби/описание (зацепки)
            persona TEXT,              -- Выбранный характер Агента
            budget TEXT,               -- Бюджет подарка
            status TEXT DEFAULT 'pending', -- Статус (pending, started, in_progress, done, delivered)
            report TEXT                -- Готовый отчет ИИ
        )
    ''')
    conn.commit()
    conn.close()

def add_case(customer_id, target, holiday, context, persona, budget):
    """Добавляет новое дело от заказчика"""
    conn = sqlite3.connect('agency.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO cases (customer_id, target, holiday, context, persona, budget)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (customer_id, target, holiday, context, persona, budget))
    conn.commit()
    conn.close()

def get_pending_cases():
    """Получает все новые дела, которые еще не взял в работу Детектив"""
    conn = sqlite3.connect('agency.db')
    cursor = conn.cursor()
    # Возвращаем все колонки, чтобы распаковать их в detective_worker.py
    cursor.execute("SELECT * FROM cases WHERE status = 'pending'")
    cases = cursor.fetchall()
    conn.close()
    return cases

def get_started_cases():
    """Получает дела, по которым агент только что написал первое сообщение"""
    conn = sqlite3.connect('agency.db')
    cursor = conn.cursor()
    cursor.execute("SELECT id, customer_id, target FROM cases WHERE status = 'started'")
    cases = cursor.fetchall()
    conn.close()
    return cases

def get_done_cases():
    """Получает все закрытые дела, отчеты по которым еще не отправлены заказчику"""
    conn = sqlite3.connect('agency.db')
    cursor = conn.cursor()
    cursor.execute("SELECT id, customer_id, target, report FROM cases WHERE status = 'done'")
    cases = cursor.fetchall()
    conn.close()
    return cases

def update_case_status(case_id, status, report=""):
    """Обновляет статус дела (например, на 'in_progress' или 'done') и сохраняет отчет"""
    conn = sqlite3.connect('agency.db')
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE cases SET status = ?, report = ? WHERE id = ?
    ''', (status, report, case_id))
    conn.commit()
    conn.close()

def mark_case_delivered(case_id):
    """Помечает дело как 'доставленное' (delivered), чтобы не отправлять отчет заказчику дважды"""
    conn = sqlite3.connect('agency.db')
    cursor = conn.cursor()
    cursor.execute("UPDATE cases SET status = 'delivered' WHERE id = ?", (case_id,))
    conn.commit()
    conn.close()

def get_user_active_cases(customer_id):
    """Получает все незавершенные дела конкретного заказчика для меню 'Мои активные дела'"""
    conn = sqlite3.connect('agency.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, target, status 
        FROM cases 
        WHERE customer_id = ? AND status IN ('pending', 'started', 'in_progress')
    ''', (customer_id,))
    cases = cursor.fetchall()
    conn.close()
    return cases

def get_user_finished_cases(customer_id):
    """Получает все завершенные дела конкретного заказчика для 'Архива дел'"""
    conn = sqlite3.connect('agency.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, target, report 
        FROM cases 
        WHERE customer_id = ? AND status IN ('done', 'delivered')
        ORDER BY id DESC
    ''', (customer_id,))
    cases = cursor.fetchall()
    conn.close()
    return cases

def get_case_report(case_id):
    """Достает подробности одного конкретного закрытого дела по его ID для инлайн-кнопок"""
    conn = sqlite3.connect('agency.db')
    cursor = conn.cursor()
    cursor.execute("SELECT target, report FROM cases WHERE id = ?", (case_id,))
    result = cursor.fetchone()
    conn.close()
    return result

def check_target_status(target):
    """Проверяет, есть ли в базе дела на эту цель (защита от спама и шеринг досье)"""
    conn = sqlite3.connect('agency.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT status, report 
        FROM cases 
        WHERE target = ? 
        ORDER BY id DESC LIMIT 1
    ''', (target,))
    result = cursor.fetchone()
    conn.close()
    return result