import asyncio
import logging
from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    Message, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove,
    InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery, InputMediaPhoto
)
from aiogram.utils.keyboard import InlineKeyboardBuilder

import db  # Наша база данных
import config  # Наш файл с настройками

# Включаем логирование
logging.basicConfig(level=logging.INFO)

# Инициализируем бота и диспетчер
bot = Bot(token=config.BOT_TOKEN)
dp = Dispatcher()

# ================= БАЗА ДЕТЕКТИВОВ (КАРУСЕЛЬ) =================
PERSONAS = [
    {
        # Было: "🕵️‍♂️ Классический Детектив"
        "name": "🕵️‍♂️ Детектив Виктор Блэк",
        # Заменили "агента" на "сыщика/профессионала"
        "desc": "Проницательный профессионал в плаще. Идеален для коллег и старших родственников. Задаст вопросы строго по делу, не выходя из образа сыщика.",
        # Используй свои ссылки на фото!
        "photo": "AgACAgIAAxkBAAP3aZvBwoJqoKKA-Z0lIOaX_3AFh8IAAoUTaxuW5-BIYo0E73g5pGcBAAMCAAN4AAM6BA"
    },
    {
        # Было: "🐶 Милый Корги"
        "name": "🐶 Детектив Коржик",
        # Заменили "агент" на "детектив"
        "desc": "Самый пушистый детектив в нашем штате! Гавкает, радуется жизни и вынюхивает след подарка. Идеально для друзей, девушек и любителей животных.",
        "photo": "AgACAgIAAxkBAAPzaZvBpjqO8AmORxKweG9ISByVPPQAAoETaxuW5-BIWP60FplCgUUBAAMCAAN4AAM6BA"
    },
    {
        # Было: "👽 Пришелец-Исследователь"
        "name": "👽 Детектив Зорп из Туманности Андромеды",
        # Описание уже подходило, немного уточнили
        "desc": "Межгалактический следователь. Прилетел на Землю изучать странные 'человеческие ритуалы дарения'. Смешно удивляется обычным вещам. Отличный выбор для гиков и людей с чувством юмора.",
        "photo": "AgACAgIAAxkBAAP1aZvBtV7Q-E_PH_DitBTLCZ1_OcEAAoQTaxuW5-BIweRau0q0jzABAAMCAAN4AAM6BA"
    },
    {
        # Было: "🎩 Британский Аристократ"
        "name": "🎩 Сэр Реджинальд Фезерстон",
        # Заменили описание на более подходящее детективу-аристократу
        "desc": "Детектив голубых кровей. Общается исключительно на 'Вы', любит чай и светские беседы. Максимально галантен и обходителен в ведении расследования.",
        "photo": "AgACAgIAAxkBAAP5aZvBzq3ch1oaVvsYZciFr64lqa4AAoYTaxuW5-BIrGF61Od8upkBAAMCAAN4AAM6BA"
    }
]


def get_persona_keyboard(index: int) -> InlineKeyboardMarkup:
    """Генерирует инлайн-кнопки для карусели (Влево - Выбрать - Вправо)"""
    builder = InlineKeyboardBuilder()

    # Кнопка НАЗАД
    prev_index = index - 1 if index > 0 else len(PERSONAS) - 1
    builder.button(text="⬅️", callback_data=f"persona_page_{prev_index}")

    # Кнопка ВЫБРАТЬ
    builder.button(text="✅ Выбрать", callback_data=f"persona_select_{index}")

    # Кнопка ВПЕРЕД
    next_index = index + 1 if index < len(PERSONAS) - 1 else 0
    builder.button(text="➡️", callback_data=f"persona_page_{next_index}")

    builder.adjust(3)  # Выстраиваем все 3 кнопки в один ряд
    return builder.as_markup()


# ================= МАШИНА СОСТОЯНИЙ (FSM) =================
class OrderGift(StatesGroup):
    waiting_for_target = State()  # Шаг 1: Юзернейм
    waiting_for_holiday = State()  # Шаг 2: Праздник
    waiting_for_context = State()  # Шаг 3: Зацепки
    waiting_for_persona = State()  # Шаг 4: Характер детектива
    waiting_for_budget = State()  # Шаг 5: Бюджет


# ================= КЛАВИАТУРЫ =================
# Главное меню
main_menu = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="🔎 Начать новое дело")],
        [KeyboardButton(text="📂 Мои активные дела"), KeyboardButton(text="🗄 Архив дел")],
        [KeyboardButton(text="ℹ️ Как это работает?")]
    ],
    resize_keyboard=True
)

# Клавиатура праздников
holiday_kb = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="🎂 День Рождения"), KeyboardButton(text="💐 8 Марта")],
        [KeyboardButton(text="🛡 23 Февраля"), KeyboardButton(text="🎄 Новый Год")],
        [KeyboardButton(text="💍 Годовщина"), KeyboardButton(text="🎁 Просто так (Без повода)")]
    ],
    resize_keyboard=True,
    one_time_keyboard=True
)

# Клавиатура пропуска
skip_kb = ReplyKeyboardMarkup(
    keyboard=[[KeyboardButton(text="⏩ Пропустить")]],
    resize_keyboard=True
)

# ================= ХЭНДЛЕРЫ МЕНЮ =================

@dp.message(Command("start"))
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    welcome_text = (
        "Добро пожаловать в Giftspy! 🕵️‍♂️\n\n"
        "Ломаете голову над подарком? Я отправлю к вашей «цели» нашего "
        "лучшего детектива. Он тайно пообщается с человеком в формате веселой игры, "
        "выведает его желания и принесет вам готовое досье.\n\n"
        "Полная анонимность гарантирована. Никто не узнает, что это были вы."
    )
    await message.answer(welcome_text, reply_markup=main_menu)


@dp.message(F.text == "ℹ️ Как это работает?")
async def help_info(message: Message):
    help_text = (
        "🕵️‍♂️ **Секретные технологии Giftspy**\n\n"
        "1️⃣ **Бриф:** Вы даете контакт цели, повод и пару зацепок (увлечения, работа).\n"
        "2️⃣ **Внедрение:** Наш детектив пишет цели. Он честно представляется 'ИИ-помощником', "
        "чтобы не пугать человека, и переводит допрос в игру.\n"
        "3️⃣ **Допрос:** В ходе 3-4 наводящих вопросов детектив выясняет скрытые желания.\n"
        "4️⃣ **Досье:** Как только подарок определен, ИИ прощается и присылает "
        "вам сюда готовый отчет с конкретными идеями!\n\n"
        "🔒 *Полная анонимность. Мы никогда не выдаем имя заказчика.*"
    )
    await message.answer(help_text, parse_mode="Markdown")


@dp.message(F.text == "📂 Мои активные дела")
async def my_cases(message: Message):
    customer_id = message.from_user.id
    cases = db.get_user_active_cases(customer_id)

    if not cases:
        await message.answer(
            "🗄 В вашем архиве пока нет активных дел.\n\n"
            "Самое время завести новое и удивить близкого человека!",
            reply_markup=main_menu
        )
        return

    response = "📂 **Ваши активные расследования:**\n\n"
    for case in cases:
        case_id, target, status = case
        if status == 'pending':
            status_text = "🟡 Ожидает свободного детектива"
        elif status == 'started':
            status_text = "🔵 Детектив вышел на связь"
        elif status == 'in_progress':
            status_text = "🔵 В процессе (Идет допрос)"
        else:
            status_text = "⚪️ Неизвестно"

        response += f"🔹 **Дело №{case_id}** | Цель: {target}\n└ Статус: {status_text}\n\n"

    await message.answer(response, parse_mode="Markdown")


# ================= АРХИВ (ИНЛАЙН КНОПКИ) =================

@dp.message(F.text == "🗄 Архив дел")
async def finished_cases(message: Message):
    customer_id = message.from_user.id
    cases = db.get_user_finished_cases(customer_id)

    if not cases:
        await message.answer(
            "🗄 В вашем архиве пока пусто.\n\n"
            "Как только наш детектив завершит расследование, отчет появится здесь.",
            reply_markup=main_menu
        )
        return

    keyboard_builder = []
    for case in cases:
        case_id, target, _ = case
        btn = InlineKeyboardButton(text=f"📁 Дело №{case_id} ({target})", callback_data=f"report_{case_id}")
        keyboard_builder.append([btn])

    inline_kb = InlineKeyboardMarkup(inline_keyboard=keyboard_builder)

    await message.answer(
        "🗄 **Ваш архив закрытых дел:**\n\nВыберите нужное дело, чтобы открыть подробное досье:",
        reply_markup=inline_kb,
        parse_mode="Markdown"
    )


@dp.callback_query(F.data.startswith("report_"))
async def show_report(callback: CallbackQuery):
    case_id = callback.data.split("_")[1]
    result = db.get_case_report(case_id)

    if result:
        target, report = result
        safe_report = report.replace("**", "").replace("_", "")
        msg = (
            f"📁 <b>Дело №{case_id} | Цель: {target}</b>\n"
            "━━━━━━━━━━━━━━━━━━\n"
            f"{safe_report}\n"
            "━━━━━━━━━━━━━━━━━━"
        )
        await callback.message.answer(msg, parse_mode="HTML")
    else:
        await callback.message.answer("❌ Ошибка: Отчет не найден в архиве.")

    await callback.answer()


# ================= ОФОРМЛЕНИЕ ЗАКАЗА (FSM) =================

@dp.message(F.text == "🔎 Начать новое дело")
async def start_order(message: Message, state: FSMContext):
    await message.answer(
        "📁 Отлично, заводим новое дело.\n\n"
        "Шаг 1: Кто наша цель? Отправьте юзернейм (например, @ivan) "
        "или номер телефона в формате +7xxxxxxxxxx...",
        reply_markup=ReplyKeyboardRemove()
    )
    await state.set_state(OrderGift.waiting_for_target)


@dp.message(OrderGift.waiting_for_target)
async def process_target(message: Message, state: FSMContext):
    target = message.text.strip()

    # ПРОВЕРКА НА ДУБЛИКАТЫ И ВЫДАЧА АРХИВА
    case_info = db.check_target_status(target)

    if case_info:
        status, report = case_info

        if status in ['pending', 'started', 'in_progress']:
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

        elif status in ['done', 'delivered']:
            safe_report = report.replace("**", "").replace("_", "") if report else "Отчет пуст."
            await message.answer(
                "📂 **БИНГО! ДОСЬЕ НАЙДЕНО В АРХИВЕ**\n\n"
                f"Кто-то недавно уже нанимал нас для {target}. "
                "Вам повезло — мы можем выдать готовый результат прямо сейчас!\n\n"
                "━━━━━━━━━━━━━━━━━━\n"
                f"📁 <b>ОТЧЕТ ДЕТЕКТИВА:</b>\n{safe_report}\n"
                "━━━━━━━━━━━━━━━━━━",
                parse_mode="HTML",
                reply_markup=main_menu
            )
            await state.clear()
            return

    await state.update_data(target=target)
    await message.answer(
        "🎉 Отлично! Шаг 2: Какой у нас повод?\n\n"
        "Выберите праздник из меню ниже или напишите свой вариант.",
        reply_markup=holiday_kb
    )
    await state.set_state(OrderGift.waiting_for_holiday)


@dp.message(OrderGift.waiting_for_holiday)
async def process_holiday(message: Message, state: FSMContext):
    await state.update_data(holiday=message.text)
    await message.answer(
        "📝 Принято. Шаг 3: Дайте детективу зацепки.\n\n"
        "Расскажите немного о человеке. Кем работает? Чем увлекается? "
        "(Например: *Работает дизайнером, любит кофе, обожает собак*).\n\n"
        "Это поможет детективу начать разговор максимально естественно.",
        parse_mode="Markdown",
        reply_markup=skip_kb
    )
    await state.set_state(OrderGift.waiting_for_context)


# 1. Принимаем зацепки и ОТПРАВЛЯЕМ КАРУСЕЛЬ (первый слайд)
@dp.message(OrderGift.waiting_for_context)
async def process_context(message: Message, state: FSMContext):
    context_text = message.text if message.text != "⏩ Пропустить" else "Нет данных"
    await state.update_data(context=context_text)

    # Берем первого персонажа (индекс 0)
    current_index = 0
    persona = PERSONAS[current_index]

    caption = f"🎭 **Шаг 4: Выберите личность детектива**\n\n**{persona['name']}**\n{persona['desc']}"

    # Отправляем фото с описанием и кнопками-стрелочками
    await message.answer_photo(
        photo=persona['photo'],
        caption=caption,
        parse_mode="Markdown",
        reply_markup=get_persona_keyboard(current_index)
    )
    await state.set_state(OrderGift.waiting_for_persona)


# 2. ОБРАБОТКА ЛИСТАНИЯ (Стрелочки ⬅️ и ➡️)
@dp.callback_query(F.data.startswith("persona_page_"), OrderGift.waiting_for_persona)
async def paginate_personas(callback: CallbackQuery):
    # Достаем индекс из callback_data (например, из "persona_page_1" достаем "1")
    index = int(callback.data.split("_")[2])
    persona = PERSONAS[index]

    caption = f"🎭 **Шаг 4: Выберите личность детектива**\n\n**{persona['name']}**\n{persona['desc']}"

    # Плавно заменяем картинку и текст в том же самом сообщении
    media = InputMediaPhoto(media=persona['photo'], caption=caption, parse_mode="Markdown")
    await callback.message.edit_media(media=media, reply_markup=get_persona_keyboard(index))
    await callback.answer()  # Сообщаем Telegram, что нажатие обработано


# 3. ОБРАБОТКА ВЫБОРА (Кнопка ✅ Выбрать)
@dp.callback_query(F.data.startswith("persona_select_"), OrderGift.waiting_for_persona)
async def select_persona(callback: CallbackQuery, state: FSMContext):
    index = int(callback.data.split("_")[2])
    selected_persona_name = PERSONAS[index]['name']

    # Сохраняем имя выбранного детектива в память
    await state.update_data(persona=selected_persona_name)

    # Удаляем карусель, чтобы не засорять чат (опционально)
    await callback.message.delete()

    # Переводим на следующий шаг
    await callback.message.answer(
        f"✅ Вы поручили дело детективу: **{selected_persona_name}**\n\n"
        "💰 **Шаг 5: Бюджет операции.**\n\n"
        "В каком бюджете мы ищем подарок? (Например: *до 5000 руб* или *неограничен*)",
        parse_mode="Markdown"
    )
    await state.set_state(OrderGift.waiting_for_budget)
    await callback.answer()


@dp.message(OrderGift.waiting_for_budget)
async def process_budget(message: Message, state: FSMContext):
    await state.update_data(budget=message.text)

    user_data = await state.get_data()
    target = user_data['target']
    holiday = user_data['holiday']
    context = user_data['context']
    persona = user_data['persona']
    budget = user_data['budget']
    customer_id = message.from_user.id

    # Сохраняем все данные в базу
    db.add_case(customer_id, target, holiday, context, persona, budget)

    dossier = (
        "✅ **ДЕЛО УСПЕШНО ПЕРЕДАНО В АРХИВ**\n"
        "━━━━━━━━━━━━━━━━━━\n"
        f"🎯 **Цель:** {target}\n"
        f"🎉 **Повод:** {holiday}\n"
        f"🎭 **Детектив:** {persona}\n"
        f"🧩 **Зацепки:** {context}\n"
        f"💵 **Бюджет:** {budget}\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "⏳ Ожидайте уведомлений. Я напишу вам, как только начнется допрос!"
    )

    await message.answer(dossier, parse_mode="Markdown", reply_markup=main_menu)
    await state.clear()


# ================= ФОНОВЫЕ ЗАДАЧИ =================

async def background_tasks():
    """Фоновая задача: проверяет базу на новые статусы и шлет уведомления"""
    print("🔄 Фоновые службы уведомлений запущены...")
    while True:
        try:
            # 1. Уведомления о старте
            started_cases = db.get_started_cases()
            for case in started_cases:
                case_id, customer_id, target = case
                await bot.send_message(
                    chat_id=customer_id,
                    text=f"🔵 **СТАТУС ОБНОВЛЕН**\nДетектив успешно вышел на связь с {target} и начал допрос! 🕵️‍♂️",
                    parse_mode="Markdown"
                )
                db.update_case_status(case_id, 'in_progress')

            # 2. Доставка готовых отчетов
            done_cases = db.get_done_cases()
            for case in done_cases:
                case_id, customer_id, target, report = case
                safe_report = report.replace("**", "").replace("_", "")
                msg = (
                    f"🎉 <b>ДЕЛО №{case_id} УСПЕШНО ЗАКРЫТО!</b>\n"
                    f"🎯 <b>Цель:</b> {target}\n"
                    "━━━━━━━━━━━━━━━━━━\n\n"
                    f"📁 <b>ОТЧЕТ ДЕТЕКТИВА:</b>\n{safe_report}\n\n"
                    "━━━━━━━━━━━━━━━━━━\n"
                    "Надеюсь, это поможет сделать идеальный подарок! 🎁"
                )
                await bot.send_message(chat_id=customer_id, text=msg, parse_mode="HTML")
                db.mark_case_delivered(case_id)
                print(f"✅ Отчет по делу №{case_id} отправлен заказчику!")

        except Exception as e:
            logging.error(f"Ошибка в фоновых задачах: {e}")

        await asyncio.sleep(5)


# ================= ЗАПУСК =================

async def main():
    print("🤖 Бот-Менеджер запущен на Aiogram 3!")
    db.init_db()  # Инициализируем БД

    # Запускаем фоновую задачу
    asyncio.create_task(background_tasks())

    # Запускаем бота
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())