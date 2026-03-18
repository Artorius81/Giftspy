import asyncio
import logging
from aiogram import Bot
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

from database import db
from services.ai_detective import AIDetectiveService
from telethon import TelegramClient
from telethon.tl.types import InputPhoneContact
from telethon.tl.functions.contacts import ImportContactsRequest
import config

async def resolve_target(client: TelegramClient, target: str):
    """Резолвит цель по юзернейму или номеру телефона.
    Возвращает entity или None.
    """
    target = target.strip()
    
    # Попытка 1: Прямой резолв (работает для @username)
    try:
        entity = await client.get_entity(target)
        return entity
    except Exception:
        pass
    
    # Попытка 2: Если это номер телефона — импортируем контакт
    phone = target.lstrip('+').replace(' ', '').replace('-', '')
    if phone.isdigit() and len(phone) >= 10:
        try:
            contact = InputPhoneContact(
                client_id=0,
                phone=target if target.startswith('+') else f"+{target}",
                first_name="GiftSpy Target",
                last_name=""
            )
            result = await client(ImportContactsRequest([contact]))
            if result.users:
                return result.users[0]
        except Exception as e:
            logging.error(f"Ошибка импорта контакта {target}: {e}")
    
    return None


async def background_tasks_worker(bot: Bot, client: TelegramClient):
    """Фоновая задача: проверяет БД на новые статусы и новые дела"""
    logging.info("🔄 Фоновые службы уведомлений и сканера запущены...")
    ai_service = AIDetectiveService()

    while True:
        try:
            # 1. Уведомления о старте
            try:
                started_cases = await db.get_started_cases()
                for case in started_cases:
                    case_id, customer_id, target = case
                    await bot.send_message(
                        chat_id=customer_id,
                        text=f"🔵 **СТАТУС ОБНОВЛЕН**\nДетектив успешно вышел на связь с {target} и начал допрос! 🕵️‍♂️",
                        parse_mode="Markdown"
                    )
                    await db.update_case_status(case_id, 'in_progress')
            except Exception as e:
                logging.error(f"Error in started cases: {e}")

            # 2. Доставка готовых отчетов
            try:
                done_cases = await db.get_done_cases()
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
                    
                    rate_kb = InlineKeyboardMarkup(
                        inline_keyboard=[
                            [
                                InlineKeyboardButton(text="👍 Отлично", callback_data=f"rate_good_{case_id}"),
                                InlineKeyboardButton(text="👎 Не угадал", callback_data=f"rate_bad_{case_id}")
                            ]
                        ]
                    )
                    
                    await bot.send_message(chat_id=customer_id, text=msg, parse_mode="HTML", reply_markup=rate_kb)
                    await db.mark_case_delivered(case_id)
                    logging.info(f"✅ Отчет по делу №{case_id} отправлен заказчику!")
            except Exception as e:
                logging.error(f"Error in done cases: {e}")

            # 3. Сканер новых дел для Telethon и AI
            try:
                pending_cases = await db.get_pending_cases()
                for case in pending_cases:
                    case_id, customer_id, target, holiday, context, persona, budget, status, report = case

                    logging.info(f"🕵️‍♂️ Беру в работу Дело №{case_id} на цель {target} (Стиль: {persona})")

                    try:
                        target_entity = await resolve_target(client, target)
                        
                        if target_entity is None:
                            raise ValueError(f"Не удалось найти пользователя {target}")

                        # Note: we are starting case directly, no more memory dicts. 
                        # GenAI session context logic will be handled inside Telethon message handler
                        await db.update_case_status(case_id, 'started')

                        # Генерируем первое сообщение "холодного старта"
                        chat_session = await ai_service.create_new_chat(holiday, context, persona, budget)
                        first_msg = await ai_service.generate_first_message(chat_session)

                        if first_msg:
                            await client.send_message(target_entity, first_msg, parse_mode="Markdown")
                            await db.save_chat_message(case_id, 'ai', first_msg)
                            logging.info(f"✅ Первое сообщение отправлено цели {target}")
                            
                            # Spy mode: показываем первое сообщение заказчику
                            spy_mode = await db.get_user_spy_mode(customer_id)
                            if spy_mode:
                                try:
                                    import sys
                                    main_module = sys.modules.get('main')
                                    if main_module and hasattr(main_module, 'update_spy_message'):
                                        from bot.keyboards.common import resolve_target_display_name
                                        display_name = await resolve_target_display_name(customer_id, target)
                                        await main_module.update_spy_message(case_id, customer_id, display_name, persona)
                                except Exception as e:
                                    logging.warning(f"Spy mode first msg error: {e}")

                    except ValueError:
                        logging.error(f"❌ Не удалось найти пользователя {target}")
                        await db.update_case_status(case_id, 'error', "Пользователь не найден")
                        await bot.send_message(
                            chat_id=customer_id,
                            text=f"❌ **Ошибка:** Не удалось найти пользователя {target}.\n\n"
                                 "Проверьте правильность юзернейма или номера телефона и попробуйте снова.",
                            parse_mode="Markdown"
                        )
                    except Exception as e:
                        logging.error(f"❌ Ошибка при старте дела №{case_id}: {e}")
            except Exception as e:
                logging.error(f"Error in pending cases: {e}")

            # 4. Проверка напоминаний
            try:
                due_reminders = await db.get_due_reminders()
                for reminder in due_reminders:
                    reminder_id, customer_id, case_id, target_name, remind_at = reminder
                    
                    await bot.send_message(
                        chat_id=customer_id,
                        text=f"🔔 **НАПОМИНАНИЕ**\n\n"
                             f"Вы просили напомнить о **{target_name}**!\n\n"
                             f"Может быть, пора отправить нового детектива? 🕵️‍♂️",
                        parse_mode="Markdown"
                    )
                    await db.mark_reminder_sent(reminder_id)
                    logging.info(f"🔔 Напоминание #{reminder_id} отправлено пользователю {customer_id}")
            except Exception as e:
                logging.error(f"Error in reminders: {e}")

        except Exception as e:
            logging.error(f"Критическая ошибка в фоновых задачах: {e}")

        await asyncio.sleep(5)
