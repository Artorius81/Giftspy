-- =====================================================
-- Giftspy: Supabase Schema Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- =====================================================

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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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
    registered_at TIMESTAMPTZ DEFAULT NOW()
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

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_cases_customer ON cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_target ON cases(target);
CREATE INDEX IF NOT EXISTS idx_chat_case ON chat_history(case_id);
CREATE INDEX IF NOT EXISTS idx_targets_owner ON targets(owner_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_target ON wishlist(target_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(is_sent, remind_at);

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
