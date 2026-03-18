import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from telethon import TelegramClient, events

from bot.handlers import onboarding, profile, dossier, investigation, shadow_mode, manual_interceptor, feedback
from bot.handlers import targets
from bot.keyboards.common import resolve_target_display_name
from services.ai_detective import AIDetectiveService
from services.scheduler import background_tasks_worker, resolve_target
from database import db
import config

logging.basicConfig(level=logging.INFO)

bot = Bot(token=config.BOT_TOKEN)
dp = Dispatcher()
client = TelegramClient('user_session', config.TELEGRAM_API_ID, config.TELEGRAM_API_HASH)
ai_service = AIDetectiveService()

# Регистрируем роутеры
dp.include_router(onboarding.router)
dp.include_router(profile.router)
dp.include_router(dossier.router)
dp.include_router(targets.router)
dp.include_router(shadow_mode.router)
dp.include_router(investigation.router)
dp.include_router(feedback.router)
dp.include_router(manual_interceptor.router)


# ================= SPY MODE HELPERS =================

def get_spy_kb(case_id: int, msg_index: int, total: int) -> InlineKeyboardMarkup:
    buttons = []
    
    nav_row = []
    if msg_index > 0:
        nav_row.append(InlineKeyboardButton(text="⬅️", callback_data=f"spy_prev_{case_id}_{msg_index}"))
    nav_row.append(InlineKeyboardButton(text=f"{msg_index + 1}/{total}", callback_data="spy_noop"))
    if msg_index < total - 1:
        nav_row.append(InlineKeyboardButton(text="➡️", callback_data=f"spy_next_{case_id}_{msg_index}"))
    buttons.append(nav_row)
    
    buttons.append([InlineKeyboardButton(text="🕹️ Взять управление", callback_data=f"pause_ai_{case_id}")])
    
    return InlineKeyboardMarkup(inline_keyboard=buttons)


async def update_spy_message(case_id: int, customer_id: int, display_name: str, persona: str):
    """Обновляет или создаёт единственное spy-сообщение для дела."""
    total = await db.get_chat_history_count(case_id)
    if total == 0:
        return
    
    msg_index = total - 1
    row = await db.get_chat_message_at(case_id, msg_index)
    if not row:
        return
    
    sender, message_text = row
    if sender == 'user':
        header = f"👤 **{display_name}**:"
    else:
        header = f"🕵️‍♂ **{persona}**:"
    
    text = (
        f"📡 **Прямой эфир** — Дело по {display_name}\n"
        "━━━━━━━━━━━━━━━━━━\n"
        f"{header}\n{message_text}\n"
        "━━━━━━━━━━━━━━━━━━"
    )
    
    kb = get_spy_kb(case_id, msg_index, total)
    
    existing_msg_id = await db.get_spy_message_id(case_id)
    
    if existing_msg_id:
        try:
            await bot.edit_message_text(
                chat_id=customer_id,
                message_id=existing_msg_id,
                text=text,
                parse_mode="Markdown",
                reply_markup=kb
            )
            return
        except Exception:
            pass
    
    # Отправляем новое сообщение и сохраняем ID
    sent = await bot.send_message(
        chat_id=customer_id,
        text=text,
        parse_mode="Markdown",
        reply_markup=kb
    )
    await db.set_spy_message_id(case_id, sent.message_id)
    
    # Fix #2: Закрепляем spy-сообщение
    try:
        await bot.pin_chat_message(
            chat_id=customer_id,
            message_id=sent.message_id,
            disable_notification=True
        )
    except Exception:
        pass  # Может не сработать если нет прав


# ================= ОБЩИЙ ОБРАБОТЧИК СООБЩЕНИЙ TELETHON =================

async def _process_target_input(case, user_message, event):
    """Общая логика обработки входящего сообщения от цели."""
    case_id, customer_id, target, holiday, context, persona, budget, status, report = case

    if status not in ['started', 'in_progress', 'manual_mode']:
        return

    if not user_message:
        return

    await db.save_chat_message(case_id, 'user', user_message)
    
    display_name = await resolve_target_display_name(customer_id, target)
    spy_mode = await db.get_user_spy_mode(customer_id)
    
    # Spy Mode — обновляем сообщение
    if spy_mode:
        await update_spy_message(case_id, customer_id, display_name, persona)

    if status == 'manual_mode':
        return

    chat_entity = await event.get_chat()
    async with client.action(chat_entity, 'typing'):
        try:
            chat_session = await ai_service.restore_chat_from_db(case_id, holiday, context, persona, budget)
            ai_text = await ai_service.generate_response(chat_session, user_message)

            if not ai_text:
                return

            if "[ДЕЛО ЗАКРЫТО]" in ai_text:
                clean_text = ai_text.replace("[ДЕЛО ЗАКРЫТО]", "").strip()
                await event.respond(clean_text, parse_mode="Markdown")
                await db.save_chat_message(case_id, 'ai', clean_text)

                logging.info("📝 Формирую отчет...")
                report_text = await ai_service.generate_final_report(chat_session)

                if report_text:
                    gifts = AIDetectiveService.extract_gifts_from_report(report_text)
                    if gifts:
                        saved_target = await db.find_target_by_identifier(customer_id, target)
                        if not saved_target:
                            target_id = await db.add_target(customer_id, target)
                        else:
                            target_id = saved_target[0]
                        
                        for category, description in gifts:
                            await db.add_to_wishlist(target_id, description, category=category, added_by='ai')
                        logging.info(f"🎁 Добавлено {len(gifts)} подарков в вишлист")
                    
                    import re
                    clean_report = re.sub(r'\[GIFT:[^\]]+\]', '', report_text).strip()
                    await db.update_case_status(case_id, 'done', clean_report)
                else:
                    await db.update_case_status(case_id, 'done', report_text or '')
                    
                logging.info(f"✅ Дело №{case_id} успешно закрыто!")

            else:
                await event.respond(ai_text, parse_mode="Markdown")
                await db.save_chat_message(case_id, 'ai', ai_text)
                
                if spy_mode:
                    await update_spy_message(case_id, customer_id, display_name, persona)

        except Exception as e:
            logging.error(f"Ошибка диалога: {e}")


async def _find_case_for_sender(sender):
    """Ищет активное дело по отправителю."""
    target_username = sender.username
    target_phone = getattr(sender, 'phone', None)
    
    case = None
    if target_username:
        case = await db.get_active_case_by_target(target_username)
        if not case:
            case = await db.get_active_case_by_target(f"@{target_username}")
    
    if not case and target_phone:
        case = await db.get_active_case_by_target(target_phone)
        if not case:
            case = await db.get_active_case_by_target(f"+{target_phone}")
    
    return case


# ================= TELETHON HANDLERS =================

@client.on(events.NewMessage(incoming=True))
async def handle_target_message(event):
    if not event.is_private:
        return

    target_sender = await event.get_sender()
    case = await _find_case_for_sender(target_sender)
    if not case:
        return

    await _process_target_input(case, event.raw_text, event)


# Fix #3: Обработка отредактированных сообщений от цели
@client.on(events.MessageEdited(incoming=True))
async def handle_target_edited_message(event):
    if not event.is_private:
        return

    target_sender = await event.get_sender()
    case = await _find_case_for_sender(target_sender)
    if not case:
        return

    case_id = case[0]
    customer_id = case[1]
    edited_text = event.raw_text
    if not edited_text:
        return

    # Сохраняем как новое сообщение (с пометкой об редактировании)
    await db.save_chat_message(case_id, 'user', f"✏️ [ред.] {edited_text}")
    
    display_name = await resolve_target_display_name(customer_id, case[2])
    spy_mode = await db.get_user_spy_mode(customer_id)
    if spy_mode:
        await update_spy_message(case_id, customer_id, display_name, case[5])

    # Если в ИИ-режиме — ИИ реагирует на редактирование
    if case[7] in ['started', 'in_progress']:
        chat_entity = await event.get_chat()
        async with client.action(chat_entity, 'typing'):
            try:
                chat_session = await ai_service.restore_chat_from_db(
                    case_id, case[3], case[4], case[5], case[6]
                )
                ai_text = await ai_service.generate_response(chat_session, edited_text)
                if ai_text:
                    await event.respond(ai_text, parse_mode="Markdown")
                    await db.save_chat_message(case_id, 'ai', ai_text)
                    if spy_mode:
                        await update_spy_message(case_id, customer_id, display_name, case[5])
            except Exception as e:
                logging.error(f"Ошибка при обработке ред. сообщения: {e}")


# ================= SPY NAVIGATION CALLBACKS =================

@dp.callback_query(lambda c: c.data and c.data.startswith("spy_prev_"))
async def spy_prev(callback):
    parts = callback.data.split("_")
    case_id = int(parts[2])
    current = int(parts[3])
    new_index = max(0, current - 1)
    
    customer_id = callback.from_user.id
    case = await db.get_case_by_id(case_id)
    if not case: 
        await callback.answer()
        return
    
    target, persona = case[2], case[5]
    display_name = await resolve_target_display_name(customer_id, target)
    total = await db.get_chat_history_count(case_id)
    row = await db.get_chat_message_at(case_id, new_index)
    
    if not row:
        await callback.answer()
        return
    
    sender, message_text = row
    header = f"👤 **{display_name}**:" if sender == 'user' else f"🕵️‍♂ **{persona}**:"
    
    text = (
        f"📡 **Прямой эфир** — Дело по {display_name}\n"
        "━━━━━━━━━━━━━━━━━━\n"
        f"{header}\n{message_text}\n"
        "━━━━━━━━━━━━━━━━━━"
    )
    
    await callback.message.edit_text(text, parse_mode="Markdown", reply_markup=get_spy_kb(case_id, new_index, total))
    await callback.answer()


@dp.callback_query(lambda c: c.data and c.data.startswith("spy_next_"))
async def spy_next(callback):
    parts = callback.data.split("_")
    case_id = int(parts[2])
    current = int(parts[3])
    
    customer_id = callback.from_user.id
    case = await db.get_case_by_id(case_id)
    if not case:
        await callback.answer()
        return
    
    target, persona = case[2], case[5]
    display_name = await resolve_target_display_name(customer_id, target)
    total = await db.get_chat_history_count(case_id)
    new_index = min(total - 1, current + 1)
    row = await db.get_chat_message_at(case_id, new_index)
    
    if not row:
        await callback.answer()
        return
    
    sender, message_text = row
    header = f"👤 **{display_name}**:" if sender == 'user' else f"🕵️‍♂ **{persona}**:"
    
    text = (
        f"📡 **Прямой эфир** — Дело по {display_name}\n"
        "━━━━━━━━━━━━━━━━━━\n"
        f"{header}\n{message_text}\n"
        "━━━━━━━━━━━━━━━━━━"
    )
    
    await callback.message.edit_text(text, parse_mode="Markdown", reply_markup=get_spy_kb(case_id, new_index, total))
    await callback.answer()


@dp.callback_query(lambda c: c.data == "spy_noop")
async def spy_noop(callback):
    await callback.answer()


# ================= Fix #8: AUTO-RECOVERY (неотвеченные сообщения) =================

async def auto_reply_recovery():
    """Фоновая задача: проверяет дела, где последнее сообщение от цели без ответа ИИ."""
    await asyncio.sleep(15)  # Ждём стартовой инициализации
    logging.info("🔄 Auto-reply recovery запущен")
    
    while True:
        try:
            # Находим все активные in_progress дела
            import aiosqlite
            from database.db import DB_PATH
            async with aiosqlite.connect(DB_PATH) as conn:
                async with conn.execute("""
                    SELECT c.id, c.customer_id, c.target, c.holiday, c.context, c.persona, c.budget
                    FROM cases c
                    WHERE c.status IN ('in_progress', 'started')
                """) as cursor:
                    active_cases = await cursor.fetchall()
            
            for ac in active_cases:
                case_id, customer_id, target, holiday, context, persona, budget = ac
                
                # Проверяем: последнее сообщение от 'user' и нет ответа 'ai' после него
                import aiosqlite
                async with aiosqlite.connect(DB_PATH) as conn:
                    async with conn.execute("""
                        SELECT sender, message FROM chat_history 
                        WHERE case_id = ? ORDER BY id DESC LIMIT 1
                    """, (case_id,)) as cursor:
                        last = await cursor.fetchone()
                
                if last and last[0] == 'user':
                    # Последнее сообщение от цели без ответа — генерируем ответ
                    logging.info(f"🔄 Auto-recovery: Дело №{case_id}, отвечаем на неотвеченное сообщение цели")
                    try:
                        target_entity = await resolve_target(client, target)
                        if not target_entity:
                            continue
                        
                        chat_session = await ai_service.restore_chat_from_db(case_id, holiday, context, persona, budget)
                        ai_text = await ai_service.generate_response(chat_session, last[1])
                        
                        if ai_text and "[ДЕЛО ЗАКРЫТО]" not in ai_text:
                            await client.send_message(target_entity, ai_text, parse_mode="Markdown")
                            await db.save_chat_message(case_id, 'ai', ai_text)
                            
                            spy_mode = await db.get_user_spy_mode(customer_id)
                            if spy_mode:
                                display_name = await resolve_target_display_name(customer_id, target)
                                await update_spy_message(case_id, customer_id, display_name, persona)
                            
                            logging.info(f"✅ Auto-recovery: Ответ отправлен по делу №{case_id}")
                    except Exception as e:
                        logging.error(f"Auto-recovery error for case {case_id}: {e}")
        
        except Exception as e:
            logging.error(f"Auto-recovery global error: {e}")
        
        await asyncio.sleep(30)  # Проверяем каждые 30 секунд


# ================= STARTUP =================

async def start_uvicorn():
    import uvicorn
    from admin_app import app
    logging.info("🌐 Запуск Admin Web Panel (http://localhost:8000/admin)...")
    uvi_config = uvicorn.Config(app=app, host="0.0.0.0", port=8000, log_level="info")
    server = uvicorn.Server(uvi_config)
    await server.serve()

async def main():
    logging.info("🤖 Инициализация базы данных и запуск...")
    await db.init_db()

    asyncio.create_task(background_tasks_worker(bot, client))
    asyncio.create_task(start_uvicorn())
    asyncio.create_task(auto_reply_recovery())  # Fix #8

    await client.start(phone=config.USER_PHONE)
    logging.info("🕵️‍♂️ Агент на связи!")

    import sys
    sys.modules['main'] = sys.modules[__name__]

    try:
        logging.info("🤖 Бот-Менеджер запущен!")
        await dp.start_polling(bot)
    finally:
        await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
