from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from bot.keyboards.common import main_menu

router = Router()

@router.message(Command("start"))
async def cmd_start(message: Message):
    welcome_text = (
        "Добро пожаловать в 🕵️‍♂️ Giftspy!\n\n"
        "Ломаете голову над выбором подарка? Отправьте к вашей «цели» нашего "
        "детектива! Он анонимно пообщается с человеком в формате интерактива, "
        "выведает его тайные желания и составит для вас подробное досье.\n\n"
        "🔒 _Полная анонимность гарантирована. Никто не узнает, что это были вы. Только если вы сами не раскроетесь._\n\n"
        "🎁 **Приветственный бонус: Мы начислили вам 1 бесплатное расследование!"
    )
    await message.answer(welcome_text, reply_markup=main_menu, parse_mode="Markdown")

@router.message(F.text == "❓ Как это работает?")
async def help_info(message: Message):
    help_text = (
        "🕵️‍♂️ **Как работает Giftspy?**\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        
        "1️⃣ **Заведите дело**\n"
        "Укажите цель (юзернейм или телефон), повод для подарка "
        "и пару зацепок об увлечениях человека.\n\n"
        
        "2️⃣ **Выберите детектива** 🎭\n"
        "У нас 8 уникальных персонажей — от галантного "
        "сэра до межгалактического инспектора. Каждый со своим стилем общения!\n\n"
        
        "3️⃣ **Детектив выходит на связь** 💬\n"
        "Он напишет вашей цели, представится и за 3-4 вопроса "
        "аккуратно выведает, о чём мечтает человек.\n\n"
        
        "4️⃣ **Получите досье** 📋\n"
        "Готовый отчёт с конкретными идеями подарков, "
        "разбитыми по категориям. Всё сохраняется в вишлисте!\n\n"
        
        "🔒 **Анонимность** — цель не узнает, кто заказчик\n"
        "👁 **Шпионский режим** — следите за диалогом в реальном времени\n"
        "🕹 **Перехват** — можете сами продолжить разговор\n\n"
        
        "━━━━━━━━━━━━━━━━━━\n"
        "✨ _Мы берем на себя всю неловкость, а вы — лучший даритель!_"
    )
    
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔍 Начать расследование", callback_data="start_new_case")]
        ]
    )
    await message.answer(help_text, parse_mode="Markdown", reply_markup=kb)


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
