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


def days_until_birthday(bday_str):
    """Рассчитывает количество дней до следующего дня рождения цели."""
    if not bday_str:
        return None
    try:
        # Поддержка форматов DD.MM.YYYY, DD.MM, YYYY-MM-DD и DD-MM-YYYY
        if '.' in bday_str:
            parts = bday_str.split('.')
            day = int(parts[0])
            month = int(parts[1])
        elif '-' in bday_str:
            parts = bday_str.split('-')
            if len(parts[0]) == 4: # YYYY-MM-DD
                day = int(parts[2])
                month = int(parts[1])
            else: # DD-MM-YYYY
                day = int(parts[0])
                month = int(parts[1])
        else:
            return None

        from datetime import date
        today = date.today()
        bday_this_year = date(today.year, month, day)
        if bday_this_year < today:
            bday_this_year = date(today.year + 1, month, day)
        return (bday_this_year - today).days
    except Exception:
        return None


async def background_tasks_worker(bot: Bot, client: TelegramClient):
    """Фоновая задача: проверяет БД на новые статусы и новые дела"""
    logging.info("🔄 Фоновые службы уведомлений и сканера запущены...")
    ai_service = AIDetectiveService()
    last_birthday_check_date = None

    while True:
        try:
            # 1. Уведомления о старте
            try:
                started_cases = await db.get_started_cases()
                for case in started_cases:
                    case_id, customer_id, target = case
                    # Check status update / dialogue notification settings
                    notif = await db.get_user_notifications(customer_id)
                    if notif.get('notify_dialogue', True):
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
                    
                    # Check case report notification settings
                    notif = await db.get_user_notifications(customer_id)
                    if notif.get('notify_reports', True):
                        await bot.send_message(chat_id=customer_id, text=msg, parse_mode="HTML", reply_markup=rate_kb)
                    await db.mark_case_delivered(case_id)
                    logging.info(f"✅ Отчет по делу №{case_id} обработан/отправлен заказчику!")
            except Exception as e:
                logging.error(f"Error in done cases: {e}")

            # 3. Сканер новых дел для Telethon и AI
            try:
                pending_cases = await db.get_pending_cases()
                for case in pending_cases:
                    case_id, customer_id, target, holiday, context, persona, budget, status, report, *_rest = case

                    logging.info(f"🕵️‍♂️ Беру в работу Дело №{case_id} на цель {target} (Стиль: {persona})")

                    try:
                        target_entity = await resolve_target(client, target)
                        
                        if target_entity is None:
                            raise ValueError(f"Не удалось найти пользователя {target}")

                        # Note: we are starting case directly, no more memory dicts. 
                        # GenAI session context logic will be handled inside Telethon message handler
                        await db.update_case_status(case_id, 'started')

                        # Генерируем два сообщения "холодного старта"
                        ai_model = _rest[0] if _rest else 'deepseek-v4'
                        chat_session = await ai_service.create_new_chat(holiday, context, persona, budget, ai_model=ai_model)
                        first_msgs = await ai_service.generate_first_messages(chat_session)

                        if first_msgs and len(first_msgs) > 0:
                            # Message 1: Greeting
                            await client.send_message(target_entity, first_msgs[0], parse_mode="Markdown")
                            await db.save_chat_message(case_id, 'ai', first_msgs[0])
                            logging.info(f"✅ Приветствие отправлено цели {target}")
                            
                            # Message 2: Question (with delay)
                            if len(first_msgs) > 1:
                                await asyncio.sleep(3)  # Natural pause
                                await client.send_message(target_entity, first_msgs[1], parse_mode="Markdown")
                                await db.save_chat_message(case_id, 'ai', first_msgs[1])
                                logging.info(f"✅ Вопрос о сотрудничестве отправлен цели {target}")
                            
                            # Spy mode: показываем первое сообщение заказчику
                            spy_mode = await db.get_user_spy_mode(customer_id)
                            has_premium = await db.is_premium(customer_id)
                            if spy_mode and has_premium:
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

            # 5. Проверка дней рождения (раз в сутки)
            from datetime import date
            today_str = date.today().isoformat()
            if last_birthday_check_date != today_str:
                try:
                    targets = await db.get_all_targets_with_birthdays()
                    for t_id, owner_id, target_name, birthday in targets:
                        # Skip if special record 'self' (user's own birthday is handled in profile edit)
                        if target_name == "Мой вишлист" or t_id == -1:
                            continue
                        days = days_until_birthday(birthday)
                        if days is not None:
                            # Verify notification preferences
                            notif = await db.get_user_notifications(owner_id)
                            if notif.get('notify_birthdays', True):
                                if days == 3:
                                    await bot.send_message(
                                        chat_id=owner_id,
                                        text=f"🎁 **БЛИЖАЙШИЙ ДЕНЬ РОЖДЕНИЯ**\n\n"
                                             f"Через 3 дня (уже {birthday}!) день рождения у вашего близкого: **{target_name}**! 🎉\n\n"
                                             f"Пора запустить расследование для поиска идеального подарка! 🕵️‍♂️",
                                        parse_mode="Markdown"
                                    )
                                    logging.info(f"🎁 Отправлен пуш о дне рождения {target_name} пользователю {owner_id}")
                                elif days == 0:
                                    await bot.send_message(
                                        chat_id=owner_id,
                                        text=f"🎂 **ДЕНЬ РОЖДЕНИЯ СЕГОДНЯ!**\n\n"
                                             f"Сегодня день рождения празднует **{target_name}**! 🎉🥳\n\n"
                                             f"Надеемся, вы успели приготовить подарок! Если нет — детектив всегда готов прийти на помощь! 🕵️‍♂️",
                                        parse_mode="Markdown"
                                    )
                                    logging.info(f"🎂 Отправлен пуш о дне рождения сегодня {target_name} пользователю {owner_id}")
                    last_birthday_check_date = today_str
                    logging.info(f"✅ Проверка дней рождения успешно завершена для даты: {today_str}")
                except Exception as e:
                    logging.error(f"Error in birthday check worker: {e}")

        except Exception as e:
            logging.error(f"Критическая ошибка в фоновых задачах: {e}")

        await asyncio.sleep(15)
