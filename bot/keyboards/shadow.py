from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

def get_shadow_mode_kb(case_id: int) -> InlineKeyboardMarkup:
    """Клавиатура для перехвата управления ИИ"""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🕹️ Взять управление", callback_data=f"pause_ai_{case_id}")]
        ]
    )

def get_return_ai_kb(case_id: int) -> InlineKeyboardMarkup:
    """Клавиатура для возврата управления ИИ"""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🕵🏻 Вернуть детективу", callback_data=f"resume_ai_{case_id}")]
        ]
    )
