from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from bot.keyboards.common import main_menu

router = Router()

@router.message(Command("start"))
async def cmd_start(message: Message):
    from database import db
    user_id = message.from_user.id
    
    is_existing = await db.is_user_exists(user_id)
    await db._ensure_user(user_id)
    
    welcome_text = (
        "Добро пожаловать в 🕵️‍♂️ Giftspy!\n\n"
        "Ломаете голову над выбором подарка? Отправьте к вашей «цели» нашего "
        "детектива! Он анонимно пообщается с человеком в формате интерактива, "
        "выведает его тайные желания и составит для вас подробное досье.\n\n"
        "🔒 _Полная анонимность гарантирована. Никто не узнает, что это были вы. Только если вы сами не раскроетесь._"
    )
    
    if not is_existing:
        welcome_text += "\n\n🎁 **Приветственный бонус: Мы начислили вам 1 бесплатное расследование!**"
        
    await message.answer(welcome_text, reply_markup=main_menu, parse_mode="Markdown")

@router.message(F.text.in_({"Как это работает", "❓ Как это работает?"}))
async def help_info(message: Message):
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
    import config
    
    webapp_kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Открыть приложение 📱", web_app=WebAppInfo(url=config.WEBAPP_URL))]
        ]
    )
    
    await message.answer(
        "🕵️‍♂️ **Как работает Giftspy?**\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "Наш детектив свяжется с вашей целью, анонимно и аккуратно выведает её тайные желания, "
        "а затем составит для вас подробный отчёт с идеальными идеями для подарков!\n\n"
        "Чтобы начать расследование, выбрать детектива, управлять шпионским режимом и получить досье, "
        "пожалуйста, используйте наше **Mini App**. Там гораздо больше классного функционала и всё невероятно просто! 🚀",
        reply_markup=webapp_kb,
        parse_mode="Markdown"
    )


@router.callback_query(F.data == "start_new_case")
async def start_case_from_help(callback: CallbackQuery):
    """Перенаправляет к началу нового дела."""
    from aiogram.types import ReplyKeyboardRemove
    from bot.states.order import OrderGift
    from database import db
    from aiogram.fsm.context import FSMContext
    
    # Просто удаляем инлайн и подсказываем нажать кнопку
    await callback.message.edit_text(
        "👇 Нажмите **🔍 Начать новое дело** в меню ниже!",
        parse_mode="Markdown"
    )
    await callback.answer()
