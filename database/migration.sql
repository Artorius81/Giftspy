-- =====================================================
-- Giftspy: Supabase Schema Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- =====================================================

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,
    nickname TEXT DEFAULT NULL,
    balance INTEGER DEFAULT 1,
    spy_mode BOOLEAN DEFAULT FALSE,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    birthday TEXT DEFAULT NULL,
    description TEXT DEFAULT NULL,
    photo_file_id TEXT DEFAULT NULL,
    premium_until TIMESTAMPTZ DEFAULT NULL,
    notify_birthdays BOOLEAN DEFAULT TRUE,
    notify_dialogue BOOLEAN DEFAULT TRUE,
    notify_reports BOOLEAN DEFAULT TRUE,
    model_selector_enabled BOOLEAN DEFAULT FALSE,
    custom_detectives_enabled BOOLEAN DEFAULT FALSE,
    registered_at TIMESTAMPTZ DEFAULT NOW()
);

-- CASES
CREATE TABLE IF NOT EXISTS cases (
    id SERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    target TEXT NOT NULL,
    holiday TEXT,
    context TEXT,
    persona TEXT,
    budget TEXT,
    status TEXT DEFAULT 'pending',
    report TEXT,
    spy_message_id BIGINT DEFAULT NULL,
    ai_model TEXT DEFAULT 'deepseek-v4',
    completed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CHAT HISTORY
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    sender TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- TARGETS
CREATE TABLE IF NOT EXISTS targets (
    id SERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    identifier TEXT NOT NULL,
    name TEXT,
    habits TEXT,
    birthday TEXT,
    photo_file_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WISHLIST
CREATE TABLE IF NOT EXISTS wishlist (
    id SERIAL PRIMARY KEY,
    target_id INTEGER REFERENCES targets(id) ON DELETE CASCADE,
    gift_description TEXT NOT NULL,
    category TEXT DEFAULT 'Другое',
    added_by TEXT DEFAULT 'user',
    case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
    received BOOLEAN DEFAULT FALSE,
    holiday TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- REMINDERS
CREATE TABLE IF NOT EXISTS reminders (
    id SERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    case_id INTEGER,
    target_name TEXT,
    remind_at TIMESTAMPTZ,
    is_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DETECTIVES (PERSONAS)
CREATE TABLE IF NOT EXISTS detectives (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    photo_url TEXT,
    emojis TEXT DEFAULT '🕵️‍♂️, 🎁, ✨, 🤫, 🔍',
    ai_description TEXT,
    creator_id BIGINT DEFAULT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT TRUE,
    specialty TEXT DEFAULT 'Секретное расследование 🕵️‍♂️',
    skills JSONB DEFAULT '[]'::jsonb
);

-- ADDED DETECTIVES (LIBRARY CONNECTIONS)
CREATE TABLE IF NOT EXISTS added_detectives (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    detective_id INTEGER REFERENCES detectives(id) ON DELETE CASCADE NOT NULL
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_cases_customer ON cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_target ON cases(target);
CREATE INDEX IF NOT EXISTS idx_chat_case ON chat_history(case_id);
CREATE INDEX IF NOT EXISTS idx_targets_owner ON targets(owner_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_target ON wishlist(target_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(is_sent, remind_at);
CREATE INDEX IF NOT EXISTS idx_detectives_creator ON detectives(creator_id);
CREATE INDEX IF NOT EXISTS idx_added_detectives_user ON added_detectives(user_id);

-- =====================================================
-- RPC Functions (atomic operations)
-- =====================================================

CREATE OR REPLACE FUNCTION deduct_balance(p_user_id BIGINT, p_amount INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
    UPDATE users SET balance = balance - p_amount WHERE id = p_user_id AND balance >= p_amount;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refund_balance(p_user_id BIGINT, p_amount INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
    UPDATE users SET balance = balance + p_amount WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION toggle_spy_mode(p_user_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    new_val BOOLEAN;
BEGIN
    INSERT INTO users (id) VALUES (p_user_id) ON CONFLICT (id) DO NOTHING;
    UPDATE users SET spy_mode = NOT spy_mode WHERE id = p_user_id RETURNING spy_mode INTO new_val;
    RETURN new_val;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) & POLICIES
-- =====================================================

-- Включение RLS для всех таблиц
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE detectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE added_detectives ENABLE ROW LEVEL SECURITY;

-- 1. Политики для таблицы users
DROP POLICY IF EXISTS "Пользователи могут просматривать только свой профи" ON users;
CREATE POLICY "Пользователи могут просматривать только свой профи" 
ON users FOR SELECT 
TO authenticated 
USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Пользователи могут обновлять только свой профиль" ON users;
CREATE POLICY "Пользователи могут обновлять только свой профиль" 
ON users FOR UPDATE 
TO authenticated 
USING (auth.uid()::text = id::text)
WITH CHECK (auth.uid()::text = id::text);

-- 2. Политики для таблицы cases
DROP POLICY IF EXISTS "Пользователи могут видеть только свои расследования" ON cases;
CREATE POLICY "Пользователи могут видеть только свои расследования" 
ON cases FOR SELECT 
TO authenticated 
USING (auth.uid()::text = customer_id::text);

DROP POLICY IF EXISTS "Пользователи могут управлять только своими расследованиями" ON cases;
CREATE POLICY "Пользователи могут управлять только своими расследованиями" 
ON cases FOR ALL 
TO authenticated 
USING (auth.uid()::text = customer_id::text)
WITH CHECK (auth.uid()::text = customer_id::text);

-- 3. Политики для таблицы chat_history
DROP POLICY IF EXISTS "Пользователи могут видеть историю только своих чатов" ON chat_history;
CREATE POLICY "Пользователи могут видеть историю только своих чатов" 
ON chat_history FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM cases 
        WHERE cases.id = chat_history.case_id 
        AND cases.customer_id::text = auth.uid()::text
    )
);

-- 4. Политики для таблицы targets
DROP POLICY IF EXISTS "Пользователи могут видеть только свои цели" ON targets;
CREATE POLICY "Пользователи могут видеть только свои цели" 
ON targets FOR SELECT 
TO authenticated 
USING (auth.uid()::text = owner_id::text);

DROP POLICY IF EXISTS "Пользователи могут управлять только своими целями" ON targets;
CREATE POLICY "Пользователи могут управлять только своими целями" 
ON targets FOR ALL 
TO authenticated 
USING (auth.uid()::text = owner_id::text)
WITH CHECK (auth.uid()::text = owner_id::text);

-- 5. Политики для таблицы wishlist
DROP POLICY IF EXISTS "Пользователи могут видеть только списки желаний своих целей" ON wishlist;
CREATE POLICY "Пользователи могут видеть только списки желаний своих целей" 
ON wishlist FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM targets 
        WHERE targets.id = wishlist.target_id 
        AND targets.owner_id::text = auth.uid()::text
    )
);

DROP POLICY IF EXISTS "Пользователи могут управлять списками желаний своих целей" ON wishlist;
CREATE POLICY "Пользователи могут управлять списками желаний своих целей" 
ON wishlist FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM targets 
        WHERE targets.id = wishlist.target_id 
        AND targets.owner_id::text = auth.uid()::text
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM targets 
        WHERE targets.id = wishlist.target_id 
        AND targets.owner_id::text = auth.uid()::text
    )
);

-- 6. Политики для таблицы reminders
DROP POLICY IF EXISTS "Пользователи могут видеть только свои напоминания" ON reminders;
CREATE POLICY "Пользователи могут видеть только свои напоминания" 
ON reminders FOR SELECT 
TO authenticated 
USING (auth.uid()::text = customer_id::text);

DROP POLICY IF EXISTS "Пользователи могут управлять только своими напоминаниями" ON reminders;
CREATE POLICY "Пользователи могут управлять только своими напоминаниями" 
ON reminders FOR ALL 
TO authenticated 
USING (auth.uid()::text = customer_id::text)
WITH CHECK (auth.uid()::text = customer_id::text);

-- 7. Политики для таблицы detectives
DROP POLICY IF EXISTS "Каждый может видеть системных или одобренных публичных детективов" ON detectives;
CREATE POLICY "Каждый может видеть системных или одобренных публичных детективов" 
ON detectives FOR SELECT 
TO authenticated 
USING (
    creator_id IS NULL 
    OR creator_id::text = auth.uid()::text 
    OR (is_public = TRUE AND is_approved = TRUE)
);

DROP POLICY IF EXISTS "Пользователи могут управлять своими детективами" ON detectives;
CREATE POLICY "Пользователи могут управлять своими детективами" 
ON detectives FOR ALL 
TO authenticated 
USING (creator_id::text = auth.uid()::text)
WITH CHECK (creator_id::text = auth.uid()::text);

-- 8. Политики для таблицы added_detectives
DROP POLICY IF EXISTS "Пользователи могут видеть только свои добавленные детективы" ON added_detectives;
CREATE POLICY "Пользователи могут видеть только свои добавленные детективы" 
ON added_detectives FOR SELECT 
TO authenticated 
USING (user_id::text = auth.uid()::text);

DROP POLICY IF EXISTS "Пользователи могут добавлять/удалять детективы в свою библиотеку" ON added_detectives;
CREATE POLICY "Пользователи могут добавлять/удалять детективы в свою библиотеку" 
ON added_detectives FOR ALL 
TO authenticated 
USING (user_id::text = auth.uid()::text)
WITH CHECK (user_id::text = auth.uid()::text);
