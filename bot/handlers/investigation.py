from aiogram import Router, F
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, CallbackQuery, InputMediaPhoto, ReplyKeyboardRemove, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import StateFilter

from bot.states.order import OrderGift
from bot.keyboards.common import PERSONAS, main_menu, resolve_target_display_name
from database import db

router = Router()

# ================= WIZARD HELPERS =================

HOLIDAY_OPTIONS = [
    "🎂 День Рождения", "💐 8 Марта", "🛡 23 Февраля",
    "🎄 Новый Год", "💍 Годовщина", "🎁 Просто так"
]

BUDGET_OPTIONS = [
    "💰 До 1 000 ₽", "💰 До 3 000 ₽", "💰 До 5 000 ₽",
    "💰 До 10 000 ₽", "💰 До 30 000 ₽", "💎 Неограничен"
]

WIZARD_STEPS = ['target', 'holiday', 'context', 'persona', 'budget', 'confirm']
STEP_NAMES = {
    'target': '🎯 Цель',
    'holiday': '🎉 Повод', 
    'context': '🧩 Зацепки',
    'persona': '🕵️‍♂️ Детектив',
    'budget': '💵 Бюджет',
    'confirm': '✅ Подтверждение'
}


def _progress_bar(step_key: str) -> str:
    idx = WIZARD_STEPS.index(step_key)
    total = len(WIZARD_STEPS)
    filled = "🔹" * (idx + 1)
    empty = "⚪" * (total - idx - 1)
    return f"{filled}{empty}  ({idx + 1}/{total})"


def _build_summary_lines(data: dict, customer_display: str = None) -> str:
    """Builds a summary of filled fields."""
    lines = []
    if data.get('target'):
        display = customer_display or data['target']
        lines.append(f"🎯 Цель: {display}")
    if data.get('holiday'):
        lines.append(f"🎉 Повод: {data['holiday']}")
    if data.get('context'):
        ctx = data['context']
        if len(ctx) > 50:
            ctx = ctx[:50] + "..."
        lines.append(f"🧩 Зацепки: {ctx}")
    if data.get('persona'):
        lines.append(f"🕵️‍♂️ Детектив: {data['persona']}")
    if data.get('budget'):
        lines.append(f"💵 Бюджет: {data['budget']}")
    return "\n".join(lines)


def _get_wizard_holiday_kb(editing: bool = False) -> InlineKeyboardMarkup:
    """Holiday selection keyboard for wizard."""
    rows = []
    for i in range(0, len(HOLIDAY_OPTIONS), 2):
        row = [InlineKeyboardButton(text=h, callback_data=f"wz_holiday_{h}") for h in HOLIDAY_OPTIONS[i:i+2]]
        rows.append(row)
    rows.append([InlineKeyboardButton(text="⏩ Пропустить", callback_data="wz_skip_holiday")])
    if not editing:
        rows.append([InlineKeyboardButton(text="◀️ Назад", callback_data="wz_back_target")])
    else:
        rows.append([InlineKeyboardButton(text="◀️ К подтверждению", callback_data="wz_back_to_confirm")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _get_wizard_context_kb(has_saved: bool = False, editing: bool = False) -> InlineKeyboardMarkup:
    rows = []
    if has_saved:
        rows.append([InlineKeyboardButton(text="✅ Из профиля", callback_data="wz_use_saved_context")])
    rows.append([InlineKeyboardButton(text="⏩ Пропустить", callback_data="wz_skip_context")])
    if not editing:
        rows.append([InlineKeyboardButton(text="◀️ Назад", callback_data="wz_back_holiday")])
    else:
        rows.append([InlineKeyboardButton(text="◀️ К подтверждению", callback_data="wz_back_to_confirm")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _get_wizard_persona_kb(persona_index: int, editing: bool = False) -> InlineKeyboardMarkup:
    prev_idx = persona_index - 1 if persona_index > 0 else len(PERSONAS) - 1
    next_idx = persona_index + 1 if persona_index < len(PERSONAS) - 1 else 0
    rows = [
        [InlineKeyboardButton(text="⬅️", callback_data=f"wz_persona_page_{prev_idx}"),
         InlineKeyboardButton(text="✅ Выбрать", callback_data=f"wz_persona_select_{persona_index}"),
         InlineKeyboardButton(text="➡️", callback_data=f"wz_persona_page_{next_idx}")]
    ]
    if not editing:
        rows.append([InlineKeyboardButton(text="◀️ Назад", callback_data="wz_back_context")])
    else:
        rows.append([InlineKeyboardButton(text="◀️ К подтверждению", callback_data="wz_back_to_confirm")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _get_wizard_budget_kb(editing: bool = False) -> InlineKeyboardMarkup:
    rows = []
    for i in range(0, len(BUDGET_OPTIONS), 2):
        row = [InlineKeyboardButton(text=b, callback_data=f"wz_budget_{b}") for b in BUDGET_OPTIONS[i:i+2]]
        rows.append(row)
    rows.append([InlineKeyboardButton(text="⏩ Пропустить", callback_data="wz_skip_budget")])
    if not editing:
        rows.append([InlineKeyboardButton(text="◀️ Назад", callback_data="wz_back_persona")])
    else:
        rows.append([InlineKeyboardButton(text="◀️ К подтверждению", callback_data="wz_back_to_confirm")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _get_wizard_confirm_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Подтвердить", callback_data="wz_confirm")],
        [InlineKeyboardButton(text="✏️ Цель", callback_data="wz_edit_target"),
         InlineKeyboardButton(text="✏️ Повод", callback_data="wz_edit_holiday")],
        [InlineKeyboardButton(text="✏️ Зацепки", callback_data="wz_edit_context"),
         InlineKeyboardButton(text="✏️ Детектив", callback_data="wz_edit_persona")],
        [InlineKeyboardButton(text="✏️ Бюджет", callback_data="wz_edit_budget")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="wz_back_budget")]
    ])


async def _next_step_or_confirm(state: FSMContext, data: dict, customer_id: int,
                                  callback_msg=None, message=None,
                                  current_step: str = 'holiday'):
    """After setting a field, either go to next step or back to confirm if editing."""
    editing = data.get('editing_field')
    if editing:
        await state.update_data(editing_field=None)
        data = await state.get_data()
        await _render_wizard_step('confirm', data, customer_id,
                                   callback_msg=callback_msg, message=message, state=state)
        await state.set_state(OrderGift.waiting_for_confirmation)
        return
    
    # Normal flow — go to next step
    step_order = {'holiday': 'context', 'context': 'persona', 'persona': 'budget', 'budget': 'confirm'}
    next_step = step_order.get(current_step, 'confirm')
    
    state_map = {
        'context': OrderGift.waiting_for_context,
        'persona': OrderGift.waiting_for_persona,
        'budget': OrderGift.waiting_for_budget,
        'confirm': OrderGift.waiting_for_confirmation,
    }
    
    await _render_wizard_step(next_step, data, customer_id,
                               callback_msg=callback_msg, message=message, state=state)
    await state.set_state(state_map[next_step])


async def _render_wizard_step(step: str, data: dict, customer_id: int, 
                               message=None, callback_msg=None, state=None,
                               persona_index: int = 0):
    """Renders the wizard at the given step. 
    Either edits callback_msg or sends new message via message.
    Returns the sent/edited message for tracking."""
    
    display_name = await resolve_target_display_name(customer_id, data.get('target', '?'))
    summary = _build_summary_lines(data, display_name)
    progress = _progress_bar(step)
    editing = bool(data.get('editing_field'))
    
    # Check if we need to switch between text and photo message types
    is_photo_step = (step == 'persona')
    wizard_msg_id = data.get('wizard_msg_id')
    wizard_msg_type = data.get('wizard_msg_type', 'text')
    
    target_msg = callback_msg or message
    bot = target_msg.bot if hasattr(target_msg, 'bot') else None
    chat_id = target_msg.chat.id if hasattr(target_msg, 'chat') else customer_id
    
    if step == 'holiday':
        text = (
            f"📋 **НОВОЕ РАССЛЕДОВАНИЕ**\n{progress}\n"
            f"{summary}\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "🎉 **Шаг 2: Какой повод?**\n\n"
            "Выберите из вариантов или напишите свой:"
        )
        kb = _get_wizard_holiday_kb(editing)
        
    elif step == 'context':
        has_saved = bool(data.get('saved_context'))
        hint = ""
        if has_saved:
            hint = f"\n📎 _У этой цели есть сохранённый профиль_"
        text = (
            f"📋 **НОВОЕ РАССЛЕДОВАНИЕ**\n{progress}\n"
            f"{summary}\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "🧩 **Шаг 3: Зацепки**\n\n"
            "Расскажите о человеке. Чем увлекается? Кем работает?\n"
            "_(Напишите текстом или пропустите)_"
            f"{hint}"
        )
        kb = _get_wizard_context_kb(has_saved, editing)
        
    elif step == 'persona':
        persona = PERSONAS[persona_index]
        caption = (
            f"📋 **НОВОЕ РАССЛЕДОВАНИЕ**\n{progress}\n"
            f"{summary}\n"
            "━━━━━━━━━━━━━━━━━━\n"
            f"🕵️‍♂️ **Шаг 4: Выберите детектива**\n\n"
            f"**{persona['name']}**\n{persona['desc']}"
        )
        kb = _get_wizard_persona_kb(persona_index, editing)
        
        if wizard_msg_id and wizard_msg_type == 'photo':
            # Edit existing photo message in place
            try:
                media = InputMediaPhoto(media=persona['photo'], caption=caption, parse_mode="Markdown")
                await bot.edit_message_media(
                    chat_id=chat_id, message_id=wizard_msg_id,
                    media=media, reply_markup=kb
                )
                if state:
                    await state.update_data(wizard_persona_idx=persona_index)
                return None  # Message ID unchanged
            except Exception:
                pass
        
        # Transition from text to photo: send photo FIRST, then delete text
        sent = await bot.send_photo(
            chat_id=chat_id, photo=persona['photo'],
            caption=caption, parse_mode="Markdown", reply_markup=kb
        )
        if wizard_msg_id and wizard_msg_type == 'text':
            try:
                await bot.delete_message(chat_id=chat_id, message_id=wizard_msg_id)
            except Exception:
                pass
        if state:
            await state.update_data(wizard_msg_id=sent.message_id, wizard_msg_type='photo', wizard_persona_idx=persona_index)
        return sent
        
    elif step == 'budget':
        text = (
            f"📋 **НОВОЕ РАССЛЕДОВАНИЕ**\n{progress}\n"
            f"{summary}\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "💵 **Шаг 5: Бюджет**\n\n"
            "Выберите из вариантов или напишите свой:"
        )
        kb = _get_wizard_budget_kb(editing)
        
    elif step == 'confirm':
        text = (
            f"📋 **НОВОЕ РАССЛЕДОВАНИЕ**\n{progress}\n"
            "━━━━━━━━━━━━━━━━━━\n"
            f"{summary}\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "Всё верно? Подтвердите или измените детали."
        )
        kb = _get_wizard_confirm_kb()
    else:
        return None
    
    # For text steps — handle transitions
    if not is_photo_step:
        if wizard_msg_id and wizard_msg_type == 'photo':
            # Transition from photo to text: send text FIRST, then delete photo
            sent = await bot.send_message(chat_id=chat_id, text=text, parse_mode="Markdown", reply_markup=kb)
            try:
                await bot.delete_message(chat_id=chat_id, message_id=wizard_msg_id)
            except Exception:
                pass
            if state:
                await state.update_data(wizard_msg_id=sent.message_id, wizard_msg_type='text')
            return sent
        
        if wizard_msg_id and wizard_msg_type == 'text':
            # Edit existing text message in place
            try:
                await bot.edit_message_text(
                    chat_id=chat_id, message_id=wizard_msg_id,
                    text=text, parse_mode="Markdown", reply_markup=kb
                )
                return None  # Message ID unchanged
            except Exception:
                pass
        
        # Send new text message (first time)
        sent = await bot.send_message(chat_id=chat_id, text=text, parse_mode="Markdown", reply_markup=kb)
        if state:
            await state.update_data(wizard_msg_id=sent.message_id, wizard_msg_type='text')
        return sent
    
    return None


# ================= ШАГ 1: ВЫБОР ЦЕЛИ (отдельное сообщение) =================

def _build_target_selection_text():
    return (
        "📁 **Новое расследование**\n\n"
        "🎯 **Шаг 1:** Выберите цель из сохранённых или введите вручную:"
    )


def _build_target_selection_kb(targets):
    keyboard_builder = []
    for t in targets:
        t_id, identifier, name, habits, birthday, photo = t
        display = name or identifier
        keyboard_builder.append([InlineKeyboardButton(
            text=f"👤 {display}", callback_data=f"pick_target_{t_id}"
        )])
    keyboard_builder.append([InlineKeyboardButton(text="✏️ Ввести вручную", callback_data="manual_target")])
    return InlineKeyboardMarkup(inline_keyboard=keyboard_builder)


@router.message(F.text == "🔍 Начать новое дело")
async def start_order(message: Message, state: FSMContext):
    await state.clear()
    
    balance = await db.get_user_balance(message.from_user.id)
    if balance <= 0:
        await message.answer(
            "🪙 **ВАШ БАЛАНС ПУСТ**\n\n"
            "Для запуска нового расследования требуется 1 монета.\n"
            "Пополните баланс в профиле или пригласите друзей!",
            parse_mode="Markdown",
            reply_markup=main_menu
        )
        return

    targets = await db.get_user_targets(message.from_user.id)
    
    if targets:
        sent = await message.answer(
            _build_target_selection_text(),
            reply_markup=_build_target_selection_kb(targets),
            parse_mode="Markdown"
        )
        # Track this message so "back" can edit it
        await state.update_data(target_select_msg_id=sent.message_id)
    else:
        sent = await message.answer(
            "📁 **Новое расследование**\n\n"
            "🎯 **Шаг 1:** Кто наша цель?\n"
            "Отправьте юзернейм (@ivan) или номер телефона (+7...):",
            reply_markup=ReplyKeyboardRemove(),
            parse_mode="Markdown"
        )
        await state.update_data(target_select_msg_id=sent.message_id)
        await state.set_state(OrderGift.waiting_for_target)


@router.callback_query(F.data.startswith("pick_target_"))
async def pick_saved_target(callback: CallbackQuery, state: FSMContext):
    target_id = int(callback.data.split("_")[2])
    target = await db.get_target_by_id(target_id)
    
    if not target:
        await callback.message.answer("❌ Цель не найдена.")
        await callback.answer()
        return
    
    t_id, owner_id, identifier, name, habits, birthday, photo = target
    
    await state.update_data(target=identifier)
    if habits:
        await state.update_data(saved_context=habits)
    
    # Edit the target selection message into the wizard (holiday step)
    data = await state.get_data()
    # Use the target selection message as the wizard message
    await state.update_data(wizard_msg_id=callback.message.message_id, wizard_msg_type='text')
    data = await state.get_data()
    await _render_wizard_step('holiday', data, callback.from_user.id,
                               callback_msg=callback.message, state=state)
    await state.set_state(OrderGift.waiting_for_holiday)
    await callback.answer()


@router.callback_query(F.data == "manual_target")
async def manual_target_entry(callback: CallbackQuery, state: FSMContext):
    await callback.message.edit_text(
        "📝 Введите юзернейм (@ivan) или номер телефона (+7...):",
    )
    # Keep wizard_msg_id pointing to this message
    await state.update_data(wizard_msg_id=callback.message.message_id, wizard_msg_type='text')
    await state.set_state(OrderGift.waiting_for_target)
    await callback.answer()


@router.message(StateFilter(OrderGift.waiting_for_target))
async def process_target(message: Message, state: FSMContext):
    if message.contact:
        phone = message.contact.phone_number
        if not phone.startswith('+'):
            phone = f'+{phone}'
        target = phone
        contact_name = ' '.join(filter(None, [message.contact.first_name, message.contact.last_name]))
        if contact_name:
            await state.update_data(contact_display_name=contact_name)
    elif message.text:
        target = message.text.strip()
    else:
        await message.answer("❌ Отправьте юзернейм (@username), номер телефона или прикрепите контакт.")
        return

    case_info = await db.check_target_status(target)

    if case_info:
        status, report = case_info
        if status in ['pending', 'started', 'in_progress', 'manual_mode']:
            await message.answer(
                "🛑 **ОПЕРАЦИЯ ОТКЛОНЕНА**\n\n"
                f"Прямо сейчас другой клиент уже заказал расследование на {target}.\n"
                "Наш детектив уже работает с этой целью. Возвращайтесь через пару дней!",
                parse_mode="Markdown",
                reply_markup=main_menu
            )
            await state.clear()
            return

    await state.update_data(target=target)
    
    saved_target = await db.find_target_by_identifier(message.from_user.id, target)
    if saved_target and saved_target[3]:
        await state.update_data(saved_context=saved_target[3])
    
    # Delete user's message
    try:
        await message.delete()
    except Exception:
        pass
    
    # If editing from confirm screen, return to confirm
    data = await state.get_data()
    if data.get('editing_field'):
        await state.update_data(editing_field=None)
        data = await state.get_data()
        await _render_wizard_step('confirm', data, message.from_user.id,
                                   message=message, state=state)
        await state.set_state(OrderGift.waiting_for_confirmation)
        return
    
    # Normal wizard flow — update the existing message to holiday step
    data = await state.get_data()
    await _render_wizard_step('holiday', data, message.from_user.id,
                               message=message, state=state)
    await state.set_state(OrderGift.waiting_for_holiday)


# ================= ШАГ 2: ПОВОД (wizard inline) =================

@router.callback_query(F.data.startswith("wz_holiday_"))
async def wz_select_holiday(callback: CallbackQuery, state: FSMContext):
    holiday = callback.data.replace("wz_holiday_", "")
    await state.update_data(holiday=holiday)
    data = await state.get_data()
    await _next_step_or_confirm(state, data, callback.from_user.id,
                                 callback_msg=callback.message, current_step='holiday')
    await callback.answer()


@router.callback_query(F.data == "wz_skip_holiday")
async def wz_skip_holiday(callback: CallbackQuery, state: FSMContext):
    await state.update_data(holiday="Без повода")
    data = await state.get_data()
    await _next_step_or_confirm(state, data, callback.from_user.id,
                                 callback_msg=callback.message, current_step='holiday')
    await callback.answer()


@router.message(StateFilter(OrderGift.waiting_for_holiday))
async def wz_holiday_text(message: Message, state: FSMContext):
    await state.update_data(holiday=message.text)
    try:
        await message.delete()
    except Exception:
        pass
    data = await state.get_data()
    await _next_step_or_confirm(state, data, message.from_user.id,
                                 message=message, current_step='holiday')


# ================= ШАГ 3: ЗАЦЕПКИ =================

@router.callback_query(F.data == "wz_use_saved_context")
async def wz_use_saved_context(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.update_data(context=data.get('saved_context', 'Нет данных'))
    data = await state.get_data()
    await _next_step_or_confirm(state, data, callback.from_user.id,
                                 callback_msg=callback.message, current_step='context')
    await callback.answer()


@router.callback_query(F.data == "wz_skip_context")
async def wz_skip_context(callback: CallbackQuery, state: FSMContext):
    await state.update_data(context="Нет данных")
    data = await state.get_data()
    await _next_step_or_confirm(state, data, callback.from_user.id,
                                 callback_msg=callback.message, current_step='context')
    await callback.answer()


@router.message(StateFilter(OrderGift.waiting_for_context))
async def wz_context_text(message: Message, state: FSMContext):
    await state.update_data(context=message.text)
    try:
        await message.delete()
    except Exception:
        pass
    data = await state.get_data()
    await _next_step_or_confirm(state, data, message.from_user.id,
                                 message=message, current_step='context')


# ================= ШАГ 4: ДЕТЕКТИВ (photo carousel) =================

@router.callback_query(F.data.startswith("wz_persona_page_"))
async def wz_persona_page(callback: CallbackQuery, state: FSMContext):
    index = int(callback.data.split("_")[3])
    data = await state.get_data()
    await _render_wizard_step('persona', data, callback.from_user.id,
                               callback_msg=callback.message, state=state,
                               persona_index=index)
    await callback.answer()


@router.callback_query(F.data.startswith("wz_persona_select_"))
async def wz_persona_select(callback: CallbackQuery, state: FSMContext):
    index = int(callback.data.split("_")[3])
    selected = PERSONAS[index]['name']
    await state.update_data(persona=selected)
    data = await state.get_data()
    await _next_step_or_confirm(state, data, callback.from_user.id,
                                 callback_msg=callback.message, current_step='persona')
    await callback.answer()


# ================= ШАГ 5: БЮДЖЕТ =================

@router.callback_query(F.data.startswith("wz_budget_"))
async def wz_select_budget(callback: CallbackQuery, state: FSMContext):
    budget = callback.data.replace("wz_budget_", "")
    await state.update_data(budget=budget)
    data = await state.get_data()
    await _next_step_or_confirm(state, data, callback.from_user.id,
                                 callback_msg=callback.message, current_step='budget')
    await callback.answer()


@router.callback_query(F.data == "wz_skip_budget")
async def wz_skip_budget(callback: CallbackQuery, state: FSMContext):
    await state.update_data(budget="Не указан")
    data = await state.get_data()
    await _next_step_or_confirm(state, data, callback.from_user.id,
                                 callback_msg=callback.message, current_step='budget')
    await callback.answer()


@router.message(StateFilter(OrderGift.waiting_for_budget))
async def wz_budget_text(message: Message, state: FSMContext):
    await state.update_data(budget=message.text)
    try:
        await message.delete()
    except Exception:
        pass
    data = await state.get_data()
    await _next_step_or_confirm(state, data, message.from_user.id,
                                 message=message, current_step='budget')


# ================= ШАГ 6: ПОДТВЕРЖДЕНИЕ =================

@router.callback_query(F.data == "wz_confirm")
async def wz_confirm(callback: CallbackQuery, state: FSMContext):
    user_data = await state.get_data()
    target = user_data['target']
    holiday = user_data.get('holiday', 'Без повода')
    context = user_data.get('context', 'Нет данных')
    persona = user_data['persona']
    budget = user_data.get('budget', 'Не указан')
    customer_id = callback.from_user.id

    balance = await db.get_user_balance(customer_id)
    if balance <= 0:
        await callback.message.edit_text("❌ Ошибка: недостаточно средств для начала дела.")
        await callback.answer()
        return

    await db.deduct_balance(customer_id)
    await db.add_case(customer_id, target, holiday, context, persona, budget)
    
    contact_name = user_data.get('contact_display_name')
    if contact_name:
        existing = await db.find_target_by_identifier(customer_id, target)
        if not existing:
            await db.add_target(customer_id, target, name=contact_name)
    
    display_name = await resolve_target_display_name(customer_id, target)

    dossier_text = (
        "✅ **ДЕЛО УСПЕШНО ПЕРЕДАНО В РАБОТУ**\n"
        "━━━━━━━━━━━━━━━━━━\n"
        f"🎯 **Цель:** {display_name}\n"
        f"🎉 **Повод:** {holiday}\n"
        f"🕵️‍♂️ **Детектив:** {persona}\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "⏳ Ожидайте уведомлений. Я напишу вам, как только начнется допрос!"
    )

    # Edit the wizard message to show confirmation
    wizard_msg_id = user_data.get('wizard_msg_id')
    wizard_msg_type = user_data.get('wizard_msg_type', 'text')
    
    try:
        if wizard_msg_type == 'text' and wizard_msg_id:
            await callback.bot.edit_message_text(
                chat_id=callback.message.chat.id,
                message_id=wizard_msg_id,
                text=dossier_text,
                parse_mode="Markdown"
            )
        elif wizard_msg_type == 'photo' and wizard_msg_id:
            await callback.bot.delete_message(
                chat_id=callback.message.chat.id,
                message_id=wizard_msg_id
            )
            await callback.message.answer(dossier_text, parse_mode="Markdown")
        else:
            await callback.message.edit_text(dossier_text, parse_mode="Markdown")
    except Exception:
        await callback.message.answer(dossier_text, parse_mode="Markdown")
    
    await callback.message.answer("✨", reply_markup=main_menu)
    await state.clear()
    await callback.answer("Дело передано!")


# ================= НАВИГАЦИЯ НАЗАД =================

@router.callback_query(F.data == "wz_back_target")
async def wz_back_target(callback: CallbackQuery, state: FSMContext):
    """Back to target selection — edit wizard message into target list."""
    customer_id = callback.from_user.id
    targets = await db.get_user_targets(customer_id)
    data = await state.get_data()
    wizard_msg_id = data.get('wizard_msg_id')
    
    if targets:
        text = _build_target_selection_text()
        kb = _build_target_selection_kb(targets)
        
        if wizard_msg_id and data.get('wizard_msg_type') == 'text':
            try:
                await callback.bot.edit_message_text(
                    chat_id=callback.message.chat.id,
                    message_id=wizard_msg_id,
                    text=text, parse_mode="Markdown", reply_markup=kb
                )
                await callback.answer()
                return
            except Exception:
                pass
        
        # Fallback: delete old wizard msg and send new
        if wizard_msg_id:
            try:
                await callback.bot.delete_message(chat_id=callback.message.chat.id, message_id=wizard_msg_id)
            except Exception:
                pass
        
        sent = await callback.message.answer(text, reply_markup=kb, parse_mode="Markdown")
        await state.update_data(wizard_msg_id=sent.message_id, wizard_msg_type='text',
                                 target_select_msg_id=sent.message_id)
    else:
        text = (
            "📁 **Новое расследование**\n\n"
            "🎯 **Шаг 1:** Кто наша цель?\n"
            "Отправьте юзернейм (@ivan) или номер телефона (+7...):"
        )
        if wizard_msg_id and data.get('wizard_msg_type') == 'text':
            try:
                await callback.bot.edit_message_text(
                    chat_id=callback.message.chat.id,
                    message_id=wizard_msg_id,
                    text=text, parse_mode="Markdown"
                )
                await state.set_state(OrderGift.waiting_for_target)
                await callback.answer()
                return
            except Exception:
                pass
        
        if wizard_msg_id:
            try:
                await callback.bot.delete_message(chat_id=callback.message.chat.id, message_id=wizard_msg_id)
            except Exception:
                pass
        sent = await callback.message.answer(text, reply_markup=ReplyKeyboardRemove(), parse_mode="Markdown")
        await state.update_data(wizard_msg_id=sent.message_id, wizard_msg_type='text')
        await state.set_state(OrderGift.waiting_for_target)
    await callback.answer()


@router.callback_query(F.data == "wz_back_holiday")
async def wz_back_holiday(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await _render_wizard_step('holiday', data, callback.from_user.id,
                               callback_msg=callback.message, state=state)
    await state.set_state(OrderGift.waiting_for_holiday)
    await callback.answer()


@router.callback_query(F.data == "wz_back_context")
async def wz_back_context(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await _render_wizard_step('context', data, callback.from_user.id,
                               callback_msg=callback.message, state=state)
    await state.set_state(OrderGift.waiting_for_context)
    await callback.answer()


@router.callback_query(F.data == "wz_back_persona")
async def wz_back_persona(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    persona_index = data.get('wizard_persona_idx', 0)
    await _render_wizard_step('persona', data, callback.from_user.id,
                               callback_msg=callback.message, state=state,
                               persona_index=persona_index)
    await state.set_state(OrderGift.waiting_for_persona)
    await callback.answer()


@router.callback_query(F.data == "wz_back_budget")
async def wz_back_budget(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await _render_wizard_step('budget', data, callback.from_user.id,
                               callback_msg=callback.message, state=state)
    await state.set_state(OrderGift.waiting_for_budget)
    await callback.answer()


@router.callback_query(F.data == "wz_back_to_confirm")
async def wz_back_to_confirm(callback: CallbackQuery, state: FSMContext):
    """Return to confirm from edit mode without changes."""
    await state.update_data(editing_field=None)
    data = await state.get_data()
    await _render_wizard_step('confirm', data, callback.from_user.id,
                               callback_msg=callback.message, state=state)
    await state.set_state(OrderGift.waiting_for_confirmation)
    await callback.answer()


# ================= РЕДАКТИРОВАНИЕ С ПОДТВЕРЖДЕНИЯ =================

@router.callback_query(F.data == "wz_edit_target")
async def wz_edit_target(callback: CallbackQuery, state: FSMContext):
    await state.update_data(editing_field='target')
    data = await state.get_data()
    wizard_msg_id = data.get('wizard_msg_id')
    
    # Edit the wizard message to prompt for new target
    try:
        await callback.bot.edit_message_text(
            chat_id=callback.message.chat.id,
            message_id=wizard_msg_id,
            text="📝 Введите нового получателя (юзернейм или телефон):\n\n"
                 "_Или нажмите назад, чтобы вернуться._",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="◀️ К подтверждению", callback_data="wz_back_to_confirm")]
            ])
        )
    except Exception:
        await callback.message.answer("📝 Введите нового получателя:")
    
    await state.set_state(OrderGift.waiting_for_target)
    await callback.answer()


@router.callback_query(F.data == "wz_edit_holiday")
async def wz_edit_holiday(callback: CallbackQuery, state: FSMContext):
    await state.update_data(editing_field='holiday')
    data = await state.get_data()
    await _render_wizard_step('holiday', data, callback.from_user.id,
                               callback_msg=callback.message, state=state)
    await state.set_state(OrderGift.waiting_for_holiday)
    await callback.answer()


@router.callback_query(F.data == "wz_edit_context")
async def wz_edit_context(callback: CallbackQuery, state: FSMContext):
    await state.update_data(editing_field='context')
    data = await state.get_data()
    await _render_wizard_step('context', data, callback.from_user.id,
                               callback_msg=callback.message, state=state)
    await state.set_state(OrderGift.waiting_for_context)
    await callback.answer()


@router.callback_query(F.data == "wz_edit_persona")
async def wz_edit_persona(callback: CallbackQuery, state: FSMContext):
    await state.update_data(editing_field='persona')
    data = await state.get_data()
    persona_index = data.get('wizard_persona_idx', 0)
    await _render_wizard_step('persona', data, callback.from_user.id,
                               callback_msg=callback.message, state=state,
                               persona_index=persona_index)
    await state.set_state(OrderGift.waiting_for_persona)
    await callback.answer()


@router.callback_query(F.data == "wz_edit_budget")
async def wz_edit_budget(callback: CallbackQuery, state: FSMContext):
    await state.update_data(editing_field='budget')
    data = await state.get_data()
    await _render_wizard_step('budget', data, callback.from_user.id,
                               callback_msg=callback.message, state=state)
    await state.set_state(OrderGift.waiting_for_budget)
    await callback.answer()
