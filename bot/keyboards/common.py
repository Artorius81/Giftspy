from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder
from database import db

# ================= БАЗА ДЕТЕКТИВОВ (ПЕРЕНЕСЕНО В БД) =================


main_menu = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="🔍 Начать новое дело")],
        [KeyboardButton(text="📁 Картотека досье"), KeyboardButton(text="🏠 Мой профиль")],
        [KeyboardButton(text="👥 Мои цели"), KeyboardButton(text="❓ Как это работает?")]
    ],
    resize_keyboard=True
)

# Меню для ручного режима — добавляем кнопку возврата ИИ
def get_manual_mode_menu(case_id: int) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=f"🕵🏻 Вернуть детективу (дело #{case_id})")],
            [KeyboardButton(text="🔍 Начать новое дело")],
            [KeyboardButton(text="📁 Картотека досье"), KeyboardButton(text="🏠 Мой профиль")]
        ],
        resize_keyboard=True
    )

holiday_kb = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="🎂 День Рождения"), KeyboardButton(text="💐 8 Марта")],
        [KeyboardButton(text="🛡 23 Февраля"), KeyboardButton(text="🎄 Новый Год")],
        [KeyboardButton(text="💍 Годовщина"), KeyboardButton(text="🎁 Просто так (Без повода)")]
    ],
    resize_keyboard=True,
    one_time_keyboard=True
)

skip_kb = ReplyKeyboardMarkup(
    keyboard=[[KeyboardButton(text="⏩ Пропустить")]],
    resize_keyboard=True
)

# ================= PROFILE KEYBOARDS =================

profile_kb = InlineKeyboardMarkup(
    inline_keyboard=[
        [InlineKeyboardButton(text="✏️ Никнейм", callback_data="change_nickname"),
         InlineKeyboardButton(text="🎂 День рождения", callback_data="change_birthday")],
        [InlineKeyboardButton(text="📝 О себе", callback_data="change_description"),
         InlineKeyboardButton(text="📸 Фото", callback_data="change_photo")],
        [InlineKeyboardButton(text="⚙️ Настройки", callback_data="open_settings")],
        [InlineKeyboardButton(text="🛍 Магазин", callback_data="open_store"),
         InlineKeyboardButton(text="🎁 Бонусы", callback_data="referral")]
    ]
)

store_kb = InlineKeyboardMarkup(
    inline_keyboard=[
        [InlineKeyboardButton(text="1 Расследование — 1 ₽", callback_data="buy_inv_1")],
        [InlineKeyboardButton(text="3 Расследования — 249 ₽", callback_data="buy_inv_3")],
        [InlineKeyboardButton(text="👑 Премиум (1 Мес) — 1 ₽", callback_data="buy_prem_1")],
        [InlineKeyboardButton(text="⬅️ Назад", callback_data="back_to_profile")]
    ]
)

def get_settings_kb(spy_mode: bool) -> InlineKeyboardMarkup:
    spy_icon = "✅" if spy_mode else "❌"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=f"{spy_icon} Шпионский режим (Премиум)", callback_data="toggle_spy_mode")],
            [InlineKeyboardButton(text="⬅️ Назад в профиль", callback_data="back_to_profile")]
        ]
    )

def get_buy_confirm_kb(payload: str, price_text: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=f"💳 Оплатить {price_text} ₽", callback_data=f"confirm_{payload}")],
            [InlineKeyboardButton(text="⬅️ Назад в магазин", callback_data="open_store")]
        ]
    )

# ================= REMINDER KEYBOARDS =================

def get_reminder_kb(case_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="⏰ Через 3 дня", callback_data=f"remind_3d_{case_id}")],
            [InlineKeyboardButton(text="📅 Через неделю", callback_data=f"remind_7d_{case_id}")],
            [InlineKeyboardButton(text="📆 Через месяц", callback_data=f"remind_30d_{case_id}")],
            [InlineKeyboardButton(text="✍️ Своя дата", callback_data=f"remind_custom_{case_id}")],
            [InlineKeyboardButton(text="⬅️ Назад", callback_data=f"remind_back_{case_id}")]
        ]
    )

# ================= TARGET KEYBOARDS =================

def get_target_actions_kb(target_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔍 Отправить детектива", callback_data=f"target_investigate_{target_id}")],
            [InlineKeyboardButton(text="📋 Вишлист", callback_data=f"target_wishlist_{target_id}")],
            [InlineKeyboardButton(text="✏️ Редактировать", callback_data=f"target_edit_{target_id}")],
            [InlineKeyboardButton(text="⬅️ К списку целей", callback_data="targets_list")]
        ]
    )

# ================= CONFIRMATION KEYBOARD =================

def get_confirm_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="✅ Подтвердить", callback_data="confirm_case")],
            [InlineKeyboardButton(text="✏️ Изменить детали", callback_data="edit_case_details")]
        ]
    )

def get_edit_details_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🎯 Цель", callback_data="edit_detail_target"),
             InlineKeyboardButton(text="🎉 Повод", callback_data="edit_detail_holiday")],
            [InlineKeyboardButton(text="🧩 Зацепки", callback_data="edit_detail_context"),
             InlineKeyboardButton(text="🕵🏻 Детектив", callback_data="edit_detail_persona")],
            [InlineKeyboardButton(text="💵 Бюджет", callback_data="edit_detail_budget")],
            [InlineKeyboardButton(text="⬅️ Назад к подтверждению", callback_data="back_to_confirm")]
        ]
    )


# ================= УТИЛИТА: ОТОБРАЖАЕМОЕ ИМЯ ЦЕЛИ =================

async def resolve_target_display_name(owner_id: int, identifier: str) -> str:
    """Если в профиле цели есть имя, возвращает его, иначе возвращает identifier."""
    saved = await db.find_target_by_identifier(owner_id, identifier)
    if saved and saved[2]:  # name field (index 2 in the tuple: id, identifier, name, ...)
        return saved[2]
    return identifier
