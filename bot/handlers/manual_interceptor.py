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
        
        from main import client, update_spy_message
        from services.scheduler import resolve_target
        from bot.keyboards.common import resolve_target_display_name
        
        target_entity = await resolve_target(client, target)
        if target_entity is None:
            await message.reply("❌ Не удалось найти цель.")
            return
        await client.send_message(target_entity, message.text)
        
        # Обновляем spy-сообщение
        spy_mode = await db.get_user_spy_mode(customer_id)
        if spy_mode:
            case = await db.get_case_by_id(manual_case_id)
            if case:
                display_name = await resolve_target_display_name(customer_id, target)
                await update_spy_message(manual_case_id, customer_id, display_name, case[5], manual_mode=True)
        
        await message.reply("📨 Отправлено!")
        return

    # Лишний текст — подсказка
    await message.answer("Воспользуйтесь меню кнопок 👇", reply_markup=main_menu)
