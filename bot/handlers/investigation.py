from aiogram import Router, F
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, CallbackQuery, InputMediaPhoto, ReplyKeyboardRemove, ReplyKeyboardMarkup, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import StateFilter

from bot.states.order import OrderGift
from bot.keyboards.common import PERSONAS, get_persona_keyboard, holiday_kb, skip_kb, main_menu, get_confirm_kb, get_edit_details_kb, resolve_target_display_name
from database import db

router = Router()


# ================= ШАГ 1: ВЫБОР ЦЕЛИ =================

@router.message(F.text == "🔍 Начать новое дело")
async def start_order(message: Message, state: FSMContext):
    # Fix #4: Сбрасываем любое предыдущее состояние FSM
    await state.clear()
    
    # Проверка баланса
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

    # Проверяем, есть ли сохранённые цели
    targets = await db.get_user_targets(message.from_user.id)
    
    if targets:
        # Предлагаем выбрать из списка или ввести вручную
        keyboard_builder = []
        for t in targets:
            t_id, identifier, name, habits, birthday, photo = t
            display = name or identifier
            btn = InlineKeyboardButton(
                text=f"👤 {display}",
                callback_data=f"pick_target_{t_id}"
            )
            keyboard_builder.append([btn])
        
        keyboard_builder.append([InlineKeyboardButton(text="✏️ Ввести вручную", callback_data="manual_target")])
        
        inline_kb = InlineKeyboardMarkup(inline_keyboard=keyboard_builder)
        
        await message.answer(
            "📁 Заводим новое дело.\n\n"
            "🎯 **Шаг 1:** Выберите цель из сохранённых или введите вручную:",
            reply_markup=inline_kb,
            parse_mode="Markdown"
        )
    else:
        await message.answer(
            "📁 Отлично, заводим новое дело.\n\n"
            "Шаг 1: Кто наша цель? Отправьте юзернейм (например, @ivan) "
            "или номер телефона в формате +7xxxxxxxxxx...",
            reply_markup=ReplyKeyboardRemove()
        )
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
    
    display_name = name or identifier
    
    await callback.message.answer(
        f"✅ Цель: **{display_name}** ({identifier})\n\n"
        "🎉 **Шаг 2:** Какой у нас повод?\n"
        "Выберите праздник из меню или напишите свой вариант.",
        reply_markup=holiday_kb,
        parse_mode="Markdown"
    )
    await state.set_state(OrderGift.waiting_for_holiday)
    await callback.answer()


@router.callback_query(F.data == "manual_target")
async def manual_target_entry(callback: CallbackQuery, state: FSMContext):
    await callback.message.answer(
        "📝 Введите юзернейм (например, @ivan) "
        "или номер телефона в формате +7xxxxxxxxxx...",
        reply_markup=ReplyKeyboardRemove()
    )
    await state.set_state(OrderGift.waiting_for_target)
    await callback.answer()


@router.message(StateFilter(OrderGift.waiting_for_target))
async def process_target(message: Message, state: FSMContext):
    # Fix #5: Поддержка прикреплённого контакта
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
                f"Невероятное совпадение! Прямо сейчас другой клиент уже "
                f"заказал расследование на {target}.\n"
                "Наш детектив уже работает с этой целью. Возвращайтесь через пару дней!",
                parse_mode="Markdown",
                reply_markup=main_menu
            )
            await state.clear()
            return

    await state.update_data(target=target)
    
    # Проверяем, есть ли сохранённый профиль
    saved_target = await db.find_target_by_identifier(message.from_user.id, target)
    if saved_target and saved_target[3]:  # habits
        await state.update_data(saved_context=saved_target[3])
    
    await message.answer(
        "🎉 Отлично! **Шаг 2:** Какой у нас повод?\n\n"
        "Выберите праздник из меню ниже или напишите свой вариант.",
        reply_markup=holiday_kb,
        parse_mode="Markdown"
    )
    await state.set_state(OrderGift.waiting_for_holiday)


# ================= ШАГ 2: ПОВОД =================

@router.message(StateFilter(OrderGift.waiting_for_holiday))
async def process_holiday(message: Message, state: FSMContext):
    await state.update_data(holiday=message.text)
    
    data = await state.get_data()
    saved_context = data.get('saved_context')
    
    if saved_context:
        kb = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="✅ Использовать из профиля", callback_data="use_saved_context")],
                [InlineKeyboardButton(text="✏️ Ввести новые зацепки", callback_data="enter_new_context")]
            ]
        )
        await message.answer(
            f"📝 **Шаг 3:** У этой цели уже есть сохранённый профиль!\n\n"
            f"🎯 **Зацепки из профиля:**\n_{saved_context}_\n\n"
            f"Использовать эту информацию или ввести новую?",
            parse_mode="Markdown",
            reply_markup=kb
        )
    else:
        await message.answer(
            "📝 **Шаг 3:** Дайте детективу зацепки.\n\n"
            "Расскажите немного о человеке. Кем работает? Чем увлекается? "
            "(Например: *Работает дизайнером, любит кофе, обожает собак*).",
            parse_mode="Markdown",
            reply_markup=skip_kb
        )
        await state.set_state(OrderGift.waiting_for_context)


# ================= ШАГ 3: ЗАЦЕПКИ =================

@router.callback_query(F.data == "use_saved_context")
async def use_saved_context(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    saved_context = data.get('saved_context', 'Нет данных')
    await state.update_data(context=saved_context)
    
    current_index = 0
    persona = PERSONAS[current_index]
    caption = f"🕵️‍♂️ **Шаг 4: Выберите личность детектива**\n\n**{persona['name']}**\n{persona['desc']}"
    
    await callback.message.answer_photo(
        photo=persona['photo'],
        caption=caption,
        parse_mode="Markdown",
        reply_markup=get_persona_keyboard(current_index)
    )
    await state.set_state(OrderGift.waiting_for_persona)
    await callback.answer()


@router.callback_query(F.data == "enter_new_context")
async def enter_new_context(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    if 'saved_context' in data:
        del data['saved_context']
        await state.set_data(data)
    
    await callback.message.answer(
        "📝 Введите новые зацепки для детектива.\n\n"
        "Расскажите немного о человеке. Кем работает? Чем увлекается? "
        "(Например: *Работает дизайнером, любит кофе, обожает собак*).",
        parse_mode="Markdown",
        reply_markup=skip_kb
    )
    await state.set_state(OrderGift.waiting_for_context)
    await callback.answer()


@router.message(StateFilter(OrderGift.waiting_for_context))
async def process_context(message: Message, state: FSMContext):
    context_text = message.text if message.text != "⏩ Пропустить" else "Нет данных"
    await state.update_data(context=context_text)

    current_index = 0
    persona = PERSONAS[current_index]

    caption = f"🕵️‍♂️ **Шаг 4: Выберите личность детектива**\n\n**{persona['name']}**\n{persona['desc']}"

    await message.answer_photo(
        photo=persona['photo'],
        caption=caption,
        parse_mode="Markdown",
        reply_markup=get_persona_keyboard(current_index)
    )
    await state.set_state(OrderGift.waiting_for_persona)


# ================= ШАГ 4: ВЫБОР ДЕТЕКТИВА =================

@router.callback_query(F.data.startswith("persona_page_"), StateFilter(OrderGift.waiting_for_persona))
async def paginate_personas(callback: CallbackQuery):
    index = int(callback.data.split("_")[2])
    persona = PERSONAS[index]

    caption = f"🕵️‍♂️ **Шаг 4: Выберите личность детектива**\n\n**{persona['name']}**\n{persona['desc']}"

    media = InputMediaPhoto(media=persona['photo'], caption=caption, parse_mode="Markdown")
    await callback.message.edit_media(media=media, reply_markup=get_persona_keyboard(index))
    await callback.answer()


@router.callback_query(F.data.startswith("persona_select_"), StateFilter(OrderGift.waiting_for_persona))
async def select_persona(callback: CallbackQuery, state: FSMContext):
    index = int(callback.data.split("_")[2])
    selected_persona_name = PERSONAS[index]['name']

    await state.update_data(persona=selected_persona_name)
    await callback.message.delete()

    await callback.message.answer(
        f"✅ Детектив: **{selected_persona_name}**\n\n"
        "💵 **Шаг 5: Бюджет операции.**\n\n"
        "В каком бюджете мы ищем подарок? (Например: *до 5000 руб* или *неограничен*)",
        parse_mode="Markdown"
    )
    await state.set_state(OrderGift.waiting_for_budget)
    await callback.answer()


# ================= ШАГ 5: БЮДЖЕТ + ПОДТВЕРЖДЕНИЕ =================

@router.message(StateFilter(OrderGift.waiting_for_budget))
async def process_budget(message: Message, state: FSMContext):
    await state.update_data(budget=message.text)
    
    # Показываем сводку для подтверждения
    user_data = await state.get_data()
    target = user_data['target']
    holiday = user_data['holiday']
    context = user_data['context']
    persona = user_data['persona']
    budget = user_data['budget']
    customer_id = message.from_user.id
    
    display_name = await resolve_target_display_name(customer_id, target)

    summary_text = (
        "📋 **СВОДКА ЗАДАНИЯ**\n"
        "━━━━━━━━━━━━━━━━━━\n"
        f"🎯 **Цель:** {display_name}" + (f" ({target})" if display_name != target else "") + "\n"
        f"🎉 **Повод:** {holiday}\n"
        f"🕵️‍♂️ **Детектив:** {persona}\n"
        f"🧩 **Зацепки:** {context}\n"
        f"💵 **Бюджет:** {budget}\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "Всё верно? Подтвердите или измените детали."
    )

    await message.answer(summary_text, parse_mode="Markdown", reply_markup=ReplyKeyboardRemove())
    await message.answer("Подтвердите или измените:", reply_markup=get_confirm_kb())
    await state.set_state(OrderGift.waiting_for_confirmation)


@router.callback_query(F.data == "confirm_case")
async def confirm_case(callback: CallbackQuery, state: FSMContext):
    user_data = await state.get_data()
    target = user_data['target']
    holiday = user_data['holiday']
    context = user_data['context']
    persona = user_data['persona']
    budget = user_data['budget']
    customer_id = callback.from_user.id

    # Списываем баланс
    balance = await db.get_user_balance(customer_id)
    if balance <= 0:
        await callback.message.edit_text("❌ Ошибка: недостаточно средств для начала дела.")
        await callback.answer()
        return

    await db.deduct_balance(customer_id)
    await db.add_case(customer_id, target, holiday, context, persona, budget)
    
    # Fix #5: Если передан контакт, создаём/обновляем цель с именем контакта
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

    await callback.message.edit_text(dossier_text, parse_mode="Markdown")
    await callback.message.answer("✨", reply_markup=main_menu)
    await state.clear()
    await callback.answer("Дело передано!")


@router.callback_query(F.data == "edit_case_details")
async def edit_case_details(callback: CallbackQuery, state: FSMContext):
    await callback.message.edit_text(
        "✏️ **Что хотите изменить?**",
        parse_mode="Markdown",
        reply_markup=get_edit_details_kb()
    )
    await callback.answer()


@router.callback_query(F.data == "back_to_confirm")
async def back_to_confirm(callback: CallbackQuery, state: FSMContext):
    user_data = await state.get_data()
    target = user_data['target']
    holiday = user_data['holiday']
    context = user_data['context']
    persona = user_data['persona']
    budget = user_data['budget']
    customer_id = callback.from_user.id
    
    display_name = await resolve_target_display_name(customer_id, target)

    summary_text = (
        "📋 **СВОДКА ЗАДАНИЯ**\n"
        "━━━━━━━━━━━━━━━━━━\n"
        f"🎯 **Цель:** {display_name}" + (f" ({target})" if display_name != target else "") + "\n"
        f"🎉 **Повод:** {holiday}\n"
        f"🕵️‍♂️ **Детектив:** {persona}\n"
        f"🧩 **Зацепки:** {context}\n"
        f"💵 **Бюджет:** {budget}\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "Всё верно? Подтвердите или измените детали."
    )

    await callback.message.edit_text(summary_text, parse_mode="Markdown", reply_markup=get_confirm_kb())
    await state.set_state(OrderGift.waiting_for_confirmation)
    await callback.answer()


# ================= РЕДАКТИРОВАНИЕ ДЕТАЛЕЙ =================

@router.callback_query(F.data == "edit_detail_target")
async def edit_target(callback: CallbackQuery, state: FSMContext):
    await callback.message.answer(
        "📝 Введите нового получателя (юзернейм или телефон):",
        reply_markup=ReplyKeyboardRemove()
    )
    await state.set_state(OrderGift.waiting_for_target)
    await callback.answer()


@router.callback_query(F.data == "edit_detail_holiday")
async def edit_holiday(callback: CallbackQuery, state: FSMContext):
    await callback.message.answer(
        "🎉 Выберите новый повод:",
        reply_markup=holiday_kb
    )
    await state.set_state(OrderGift.waiting_for_holiday)
    await callback.answer()


@router.callback_query(F.data == "edit_detail_context")
async def edit_context(callback: CallbackQuery, state: FSMContext):
    await callback.message.answer(
        "📝 Введите новые зацепки:",
        reply_markup=skip_kb,
        parse_mode="Markdown"
    )
    await state.set_state(OrderGift.waiting_for_context)
    await callback.answer()


@router.callback_query(F.data == "edit_detail_persona")
async def edit_persona(callback: CallbackQuery, state: FSMContext):
    current_index = 0
    persona = PERSONAS[current_index]
    caption = f"🕵️‍♂️ **Выберите нового детектива**\n\n**{persona['name']}**\n{persona['desc']}"
    
    await callback.message.answer_photo(
        photo=persona['photo'],
        caption=caption,
        parse_mode="Markdown",
        reply_markup=get_persona_keyboard(current_index)
    )
    await state.set_state(OrderGift.waiting_for_persona)
    await callback.answer()


@router.callback_query(F.data == "edit_detail_budget")
async def edit_budget(callback: CallbackQuery, state: FSMContext):
    await callback.message.answer(
        "💵 Введите новый бюджет (например: *до 5000 руб* или *неограничен*):",
        parse_mode="Markdown"
    )
    await state.set_state(OrderGift.waiting_for_budget)
    await callback.answer()
