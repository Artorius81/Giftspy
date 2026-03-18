from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from bot.keyboards.shadow import get_shadow_mode_kb, get_return_ai_kb
from bot.keyboards.common import main_menu, get_manual_mode_menu, resolve_target_display_name
from database import db
import logging

router = Router()


@router.message(F.text == "📂 Мои активные дела")
async def my_cases(message: Message):
    customer_id = message.from_user.id
    cases = await db.get_user_active_cases(customer_id)

    if not cases:
        await message.answer("🗄 Нет активных дел. Заведите новое!", reply_markup=main_menu)
        return

    parts = ["📂 **Активные расследования:**\n"]
    kb_rows = []
    
    for case in cases:
        case_id, target, status = case
        display_name = await resolve_target_display_name(customer_id, target)
        
        status_map = {
            'pending': '🟡 Ожидание', 'started': '🔵 Начато',
            'in_progress': '🔵 Допрос', 'manual_mode': '🕹️ Перехват'
        }
        parts.append(f"▪️ №{case_id} | {display_name} — {status_map.get(status, '?')}")
        
        if status == 'pending':
            kb_rows.append([InlineKeyboardButton(text=f"❌ Отменить №{case_id}", callback_data=f"cancel_case_{case_id}")])
        elif status == 'in_progress':
            kb_rows.append([InlineKeyboardButton(text=f"🕹️ Перехватить №{case_id}", callback_data=f"pause_ai_{case_id}")])
        elif status == 'manual_mode':
            kb_rows.append([InlineKeyboardButton(text=f"🕵🏻 Вернуть детективу №{case_id}", callback_data=f"resume_ai_{case_id}")])

    kb = InlineKeyboardMarkup(inline_keyboard=kb_rows) if kb_rows else None
    await message.answer("\n".join(parts), parse_mode="Markdown", reply_markup=kb)


@router.callback_query(F.data.startswith("cancel_case_"))
async def cancel_case(callback: CallbackQuery):
    case_id = int(callback.data.split("_")[2])
    await db.update_case_status(case_id, 'cancelled')
    await callback.message.edit_text("❌ Дело отменено.")
    await callback.answer("Отменено")


@router.callback_query(F.data.startswith("pause_ai_"))
async def pause_ai(callback: CallbackQuery):
    case_id = int(callback.data.split("_")[2])
    customer_id = callback.from_user.id
    
    spy_mode = await db.get_user_spy_mode(customer_id)
    if not spy_mode:
        await callback.answer("⚠️ Включите Шпионский режим в настройках профиля!", show_alert=True)
        return
    
    await db.update_case_status(case_id, 'manual_mode')
    
    case = await db.get_case_by_id(case_id)
    target = case[2] if case else "цель"
    display_name = await resolve_target_display_name(customer_id, target)
    
    await callback.message.edit_text(
        f"🕹️ **Управление перехвачено!** Дело №{case_id}\n\n"
        f"Ваши сообщения будут пересланы **{display_name}**.\n"
        "Используйте кнопку ниже для возврата управления детективу 👇",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🕵🏻 Вернуть детективу", callback_data=f"resume_ai_{case_id}")]
        ])
    )
    # Fix #6: убираем лишний текст, просто обновляем клавиатуру
    await callback.message.answer("⌨️", reply_markup=get_manual_mode_menu(case_id))
    await callback.answer("ИИ на паузе")


# Fix #1: Правильный текст фильтра, совпадающий с кнопкой
@router.message(F.text.startswith("🕵🏻 Вернуть детективу"))
async def resume_ai_from_menu(message: Message):
    try:
        case_id = int(message.text.split("#")[1].replace(")", "").strip())
    except (IndexError, ValueError):
        await message.answer("❌ Не удалось определить номер дела.", reply_markup=main_menu)
        return
    
    customer_id = message.from_user.id
    case = await db.get_case_by_id(case_id)
    if not case or case[1] != customer_id:
        await message.answer("❌ Дело не найдено.", reply_markup=main_menu)
        return
    
    await db.update_case_status(case_id, 'in_progress')
    target = case[2]
    display_name = await resolve_target_display_name(customer_id, target)
    
    # Fix #6: без лишних текстов
    await message.answer(
        f"🕵🏻 Детектив вернулся к допросу **{display_name}**!",
        parse_mode="Markdown", reply_markup=main_menu
    )
    
    # Comeback
    try:
        from main import client
        from services.ai_detective import AIDetectiveService
        from services.scheduler import resolve_target
        
        ai = AIDetectiveService()
        chat_session = await ai.restore_chat_from_db(case_id, case[3], case[4], case[5], case[6])
        comeback_msg = await ai.generate_comeback_message(chat_session)
        
        if comeback_msg:
            target_entity = await resolve_target(client, target)
            if target_entity:
                await client.send_message(target_entity, comeback_msg)
                await db.save_chat_message(case_id, 'ai', comeback_msg)
    except Exception as e:
        logging.warning(f"Comeback failed: {e}")


@router.callback_query(F.data.startswith("resume_ai_"))
async def resume_ai(callback: CallbackQuery):
    case_id = int(callback.data.split("_")[2])
    customer_id = callback.from_user.id
    
    await db.update_case_status(case_id, 'in_progress')
    case = await db.get_case_by_id(case_id)
    target = case[2] if case else "цель"
    display_name = await resolve_target_display_name(customer_id, target)
    
    await callback.message.edit_text(
        f"🕵🏻 Детектив вернулся к допросу **{display_name}**!",
        parse_mode="Markdown"
    )
    # Fix #6: без "Главное меню:" — просто ставим клавиатуру
    await callback.message.answer("⌨️", reply_markup=main_menu)
    await callback.answer("Детектив вернулся")
    
    # Comeback
    try:
        from main import client
        from services.ai_detective import AIDetectiveService
        from services.scheduler import resolve_target
        
        ai = AIDetectiveService()
        chat_session = await ai.restore_chat_from_db(case_id, case[3], case[4], case[5], case[6])
        comeback_msg = await ai.generate_comeback_message(chat_session)
        
        if comeback_msg:
            target_entity = await resolve_target(client, target)
            if target_entity:
                await client.send_message(target_entity, comeback_msg)
                await db.save_chat_message(case_id, 'ai', comeback_msg)
    except Exception as e:
        logging.warning(f"Comeback failed: {e}")
