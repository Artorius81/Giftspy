from aiogram import Router, F
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, CallbackQuery
from bot.keyboards.common import profile_kb, get_settings_kb, main_menu
from bot.states.order import ProfileStates
from database import db

router = Router()

@router.message(F.text == "🏠 Мой профиль")
async def show_profile(message: Message):
    user_id = message.from_user.id
    balance, premium_until, successful_cases, active_cases, nickname, spy_mode, birthday, description, photo = await db.get_user_profile(user_id)
    display_name = nickname or message.from_user.first_name or "Агент"
    
    premium_text = ""
    if premium_until:
        from datetime import datetime
        if datetime.fromisoformat(premium_until) > datetime.utcnow():
            premium_text = "\n👑 **Статус:** Premium"
    
    parts = [
        f"🕵️‍♂️ **{display_name}**",
        f"ID: `{user_id}`{premium_text}",
        f"━━━━━━━━━━━━━",
        f"⭐️ Баланс: {balance} расследований",
        f"✅ Закрыто дел: {successful_cases}",
        f"🔵 В работе: {active_cases}",
    ]
    if birthday:
        parts.append(f"🎂 ДР: {birthday}")
    if description:
        parts.append(f"📝 О себе: {description}")
    
    text = "\n".join(parts)
    
    if photo and photo != "None":
        try:
            if photo.startswith("http"):
                from aiogram.types import URLInputFile
                photo_obj = URLInputFile(photo)
            else:
                photo_obj = photo
            await message.answer_photo(photo=photo_obj, caption=text, reply_markup=profile_kb, parse_mode="Markdown")
            return
        except Exception as e:
            import logging
            logging.warning(f"Failed to send profile photo: {e}")
            # Fallback to text
            pass

    await message.answer(text, reply_markup=profile_kb, parse_mode="Markdown")


# ================= ИЗМЕНИТЬ НИКНЕЙМ =================

@router.callback_query(F.data == "change_nickname")
async def ask_nickname(callback: CallbackQuery, state: FSMContext):
    try:
        await callback.message.edit_text("✏️ Введите новый никнейм (до 32 символов):")
    except Exception:
        await callback.message.delete()
        await callback.message.answer("✏️ Введите новый никнейм (до 32 символов):")
    await state.set_state(ProfileStates.waiting_for_nickname)
    await callback.answer()

@router.message(ProfileStates.waiting_for_nickname)
async def process_nickname(message: Message, state: FSMContext):
    nickname = message.text.strip()[:32]
    if not nickname:
        await message.answer("❌ Никнейм не может быть пустым.")
        return
    await db.update_user_nickname(message.from_user.id, nickname)
    await state.clear()
    await message.answer(f"✅ Никнейм: **{nickname}**", parse_mode="Markdown", reply_markup=main_menu)


# ================= ИЗМЕНИТЬ ДЕНЬ РОЖДЕНИЯ =================

@router.callback_query(F.data == "change_birthday")
async def ask_birthday(callback: CallbackQuery, state: FSMContext):
    try:
        await callback.message.edit_text("🎂 Введите ваш день рождения (ДД.ММ.ГГГГ):")
    except Exception:
        await callback.message.delete()
        await callback.message.answer("🎂 Введите ваш день рождения (ДД.ММ.ГГГГ):")
    await state.set_state(ProfileStates.waiting_for_birthday)
    await callback.answer()

@router.message(ProfileStates.waiting_for_birthday)
async def process_birthday(message: Message, state: FSMContext):
    text = message.text.strip()
    # Простая валидация формата
    try:
        from datetime import datetime
        datetime.strptime(text, "%d.%m.%Y")
    except ValueError:
        await message.answer("❌ Формат: **ДД.ММ.ГГГГ**", parse_mode="Markdown")
        return
    
    await db.update_user_field(message.from_user.id, 'birthday', text)
    await state.clear()
    await message.answer(f"✅ День рождения: **{text}**", parse_mode="Markdown", reply_markup=main_menu)


# ================= ИЗМЕНИТЬ ОПИСАНИЕ =================

@router.callback_query(F.data == "change_description")
async def ask_description(callback: CallbackQuery, state: FSMContext):
    text = ("📝 Расскажите о себе (до 200 символов):\n"
            "_Например: «Люблю путешествия и фотографию»_")
    try:
        await callback.message.edit_text(text, parse_mode="Markdown")
    except Exception:
        await callback.message.delete()
        await callback.message.answer(text, parse_mode="Markdown")
    await state.set_state(ProfileStates.waiting_for_description)
    await callback.answer()

@router.message(ProfileStates.waiting_for_description)
async def process_description(message: Message, state: FSMContext):
    desc = message.text.strip()[:200]
    if not desc:
        await message.answer("❌ Описание не может быть пустым.")
        return
    await db.update_user_field(message.from_user.id, 'description', desc)
    await state.clear()
    await message.answer(f"✅ О себе обновлено!", reply_markup=main_menu)


# ================= ИЗМЕНИТЬ ФОТО =================

@router.callback_query(F.data == "change_photo")
async def ask_photo(callback: CallbackQuery, state: FSMContext):
    try:
        await callback.message.edit_text("📸 Отправьте ваше фото:")
    except Exception:
        await callback.message.delete()
        await callback.message.answer("📸 Отправьте ваше фото:")
    await state.set_state(ProfileStates.waiting_for_photo)
    await callback.answer()

@router.message(ProfileStates.waiting_for_photo)
async def process_photo(message: Message, state: FSMContext):
    if not message.photo:
        await message.answer("📸 Пожалуйста, отправьте фотографию.")
        return
    
    # Send processing message
    processing_msg = await message.answer("⏳ Загрузка фото...")
    
    try:
        # Download photo
        photo_size = message.photo[-1]
        file_info = await message.bot.get_file(photo_size.file_id)
        # Using download to a memory buffer (BytesIO allows us to get bytes)
        import io
        file_stream = io.BytesIO()
        await message.bot.download_file(file_info.file_path, destination=file_stream)
        file_bytes = file_stream.getvalue()
        
        # Upload to Supabase
        photo_url = await db.upload_profile_photo(message.from_user.id, file_bytes)
        
        # Save URL to DB
        await db.update_user_field(message.from_user.id, 'photo_file_id', photo_url)
        
        await processing_msg.delete()
        await message.answer("✅ Фото обновлено!", reply_markup=main_menu)
        
        # Переход в Мой профиль
        await show_profile(message)
    except Exception as e:
        import logging
        logging.error(f"Error uploading photo: {e}")
        try:
            await processing_msg.delete()
        except:
            pass
        await message.answer("❌ Ошибка загрузки фото. Попробуйте позже.", reply_markup=main_menu)
        
    await state.clear()


# ================= НАСТРОЙКИ =================

@router.callback_query(F.data == "open_settings")
async def open_settings(callback: CallbackQuery):
    spy_mode = await db.get_user_spy_mode(callback.from_user.id)
    spy_status = "включен ✅" if spy_mode else "выключен ❌"
    text = (f"⚙️ **Настройки**\n━━━━━━━━━━━━━\n\n"
            f"🔍 Шпионский режим: {spy_status}\n"
            "_Видите диалог детектива в реальном времени._\n\n"
            "⚠️ _Премиум-функция. По умолчанию выключен._")
    try:
        await callback.message.edit_text(text, reply_markup=get_settings_kb(spy_mode), parse_mode="Markdown")
    except Exception:
        await callback.message.delete()
        await callback.message.answer(text, reply_markup=get_settings_kb(spy_mode), parse_mode="Markdown")
    await callback.answer()


@router.callback_query(F.data == "toggle_spy_mode")
async def toggle_spy(callback: CallbackQuery):
    # Premium check
    has_premium = await db.is_premium(callback.from_user.id)
    if not has_premium:
        await callback.answer("👑 Требуется Premium подписка!", show_alert=True)
        return
    
    new_value = await db.toggle_spy_mode(callback.from_user.id)
    spy_status = "включен ✅" if new_value else "выключен ❌"
    
    await callback.message.edit_text(
        f"⚙️ **Настройки**\n━━━━━━━━━━━━━\n\n"
        f"🔍 Шпионский режим: {spy_status}\n"
        "_Видите диалог детектива в реальном времени._\n\n"
        "⚠️ _Премиум-функция. По умолчанию выключен._",
        reply_markup=get_settings_kb(new_value), parse_mode="Markdown"
    )
    await callback.answer(f"Шпионский режим {'включён' if new_value else 'выключён'}")


@router.callback_query(F.data == "back_to_profile")
async def back_to_profile(callback: CallbackQuery):
    user_id = callback.from_user.id
    balance, premium_until, successful_cases, active_cases, nickname, spy_mode, birthday, description, photo = await db.get_user_profile(user_id)
    display_name = nickname or callback.from_user.first_name or "Агент"
    
    premium_text = ""
    if premium_until:
        from datetime import datetime
        if datetime.fromisoformat(premium_until) > datetime.utcnow():
            premium_text = "\n👑 **Статус:** Premium"
    
    parts = [
        f"🕵️‍♂️ **{display_name}**",
        f"ID: `{user_id}`{premium_text}",
        f"━━━━━━━━━━━━━",
        f"⭐️ Баланс: {balance} расследований",
        f"✅ Закрыто дел: {successful_cases}",
        f"🔵 В работе: {active_cases}",
    ]
    if birthday:
        parts.append(f"🎂 ДР: {birthday}")
    if description:
        parts.append(f"📝 О себе: {description}")
    
    text = "\n".join(parts)
    
    try:
        if photo and photo != "None":
            await callback.message.delete()
            try:
                if photo.startswith("http"):
                    from aiogram.types import URLInputFile
                    photo_obj = URLInputFile(photo)
                else:
                    photo_obj = photo
                await callback.message.answer_photo(photo=photo_obj, caption=text, reply_markup=profile_kb, parse_mode="Markdown")
                await callback.answer()
                return
            except Exception as e:
                import logging
                logging.warning(f"Failed to send profile photo on back_to_profile: {e}")
                # Fallback to text
                
        # Send text only
        await callback.message.edit_text(text, reply_markup=profile_kb, parse_mode="Markdown")
    except Exception:
        await callback.message.delete()
        if photo and photo != "None":
            try:
                if photo.startswith("http"):
                    from aiogram.types import URLInputFile
                    photo_obj = URLInputFile(photo)
                else:
                    photo_obj = photo
                await callback.message.answer_photo(photo=photo_obj, caption=text, reply_markup=profile_kb, parse_mode="Markdown")
                await callback.answer()
                return
            except Exception as e:
                pass
        await callback.message.answer(text, reply_markup=profile_kb, parse_mode="Markdown")

    await callback.answer()
