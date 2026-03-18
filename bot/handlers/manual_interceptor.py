from bot.keyboards.common import main_menu
from aiogram import Router, F
from aiogram.types import Message
from aiogram.fsm.context import FSMContext
from database import db

# ВАЖНО: Этот обработчик ловит ЛЮБОЙ текст, регистрируется ПОСЛЕДНИМ
router = Router()

# Команды главного меню — при их нажатии НЕ перехватываем
MENU_COMMANDS = {
    "🔍 Начать новое дело", "📁 Картотека досье", "🏠 Мой профиль",
    "❓ Как это работает?", "📂 Мои активные дела", "👥 Мои цели", "⏩ Пропустить"
}


@router.message(F.text & ~F.text.startswith("/"))
async def manual_message_handler(message: Message, state: FSMContext):
    # Fix #4: Если нажата кнопка меню — сбрасываем FSM и пропускаем
    if message.text in MENU_COMMANDS or message.text.startswith("🕵🏻 Вернуть детективу"):
        return

    # Проверяем, есть ли активный FSM-стейт
    current_state = await state.get_state()
    if current_state is not None:
        # Пользователь в FSM-потоке — не перехватываем, пусть обработает нужный handler
        return

    customer_id = message.from_user.id
    cases = await db.get_user_active_cases(customer_id)
    
    manual_case_id = None
    target = None

    for case in cases:
        case_id, t, status = case
        if status == 'manual_mode':
            manual_case_id = case_id
            target = t
            break

    if manual_case_id:
        await db.save_chat_message(manual_case_id, 'ai', message.text)
        
        from main import client
        from services.scheduler import resolve_target
        
        target_entity = await resolve_target(client, target)
        if target_entity is None:
            await message.reply("❌ Не удалось найти цель.")
            return
        await client.send_message(target_entity, message.text)
        
        await message.reply("📨 Отправлено!")
        return

    # Лишний текст — подсказка
    await message.answer("Воспользуйтесь меню кнопок 👇", reply_markup=main_menu)
