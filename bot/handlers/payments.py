from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from bot.keyboards.common import store_kb, get_buy_confirm_kb
from database import db
import config
import logging
import uuid

router = Router()

# ================= PRODUCT CATALOG =================

PRODUCTS = {
    "buy_inv_1": {
        "title": "1 Расследование",
        "desc": "Пополнение баланса на 1 расследование.",
        "amount": "1.00",       # 1 RUB for testing
        "display_price": "1",
        "payload": "inv_1",
    },
    "buy_inv_3": {
        "title": "3 Расследования",
        "desc": "Пополнение баланса на 3 расследования со скидкой.",
        "amount": "249.00",
        "display_price": "249",
        "payload": "inv_3",
    },
    "buy_prem_1": {
        "title": "Premium Подписка (1 Месяц)",
        "desc": "Безлимитные расследования на 30 дней и шпионский режим.",
        "amount": "299.00",
        "display_price": "299",
        "payload": "prem_1",
    },
}


def _create_yookassa_payment(product_key: str, user_id: int) -> str | None:
    """Creates a YooKassa payment and returns the confirmation URL."""
    from yookassa import Configuration, Payment

    if not config.YOOKASSA_SHOP_ID or not config.YOOKASSA_SECRET_KEY:
        logging.error("YooKassa credentials not configured")
        return None

    Configuration.account_id = config.YOOKASSA_SHOP_ID
    Configuration.secret_key = config.YOOKASSA_SECRET_KEY

    product = PRODUCTS.get(product_key)
    if not product:
        return None

    idempotence_key = str(uuid.uuid4())

    try:
        payment = Payment.create({
            "amount": {
                "value": product["amount"],
                "currency": "RUB"
            },
            "confirmation": {
                "type": "redirect",
                "return_url": f"https://t.me/{config.BOT_USERNAME}"
            },
            "capture": True,
            "description": product["title"],
            "metadata": {
                "user_id": str(user_id),
                "payload": product["payload"]
            }
        }, idempotence_key)

        return payment.confirmation.confirmation_url
    except Exception as e:
        logging.error(f"YooKassa payment creation error: {e}")
        return None


# ================= BOT HANDLERS =================

@router.callback_query(F.data == "open_store")
async def open_store(callback: CallbackQuery):
    text = (
        "🛍 **Магазин Агентства**\n━━━━━━━━━━━━━\n\n"
        "Здесь вы можете пополнить баланс расследований или приобрести Premium.\n\n"
        "👑 **Premium включает:**\n"
        "• Безлимитное количество дел\n"
        "• Шпионский режим (чтение переписок в реальном времени)\n"
    )
    try:
        await callback.message.edit_text(text, reply_markup=store_kb, parse_mode="Markdown")
    except Exception:
        await callback.message.delete()
        await callback.message.answer(text, reply_markup=store_kb, parse_mode="Markdown")
    await callback.answer()


@router.callback_query(F.data.startswith("buy_"))
async def process_buy_callback(callback: CallbackQuery):
    action = callback.data
    product = PRODUCTS.get(action)

    if not product:
        await callback.answer("Неизвестный товар!")
        return

    text = (
        f"🛒 **Подтверждение покупки**\n━━━━━━━━━━━━━\n\n"
        f"**Товар:** {product['title']}\n"
        f"**Описание:** {product['desc']}\n\n"
        f"**К оплате:** {product['display_price']} ₽"
    )

    try:
        await callback.message.edit_text(
            text, parse_mode="Markdown",
            reply_markup=get_buy_confirm_kb(action, product['display_price'])
        )
    except Exception:
        await callback.message.delete()
        await callback.message.answer(
            text, parse_mode="Markdown",
            reply_markup=get_buy_confirm_kb(action, product['display_price'])
        )

    await callback.answer()


@router.callback_query(F.data.startswith("confirm_buy_"))
async def send_payment_link(callback: CallbackQuery):
    product_key = callback.data.replace("confirm_", "")
    user_id = callback.from_user.id

    await callback.answer("⏳ Создаём ссылку на оплату...")

    payment_url = _create_yookassa_payment(product_key, user_id)

    if not payment_url:
        try:
            await callback.message.edit_text(
                "❌ Не удалось создать платёж. Попробуйте позже.",
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="⬅️ Назад в магазин", callback_data="open_store")]
                ])
            )
        except Exception:
            await callback.message.answer("❌ Не удалось создать платёж. Попробуйте позже.")
        return

    product = PRODUCTS.get(product_key, {})
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"💳 Оплатить {product.get('display_price', '')} ₽", url=payment_url)],
        [InlineKeyboardButton(text="⬅️ Назад в магазин", callback_data="open_store")]
    ])

    try:
        await callback.message.edit_text(
            f"🔗 **Ссылка на оплату готова!**\n\n"
            f"Нажмите кнопку ниже, чтобы перейти к оплате.\n"
            f"После успешной оплаты баланс будет пополнен автоматически.",
            reply_markup=kb, parse_mode="Markdown"
        )
    except Exception:
        await callback.message.delete()
        await callback.message.answer(
            f"🔗 **Ссылка на оплату готова!**\n\n"
            f"Нажмите кнопку ниже, чтобы перейти к оплате.\n"
            f"После успешной оплаты баланс будет пополнен автоматически.",
            reply_markup=kb, parse_mode="Markdown"
        )
