from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, LabeledPrice, PreCheckoutQuery
from aiogram.exceptions import TelegramAPIError
from bot.keyboards.common import store_kb, get_buy_confirm_kb
from database import db
import config
import logging

router = Router()

PROVIDER_TOKEN = config.YOOKASSA_TOKEN

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
    
    if action == "buy_inv_1":
        title = "1 Расследование"
        desc = "Вы собираетесь приобрести 1 дополнительное расследование."
        price = "99"
        payload = "buy_inv_1"
    elif action == "buy_inv_3":
        title = "3 Расследования"
        desc = "Вы собираетесь приобрести набор из 3 расследований."
        price = "249"
        payload = "buy_inv_3"
    elif action == "buy_prem_1":
        title = "Premium Подписка (1 Месяц)"
        desc = "👑 Безлимитные расследования на 30 дней и شпионский режим. Читайте переписку сыщика в реальном времени!"
        price = "299"
        payload = "buy_prem_1"
    else:
        await callback.answer("Неизвестный товар!")
        return

    text = (
        f"🛒 **Подтверждение покупки**\n━━━━━━━━━━━━━\n\n"
        f"**Товар:** {title}\n"
        f"**Описание:** {desc}\n\n"
        f"**К оплате:** {price} ₽"
    )
    
    try:
        await callback.message.edit_text(text, parse_mode="Markdown", reply_markup=get_buy_confirm_kb(payload, price))
    except Exception:
        await callback.message.delete()
        await callback.message.answer(text, parse_mode="Markdown", reply_markup=get_buy_confirm_kb(payload, price))
    
    await callback.answer()


@router.callback_query(F.data.startswith("confirm_buy_"))
async def send_invoice_callback(callback: CallbackQuery):
    action = callback.data.replace("confirm_", "")
    
    if not PROVIDER_TOKEN:
        await callback.answer("Тестовый режим оплаты. Токен провайдера не настроен.", show_alert=True)
        return

    title = ""
    description = ""
    payload = ""
    price_amount = 0
    
    if action == "buy_inv_1":
        title = "1 Расследование"
        description = "Пополнение баланса на 1 дело."
        payload = "inv_1"
        price_amount = 9900
    elif action == "buy_inv_3":
        title = "3 Расследования"
        description = "Пополнение баланса на 3 дела со скидкой."
        payload = "inv_3"
        price_amount = 24900
    elif action == "buy_prem_1":
        title = "Premium Подписка (1 Месяц)"
        description = "Безлимитные расследования на 30 дней и шпионский режим."
        payload = "prem_1"
        price_amount = 29900
    else:
        await callback.answer("Неизвестный товар!")
        return
        
    prices = [LabeledPrice(label=title, amount=price_amount)]

    try:
        await callback.message.bot.send_invoice(
            chat_id=callback.message.chat.id,
            title=title,
            description=description,
            payload=payload,
            provider_token=PROVIDER_TOKEN,
            currency="RUB",
            prices=prices,
            start_parameter="test-payment",
            need_name=False,
            need_phone_number=False,
            need_email=False,
            need_shipping_address=False,
            is_flexible=False
        )
        await callback.answer()
    except TelegramAPIError as e:
        logging.error(f"Error sending invoice: {e}")
        await callback.answer("Проблема на стороне платежной системы. Попробуйте позже.", show_alert=True)

@router.pre_checkout_query()
async def process_pre_checkout_query(pre_checkout_query: PreCheckoutQuery):
    await pre_checkout_query.bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)

@router.message(F.successful_payment)
async def process_successful_payment(message: Message):
    payload = message.successful_payment.invoice_payload
    user_id = message.from_user.id
    
    if payload == "inv_1":
        await db.add_balance(user_id, 1)
        await message.answer("🎉 Оплата успешна! +1 расследование добавлено на ваш баланс.")
    elif payload == "inv_3":
        await db.add_balance(user_id, 3)
        await message.answer("🎉 Оплата успешна! +3 расследования добавлены на ваш баланс.")
    elif payload == "prem_1":
        await db.set_premium(user_id, 30)
        await message.answer("👑 Оплата успешна! Статус Premium активирован на 1 месяц.")
    else:
        await message.answer("Оплата прошла, но товар не распознан. Обратитесь в поддержку.")
        
    logging.info(f"User {user_id} successfully bought {payload}")
