from aiogram import Router, F
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from bot.keyboards.common import main_menu, skip_kb, get_target_actions_kb
from bot.states.order import TargetStates
from database import db

router = Router()


# ================= СПИСОК ЦЕЛЕЙ =================

@router.message(F.text == "👥 Мои цели")
async def show_targets_list(message: Message):
    targets = await db.get_user_targets(message.from_user.id)
    text, kb = _build_targets_list(targets)
    await message.answer(text, reply_markup=kb, parse_mode="Markdown")


@router.callback_query(F.data == "targets_list")
async def show_targets_list_callback(callback: CallbackQuery):
    targets = await db.get_user_targets(callback.from_user.id)
    text, kb = _build_targets_list(targets)
    try:
        await callback.message.edit_text(text, reply_markup=kb, parse_mode="Markdown")
    except Exception:
        await callback.message.answer(text, reply_markup=kb, parse_mode="Markdown")
    await callback.answer()


def _build_targets_list(targets):
    if not targets:
        kb = InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text="➕ Добавить цель", callback_data="add_target")]]
        )
        return "👥 У вас пока нет целей.\nСоздайте профиль, чтобы хранить предпочтения и вишлист.", kb
    
    keyboard_builder = []
    for t in targets:
        t_id, identifier, name, habits, birthday, photo = t
        display = name or identifier
        bday_icon = "🎂" if birthday else ""
        keyboard_builder.append([InlineKeyboardButton(
            text=f"👤 {display} {bday_icon}",
            callback_data=f"target_view_{t_id}"
        )])
    
    keyboard_builder.append([InlineKeyboardButton(text="➕ Добавить цель", callback_data="add_target")])
    return f"👥 **Мои цели** ({len(targets)}):", InlineKeyboardMarkup(inline_keyboard=keyboard_builder)


# ================= ПРОСМОТР ЦЕЛИ =================

@router.callback_query(F.data.startswith("target_view_"))
async def view_target(callback: CallbackQuery):
    target_id = int(callback.data.split("_")[2])
    target = await db.get_target_by_id(target_id)
    
    if not target:
        await callback.answer("Цель не найдена")
        return
    
    t_id, owner_id, identifier, name, habits, birthday, photo = target
    display_name = name or identifier
    
    parts = [f"👤 **{display_name}**", f"📱 {identifier}"]
    if birthday:
        parts.append(f"🎂 {birthday}")
    if habits:
        parts.append(f"🎯 {habits}")
    
    # Вишлист с группировкой по расследованию
    wishlist = await db.get_wishlist_grouped(target_id)
    if wishlist:
        parts.append(f"\n🎁 **Вишлист ({len(wishlist)}):**")
        groups = {}
        for item in wishlist:
            item_id, desc, added_by, created, cat, case_id_val, holiday, case_date = item
            if case_id_val and holiday:
                date_str = case_date[:10] if case_date else ""
                key = f"🎉 {holiday}" + (f" ({date_str})" if date_str else "")
            else:
                key = "✍️ Добавлено вручную"
            if key not in groups:
                groups[key] = []
            source = "🤖" if added_by == 'ai' else "✍️"
            groups[key].append(f"  {source} {desc}")
        
        for grp, items in groups.items():
            parts.append(f"\n📂 _{grp}_:")
            for it in items[:3]:
                parts.append(it)
            if len(items) > 3:
                parts.append(f"  _...и ещё {len(items) - 3}_")
    else:
        parts.append("\n📝 _Вишлист пуст_")
    
    msg = "\n".join(parts)
    
    # Расширенная клавиатура с кнопкой удаления
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔍 Отправить детектива", callback_data=f"target_investigate_{target_id}")],
            [InlineKeyboardButton(text="📋 Полный вишлист", callback_data=f"target_wishlist_{target_id}")],
            [InlineKeyboardButton(text="✏️ Редактировать", callback_data=f"target_edit_{target_id}"),
             InlineKeyboardButton(text="🗑 Удалить", callback_data=f"target_delete_confirm_{target_id}")],
            [InlineKeyboardButton(text="⬅️ К списку", callback_data="targets_list")]
        ]
    )
    
    try:
        await callback.message.edit_text(msg, reply_markup=kb, parse_mode="Markdown")
    except Exception:
        await callback.message.answer(msg, reply_markup=kb, parse_mode="Markdown")
    await callback.answer()


# ================= УДАЛЕНИЕ ЦЕЛИ =================

@router.callback_query(F.data.startswith("target_delete_confirm_"))
async def confirm_delete_target(callback: CallbackQuery):
    target_id = int(callback.data.split("_")[3])
    target = await db.get_target_by_id(target_id)
    if not target:
        await callback.answer("Цель не найдена")
        return
    
    display_name = target[3] or target[2]
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="❌ Да, удалить", callback_data=f"target_delete_{target_id}"),
             InlineKeyboardButton(text="⬅️ Отмена", callback_data=f"target_view_{target_id}")]
        ]
    )
    await callback.message.edit_text(
        f"⚠️ Вы уверены, что хотите удалить **{display_name}**?\n\n"
        "Вместе с профилем будет удалён весь вишлист.",
        reply_markup=kb, parse_mode="Markdown"
    )
    await callback.answer()


@router.callback_query(F.data.startswith("target_delete_") & ~F.data.startswith("target_delete_confirm_"))
async def delete_target(callback: CallbackQuery):
    target_id = int(callback.data.split("_")[2])
    await db.delete_target(target_id)
    
    # Возвращаемся к списку
    targets = await db.get_user_targets(callback.from_user.id)
    text, kb = _build_targets_list(targets)
    await callback.message.edit_text(f"✅ Цель удалена.\n\n{text}", reply_markup=kb, parse_mode="Markdown")
    await callback.answer("Удалено")


# ================= ВИШЛИСТ ЦЕЛИ =================

@router.callback_query(F.data.startswith("target_wishlist_"))
async def show_wishlist(callback: CallbackQuery):
    target_id = int(callback.data.split("_")[2])
    target = await db.get_target_by_id(target_id)
    
    if not target:
        await callback.answer("Цель не найдена")
        return
    
    display_name = target[3] or target[2]
    wishlist = await db.get_wishlist_grouped(target_id)
    
    if not wishlist:
        kb = InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text="⬅️ Назад", callback_data=f"target_view_{target_id}")]]
        )
        await callback.message.edit_text(
            f"📝 Вишлист **{display_name}** пуст.\n\n"
            "Идеи появятся после расследования или добавления вручную.",
            reply_markup=kb, parse_mode="Markdown"
        )
        await callback.answer()
        return
    
    # Группировка по расследованиям
    groups = {}
    for item in wishlist:
        item_id, desc, added_by, created, cat, case_id_val, holiday, case_date = item
        if case_id_val and holiday:
            date_str = case_date[:10] if case_date else ""
            key = f"🎉 {holiday}" + (f" ({date_str})" if date_str else "")
        else:
            key = "✍️ Добавлено вручную"
        if key not in groups:
            groups[key] = []
        source = "🕵️‍♂️ Детектив" if added_by == 'ai' else "✍️ Вы"
        cat_text = f" _[{cat}]_" if cat and cat != 'Другое' else ""
        groups[key].append((item_id, f"• {desc}{cat_text} {source}"))
    
    parts = [f"🎁 **Вишлист: {display_name}** ({len(wishlist)} идей)"]
    
    for grp, items in groups.items():
        parts.append(f"\n📂 **{grp}**:")
        for item_id, text in items:
            parts.append(f"  {text}")
    
    kb = InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="⬅️ Назад", callback_data=f"target_view_{target_id}")]]
    )
    
    text = "\n".join(parts)
    try:
        await callback.message.edit_text(text, reply_markup=kb, parse_mode="Markdown")
    except Exception:
        await callback.message.answer(text, reply_markup=kb, parse_mode="Markdown")
    await callback.answer()


# ================= ДОБАВЛЕНИЕ ЦЕЛИ =================

@router.callback_query(F.data == "add_target")
async def start_add_target(callback: CallbackQuery, state: FSMContext):
    await callback.message.edit_text(
        "👤 **Создание профиля цели**\n\n"
        "Шаг 1: Отправьте юзернейм (@ivan) или телефон (+7...).",
        parse_mode="Markdown"
    )
    await state.set_state(TargetStates.waiting_for_identifier)
    await callback.answer()


@router.message(TargetStates.waiting_for_identifier)
async def process_target_identifier(message: Message, state: FSMContext):
    identifier = message.text.strip()
    existing = await db.find_target_by_identifier(message.from_user.id, identifier)
    if existing:
        await message.answer(f"⚠️ **{identifier}** уже в вашем списке!", parse_mode="Markdown", reply_markup=main_menu)
        await state.clear()
        return
    
    await state.update_data(target_identifier=identifier)
    await message.answer("✅ Шаг 2: Как зовут?", reply_markup=skip_kb)
    await state.set_state(TargetStates.waiting_for_name)


@router.message(TargetStates.waiting_for_name)
async def process_target_name(message: Message, state: FSMContext):
    name = message.text.strip() if message.text != "⏩ Пропустить" else None
    data = await state.get_data()
    
    if not name:
        try:
            from main import client
            from services.scheduler import resolve_target
            entity = await resolve_target(client, data['target_identifier'])
            if entity:
                first = getattr(entity, 'first_name', '') or ''
                last = getattr(entity, 'last_name', '') or ''
                fetched_name = f"{first} {last}".strip()
                if fetched_name:
                    name = fetched_name
        except Exception:
            pass

    await state.update_data(target_name=name)
    await message.answer("📝 Шаг 3: Привычки/увлечения?", reply_markup=skip_kb)
    await state.set_state(TargetStates.waiting_for_habits)


@router.message(TargetStates.waiting_for_habits)
async def process_target_habits(message: Message, state: FSMContext):
    habits = message.text.strip() if message.text != "⏩ Пропустить" else None
    await state.update_data(target_habits=habits)
    await message.answer("🎂 Шаг 4: День рождения? (ДД.ММ.ГГГГ)", reply_markup=skip_kb)
    await state.set_state(TargetStates.waiting_for_birthday)


@router.message(TargetStates.waiting_for_birthday)
async def process_target_birthday(message: Message, state: FSMContext):
    birthday = message.text.strip() if message.text != "⏩ Пропустить" else None
    await state.update_data(target_birthday=birthday)
    await message.answer("📸 Шаг 5: Фото? (Отправьте или пропустите)", reply_markup=skip_kb)
    await state.set_state(TargetStates.waiting_for_photo)


@router.message(TargetStates.waiting_for_photo)
async def process_target_photo(message: Message, state: FSMContext):
    photo_file_id = None
    if message.photo:
        photo_file_id = message.photo[-1].file_id
    elif message.text == "⏩ Пропустить":
        pass
    else:
        await message.answer("📸 Отправьте фото или нажмите «Пропустить».", reply_markup=skip_kb)
        return
    
    data = await state.get_data()
    
    photo_url = None
    if photo_file_id:
        try:
            import logging
            file_info = await message.bot.get_file(photo_file_id)
            downloaded = await message.bot.download_file(file_info.file_path)
            photo_url = await db.upload_target_photo(data['target_identifier'], downloaded.read())
        except Exception as e:
            import logging
            logging.error(f"Error uploading target photo: {e}")
            pass
            
    target_id = await db.add_target(
        owner_id=message.from_user.id,
        identifier=data['target_identifier'],
        name=data.get('target_name'),
        habits=data.get('target_habits'),
        birthday=data.get('target_birthday'),
        photo_file_id=photo_url
    )
    
    display = data.get('target_name') or data['target_identifier']
    await state.clear()
    await message.answer(
        f"✅ Профиль **{display}** создан!\n📱 {data['target_identifier']}",
        parse_mode="Markdown", reply_markup=main_menu
    )


# ================= ДЕТЕКТИВ ИЗ ПРОФИЛЯ =================

@router.callback_query(F.data.startswith("target_investigate_"))
async def investigate_from_target(callback: CallbackQuery, state: FSMContext):
    target_id = int(callback.data.split("_")[2])
    target = await db.get_target_by_id(target_id)
    if not target:
        await callback.answer("Цель не найдена")
        return
    
    t_id, owner_id, identifier, name, habits, birthday, photo = target
    await state.update_data(target=identifier)
    if habits:
        await state.update_data(saved_context=habits)
    
    from bot.handlers.investigation import _render_wizard_step
    from bot.states.order import OrderGift
    
    data = await state.get_data()
    await _render_wizard_step('holiday', data, callback.from_user.id,
                               callback_msg=callback.message, state=state)
    await state.set_state(OrderGift.waiting_for_holiday)
    await callback.answer()


# ================= РЕДАКТИРОВАНИЕ =================

@router.callback_query(F.data.startswith("target_edit_"))
async def edit_target(callback: CallbackQuery):
    target_id = int(callback.data.split("_")[2])
    target = await db.get_target_by_id(target_id)
    if not target:
        await callback.answer("Цель не найдена")
        return
    
    display_name = target[3] or target[2]
    keyboard_layout = [
        [InlineKeyboardButton(text="✏️ Имя", callback_data=f"tedit_name_{target_id}"),
         InlineKeyboardButton(text="🎯 Привычки", callback_data=f"tedit_habits_{target_id}")],
        [InlineKeyboardButton(text="🎂 ДР", callback_data=f"tedit_birthday_{target_id}")]
    ]
    if not target[6]:  # no photo_file_id
        keyboard_layout.append([InlineKeyboardButton(text="📸 Добавить фото", callback_data=f"tedit_photo_{target_id}")])
    keyboard_layout.append([InlineKeyboardButton(text="⬅️ Назад", callback_data=f"target_view_{target_id}")])
    
    kb = InlineKeyboardMarkup(inline_keyboard=keyboard_layout)
    await callback.message.edit_text(
        f"✏️ Изменить в профиле **{display_name}**?",
        reply_markup=kb, parse_mode="Markdown"
    )
    await callback.answer()


@router.callback_query(F.data.startswith("tedit_"))
async def start_tedit(callback: CallbackQuery, state: FSMContext):
    parts = callback.data.split("_")
    field = parts[1]
    target_id = int(parts[2])
    
    await state.update_data(tedit_target_id=target_id, tedit_field=field)
    
    prompts = {
        "name": "✏️ Введите новое имя:",
        "habits": "🎯 Введите новые привычки/увлечения:",
        "birthday": "🎂 Введите новый день рождения (ДД.ММ.ГГГГ):",
        "photo": "📸 Отправьте фото (именно как фото, не документом):"
    }
    await callback.message.edit_text(prompts[field])
    await state.set_state(TargetStates.waiting_for_edit_value)
    await callback.answer()

@router.message(TargetStates.waiting_for_edit_value)
async def process_tedit_value(message: Message, state: FSMContext):
    data = await state.get_data()
    target_id = data.get("tedit_target_id")
    field = data.get("tedit_field")
    
    if field == "photo":
        if not message.photo:
            await message.answer("📸 Пожалуйста, отправьте фото.")
            return
            
        photo_file_id = message.photo[-1].file_id
        try:
            target = await db.get_target_by_id(target_id)
            if not target:
                await state.clear()
                return
            identifier = target[2]
            
            import logging
            file_info = await message.bot.get_file(photo_file_id)
            downloaded = await message.bot.download_file(file_info.file_path)
            photo_url = await db.upload_target_photo(identifier, downloaded.read())
            
            await db.update_target(target_id, photo_file_id=photo_url)
            await message.answer("✅ Фото профиля обновлено", reply_markup=main_menu)
        except Exception as e:
            import logging
            logging.error(f"Error updating target photo: {e}")
            await message.answer("❌ Ошибка при загрузке фото.")
        
        await state.clear()
        return

    value = message.text.strip() if message.text else ""
    
    if field == "name":
        await db.update_target(target_id, name=value)
        await message.answer(f"✅ Имя обновлено на **{value}**", parse_mode="Markdown", reply_markup=main_menu)
    elif field == "habits":
        await db.update_target(target_id, habits=value)
        await message.answer("✅ Привычки/увлечения обновлены", reply_markup=main_menu)
    elif field == "birthday":
        await db.update_target(target_id, birthday=value)
        await message.answer(f"✅ День рождения обновлен на **{value}**", parse_mode="Markdown", reply_markup=main_menu)
    
    await state.clear()
