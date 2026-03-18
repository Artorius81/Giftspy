from aiogram import Router, F
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from bot.keyboards.common import get_reminder_kb, main_menu, resolve_target_display_name
from bot.states.order import AddIdeaStates, ReminderStates, OrderGift
from database import db
from datetime import datetime, timedelta

router = Router()

@router.message(F.text == "📁 Картотека досье")
async def show_dossier_list(message: Message):
    customer_id = message.from_user.id
    cases = await db.get_all_user_cases(customer_id)

    if not cases:
        await message.answer(
            "🗄 В вашей картотеке пока пусто.\n\n"
            "Как только вы начнете расследование, оно появится здесь.",
            reply_markup=main_menu
        )
        return

    contacts = {}
    for case in cases:
        case_id, target, status, report = case
        if target not in contacts:
            contacts[target] = {"count": 1, "has_active": status in ["pending", "started", "in_progress", "manual_mode"]}
        else:
            contacts[target]["count"] += 1
            if status in ["pending", "started", "in_progress", "manual_mode"]:
                contacts[target]["has_active"] = True

    keyboard_builder = []
    for target, info in contacts.items():
        display_name = await resolve_target_display_name(customer_id, target)
        status_icon = "🔵" if info["has_active"] else "📁"
        count_text = f" ({info['count']})" if info['count'] > 1 else ""
        btn = InlineKeyboardButton(
            text=f"{status_icon} {display_name}{count_text}", 
            callback_data=f"dossier_{target}"
        )
        keyboard_builder.append([btn])

    inline_kb = InlineKeyboardMarkup(inline_keyboard=keyboard_builder)
    await message.answer(
        f"📁 **Картотека** ({len(contacts)} чел.)\nВыберите человека:",
        reply_markup=inline_kb,
        parse_mode="Markdown"
    )


@router.callback_query(F.data.startswith("dossier_"))
async def show_target_dossier(callback: CallbackQuery):
    target = callback.data.split("_", 1)[1]
    customer_id = callback.from_user.id
    cases = await db.get_all_user_cases(customer_id)
    target_cases = [c for c in cases if c[1] == target]
    
    if not target_cases:
        await callback.answer("Досье не найдено")
        return
    
    display_name = await resolve_target_display_name(customer_id, target)
    
    keyboard_builder = []
    for case in target_cases:
        case_id, t, status, report = case
        icons = {'pending': '🟡', 'started': '🔵', 'in_progress': '🔵', 'manual_mode': '🛑', 'done': '✅', 'delivered': '✅', 'cancelled': '❌', 'error': '⚠️'}
        names = {'pending': 'Ожид.', 'started': 'Начато', 'in_progress': 'Допрос', 'manual_mode': 'Перехват', 'done': 'Готово', 'delivered': 'Готово', 'cancelled': 'Отмена', 'error': 'Ошибка'}
        icon = icons.get(status, '⚪')
        name = names.get(status, status)
        keyboard_builder.append([InlineKeyboardButton(
            text=f"{icon} №{case_id} — {name}",
            callback_data=f"case_detail_{case_id}"
        )])
    
    keyboard_builder.append([InlineKeyboardButton(text="🔄 Новое расследование", callback_data=f"investigate_{target}")])
    keyboard_builder.append([InlineKeyboardButton(text="🔙 Назад", callback_data="back_dossier_list")])
    
    try:
        await callback.message.edit_text(
            f"👤 **{display_name}** ({target})\n📁 Дел: {len(target_cases)}\n\nВыберите дело:",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard_builder),
            parse_mode="Markdown"
        )
    except Exception:
        await callback.message.answer(
            f"👤 **{display_name}** ({target})\n📁 Дел: {len(target_cases)}\n\nВыберите дело:",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard_builder),
            parse_mode="Markdown"
        )
    await callback.answer()


@router.callback_query(F.data == "back_dossier_list")
async def back_to_dossier_list(callback: CallbackQuery):
    customer_id = callback.from_user.id
    cases = await db.get_all_user_cases(customer_id)

    if not cases:
        await callback.message.edit_text("🗄 В вашей картотеке пока пусто.")
        await callback.answer()
        return

    contacts = {}
    for case in cases:
        case_id, target, status, report = case
        if target not in contacts:
            contacts[target] = {"count": 1, "has_active": status in ["pending", "started", "in_progress", "manual_mode"]}
        else:
            contacts[target]["count"] += 1
            if status in ["pending", "started", "in_progress", "manual_mode"]:
                contacts[target]["has_active"] = True

    keyboard_builder = []
    for target, info in contacts.items():
        display_name = await resolve_target_display_name(customer_id, target)
        status_icon = "🔵" if info["has_active"] else "📁"
        count_text = f" ({info['count']})" if info['count'] > 1 else ""
        keyboard_builder.append([InlineKeyboardButton(
            text=f"{status_icon} {display_name}{count_text}", 
            callback_data=f"dossier_{target}"
        )])

    await callback.message.edit_text(
        f"📁 **Картотека** ({len(contacts)} чел.)\nВыберите человека:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard_builder),
        parse_mode="Markdown"
    )
    await callback.answer()


@router.callback_query(F.data.startswith("case_detail_"))
async def show_case_detail(callback: CallbackQuery):
    case_id = int(callback.data.split("_")[2])
    customer_id = callback.from_user.id
    case = await db.get_case_by_id(case_id)
    if not case:
        await callback.answer("Дело не найдено")
        return
    
    _, _, target, holiday, context, persona, budget, status, report = case
    display_name = await resolve_target_display_name(customer_id, target)
    
    status_names = {'pending': '🟡 Ожидание', 'started': '🔵 Начато', 'in_progress': '🔵 Допрос', 'manual_mode': '🛑 Перехват', 'done': '✅ Готово', 'delivered': '✅ Доставлено', 'cancelled': '❌ Отменено'}
    
    msg = f"📁 **Дело №{case_id}**\n🎯 {display_name} | 🎉 {holiday}\n🎭 {persona}\nСтатус: {status_names.get(status, status)}\n"
    
    if status in ['done', 'delivered'] and report:
        safe_report = report.replace("**", "").replace("_", "")
        msg += f"━━━━━━━━━━━━━\n🎁 ОТЧЁТ:\n{safe_report[:800]}"
    
    kb = [
        [InlineKeyboardButton(text="➕ Добавить идею", callback_data=f"add_idea_{case_id}")],
        [InlineKeyboardButton(text="📅 Напоминание", callback_data=f"remind_{case_id}")],
        [InlineKeyboardButton(text="🔙 Назад", callback_data=f"dossier_{target}")]
    ]
    
    try:
        await callback.message.edit_text(msg, reply_markup=InlineKeyboardMarkup(inline_keyboard=kb), parse_mode="Markdown")
    except Exception:
        await callback.message.answer(msg, reply_markup=InlineKeyboardMarkup(inline_keyboard=kb), parse_mode="Markdown")
    await callback.answer()


# ================= ОТПРАВИТЬ ДЕТЕКТИВА СНОВА =================

@router.callback_query(F.data.startswith("investigate_"))
async def reinvestigate_target(callback: CallbackQuery, state: FSMContext):
    target = callback.data.split("_", 1)[1]
    customer_id = callback.from_user.id
    
    active_cases = await db.get_user_active_cases(customer_id)
    for case in active_cases:
        if case[1] == target:
            display_name = await resolve_target_display_name(customer_id, target)
            await callback.answer(f"Уже есть активное дело на {display_name}!", show_alert=True)
            return
    
    await state.update_data(target=target)
    saved = await db.find_target_by_identifier(customer_id, target)
    if saved and saved[3]:
        await state.update_data(saved_context=saved[3])
    
    display_name = await resolve_target_display_name(customer_id, target)
    from bot.keyboards.common import holiday_kb
    await callback.message.answer(
        f"🔄 Повторное расследование на **{display_name}**!\n🎉 Какой повод?",
        reply_markup=holiday_kb, parse_mode="Markdown"
    )
    await state.set_state(OrderGift.waiting_for_holiday)
    await callback.answer()


# ================= ДОБАВИТЬ ИДЕЮ =================

@router.callback_query(F.data.startswith("add_idea_"))
async def start_add_idea(callback: CallbackQuery, state: FSMContext):
    case_id = int(callback.data.split("_")[2])
    case = await db.get_case_by_id(case_id)
    if not case:
        await callback.answer("Дело не найдено")
        return
    
    target = case[2]
    display_name = await resolve_target_display_name(callback.from_user.id, target)
    await state.update_data(idea_case_id=case_id, idea_target=target)
    
    await callback.message.edit_text(
        f"💡 Введите идею подарка для **{display_name}**:",
        parse_mode="Markdown"
    )
    await state.set_state(AddIdeaStates.waiting_for_idea)
    await callback.answer()


@router.message(AddIdeaStates.waiting_for_idea)
async def process_add_idea(message: Message, state: FSMContext):
    data = await state.get_data()
    target = data.get("idea_target")
    idea_text = message.text.strip()
    
    if not idea_text:
        await message.answer("❌ Идея не может быть пустой.")
        return
    
    display_name = await resolve_target_display_name(message.from_user.id, target)
    saved = await db.find_target_by_identifier(message.from_user.id, target)
    target_id = saved[0] if saved else await db.add_target(message.from_user.id, target)
    
    await db.add_to_wishlist(target_id, idea_text, added_by='user')
    await message.answer(
        f"✅ Идея для **{display_name}** добавлена!\n💡 «{idea_text}»",
        parse_mode="Markdown", reply_markup=main_menu
    )
    await state.clear()


# ================= НАПОМИНАНИЯ =================

@router.callback_query(F.data.startswith("remind_") & ~F.data.startswith("remind_3d_") & ~F.data.startswith("remind_7d_") & ~F.data.startswith("remind_30d_") & ~F.data.startswith("remind_custom_") & ~F.data.startswith("remind_back_"))
async def show_reminder_options(callback: CallbackQuery):
    case_id = int(callback.data.split("_")[1])
    await callback.message.edit_text(
        "⏰ **Когда напомнить?**",
        reply_markup=get_reminder_kb(case_id),
        parse_mode="Markdown"
    )
    await callback.answer()


@router.callback_query(F.data.startswith("remind_3d_"))
async def remind_3d(callback: CallbackQuery):
    case_id = int(callback.data.split("_")[2])
    case = await db.get_case_by_id(case_id)
    target = case[2] if case else "?"
    display_name = await resolve_target_display_name(callback.from_user.id, target)
    await db.add_reminder(callback.from_user.id, case_id, display_name, datetime.utcnow() + timedelta(days=3))
    await callback.message.edit_text(f"✅ Напомню о **{display_name}** через 3 дня.", parse_mode="Markdown")
    await callback.answer("Сохранено!")


@router.callback_query(F.data.startswith("remind_7d_"))
async def remind_7d(callback: CallbackQuery):
    case_id = int(callback.data.split("_")[2])
    case = await db.get_case_by_id(case_id)
    target = case[2] if case else "?"
    display_name = await resolve_target_display_name(callback.from_user.id, target)
    await db.add_reminder(callback.from_user.id, case_id, display_name, datetime.utcnow() + timedelta(days=7))
    await callback.message.edit_text(f"✅ Напомню о **{display_name}** через неделю.", parse_mode="Markdown")
    await callback.answer("Сохранено!")


@router.callback_query(F.data.startswith("remind_30d_"))
async def remind_30d(callback: CallbackQuery):
    case_id = int(callback.data.split("_")[2])
    case = await db.get_case_by_id(case_id)
    target = case[2] if case else "?"
    display_name = await resolve_target_display_name(callback.from_user.id, target)
    await db.add_reminder(callback.from_user.id, case_id, display_name, datetime.utcnow() + timedelta(days=30))
    await callback.message.edit_text(f"✅ Напомню о **{display_name}** через месяц.", parse_mode="Markdown")
    await callback.answer("Сохранено!")


@router.callback_query(F.data.startswith("remind_custom_"))
async def remind_custom(callback: CallbackQuery, state: FSMContext):
    case_id = int(callback.data.split("_")[2])
    await state.update_data(remind_case_id=case_id)
    await callback.message.edit_text("📅 Введите дату в формате **ДД.ММ.ГГГГ**:", parse_mode="Markdown")
    await state.set_state(ReminderStates.waiting_for_custom_date)
    await callback.answer()


@router.message(ReminderStates.waiting_for_custom_date)
async def process_custom_date(message: Message, state: FSMContext):
    try:
        remind_at = datetime.strptime(message.text.strip(), "%d.%m.%Y")
        if remind_at <= datetime.utcnow():
            await message.answer("❌ Дата должна быть в будущем.")
            return
        
        data = await state.get_data()
        case_id = data.get("remind_case_id")
        case = await db.get_case_by_id(case_id)
        target = case[2] if case else "?"
        display_name = await resolve_target_display_name(message.from_user.id, target)
        
        await db.add_reminder(message.from_user.id, case_id, display_name, remind_at)
        await message.answer(
            f"✅ Напомню о **{display_name}** — **{remind_at.strftime('%d.%m.%Y')}**.",
            parse_mode="Markdown", reply_markup=main_menu
        )
        await state.clear()
    except ValueError:
        await message.answer("❌ Формат: **ДД.ММ.ГГГГ**", parse_mode="Markdown")


@router.callback_query(F.data.startswith("remind_back_"))
async def remind_back(callback: CallbackQuery):
    case_id = int(callback.data.split("_")[2])
    case = await db.get_case_by_id(case_id)
    if not case:
        await callback.message.delete()
        await callback.answer()
        return
    
    # Возвращаемся к деталям дела — перестраиваем сообщение
    target = case[2]
    customer_id = callback.from_user.id
    display_name = await resolve_target_display_name(customer_id, target)
    holiday, persona, status, report = case[3], case[5], case[7], case[8]
    
    status_names = {'pending': '🟡 Ожидание', 'started': '🔵 Начато', 'in_progress': '🔵 Допрос', 'manual_mode': '🛑 Перехват', 'done': '✅ Готово', 'delivered': '✅ Доставлено', 'cancelled': '❌ Отменено'}
    msg = f"📁 **Дело №{case_id}**\n🎯 {display_name} | 🎉 {holiday}\n🎭 {persona}\nСтатус: {status_names.get(status, status)}\n"
    
    if status in ['done', 'delivered'] and report:
        safe_report = report.replace("**", "").replace("_", "")
        msg += f"━━━━━━━━━━━━━\n🎁 ОТЧЁТ:\n{safe_report[:800]}"
    
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Добавить идею", callback_data=f"add_idea_{case_id}")],
        [InlineKeyboardButton(text="📅 Напоминание", callback_data=f"remind_{case_id}")],
        [InlineKeyboardButton(text="🔙 Назад", callback_data=f"dossier_{target}")]
    ])
    
    await callback.message.edit_text(msg, reply_markup=kb, parse_mode="Markdown")
    await callback.answer()
