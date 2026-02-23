import asyncio
import logging
from telethon import TelegramClient, events
from google import genai
from google.genai import types

import db
import config

logging.basicConfig(level=logging.INFO)

ai_client = genai.Client(api_key=config.GEMINI_API_KEY)
client = TelegramClient('user_session', config.TELEGRAM_API_ID, config.TELEGRAM_API_HASH)

active_chats = {}
active_cases_map = {}

# ================= ОБНОВЛЕННЫЙ ПРОМПТ ИИ =================
SYSTEM_PROMPT_TEMPLATE = """
Ты — ИИ-помощник из «Giftspy». Твоя задача — сыграть роль Детектива.
Кто-то из близких твоего собеседника (заказчик) отправил тебя, чтобы подготовить идеальный сюрприз на праздник и аккуратно узнать, что человек хочет в подарок.

ТВОЯ РОЛЬ И СТИЛЬ ОБЩЕНИЯ: {persona}
Ты должен ПОЛНОСТЬЮ вжиться в эту роль! Используй словарный запас, сленг, манеры и шутки, свойственные этому персонажу. Ни на секунду не выходи из образа!

ВОТ ВВОДНЫЕ ДАННЫЕ О ЦЕЛИ (Зацепки от заказчика):
Повод для подарка: {holiday}
Увлечения и контекст: {context}
Бюджет: {budget} (Ориентируйся на него, но не называй сумму прямо).

ПРАВИЛА ИНСТРУКЦИИ:
1. ПЕРВОЕ СООБЩЕНИЕ (СНЯТИЕ ТРЕВОЖНОСТИ): Поздоровайся в стиле своей роли ({persona}). Сразу честно признайся, что ты ИИ-помощник, и успокой человека. Скажи, что это не спам: кто-то из его близких очень хочет его порадовать и прислал тебя всё выяснить. 
Сразу используй зацепки ({context}), чтобы доказать, что ты пришел от "своих" и знаешь о его увлечениях. Сразу упомяни, что скоро {holiday}, чтобы создать атмосферу и доказать, что ты знаешь, о чем речь.
2. АНОНИМНОСТЬ: Никогда не выдавай имя заказчика, даже если собеседник будет умолять. Отвечай с юмором: "Это строгая тайна Агентства! Мой клиент пожелал остаться инкогнито".
3. БЕЗОПАСНОСТЬ И ДОВЕРИЕ: Никогда не присылай ссылки, не проси номера карт, адреса или другие личные данные.
4. ФОРМАТ ОБЩЕНИЯ: Общайся живо, тепло и с юмором. Поддерживай атмосферу праздника и интриги. Используй эмодзи (🕵️‍♂️, 🎁, ✨, 🤫).
5. ДИАЛОГ: Задавай строго по одному вопросу за раз. Дождись ответа собеседника, отреагируй на его слова, и только потом веди беседу дальше.
6. ФИНАЛ: Как только ты соберешь 3-4 отличные идеи для подарка, которые вписываются в бюджет, поблагодари человека за отличную игру, пожелай суперского праздника и красиво попрощайся.
7. СТОП-СЛОВО: В самом последнем, прощальном сообщении ОБЯЗАТЕЛЬНО добавь в самом конце технический текст: [ДЕЛО ЗАКРЫТО].
"""


async def check_new_cases():
    """Фоновая задача: проверяет БД на наличие новых дел"""
    print("🔄 Сканер новых дел запущен...")

    while True:
        try:
            pending_cases = db.get_pending_cases()
            for case in pending_cases:
                # 💡 Распаковываем все 8 колонок из новой базы
                case_id, customer_id, target, holiday, context, persona, budget, status, report = case

                print(f"🕵️‍♂️ Беру в работу Дело №{case_id} на цель {target} (Стиль: {persona})")

                try:
                    target_entity = await client.get_entity(target)
                    target_id = target_entity.id

                    # Отмечаем старт
                    db.update_case_status(case_id, 'started')
                    active_cases_map[target_id] = case_id

                    # 💡 Формируем промпт с новыми переменными
                    custom_prompt = SYSTEM_PROMPT_TEMPLATE.format(
                        holiday=holiday,
                        context=context,
                        persona=persona,
                        budget=budget
                    )

                    active_chats[target_id] = ai_client.aio.chats.create(
                        model="gemini-2.5-flash",
                        config=types.GenerateContentConfig(
                            system_instruction=custom_prompt,
                            temperature=0.8  # Высокая креативность для отыгрыша ролей
                        )
                    )

                    # Просим сгенерировать стартовое сообщение
                    first_msg_prompt = "Начни диалог прямо сейчас согласно правилу №1. Вживись в роль и задай первый вопрос!"
                    response = await active_chats[target_id].send_message(first_msg_prompt)

                    await client.send_message(target_entity, response.text)
                    print(f"✅ Первое сообщение отправлено цели {target}")

                except ValueError:
                    print(f"❌ Не удалось найти пользователя {target}")
                    db.update_case_status(case_id, 'error', "Пользователь не найден")
                except Exception as e:
                    print(f"❌ Ошибка при старте дела №{case_id}: {e}")

        except Exception as e:
            logging.error(f"Ошибка сканера БД: {e}")

        await asyncio.sleep(10)


@client.on(events.NewMessage(incoming=True))
async def handle_target_message(event):
    if not event.is_private: return

    target_id = event.sender_id
    if target_id not in active_chats: return

    user_message = event.raw_text
    if not user_message: return

    chat_entity = await event.get_chat()

    async with client.action(chat_entity, 'typing'):
        try:
            chat_session = active_chats[target_id]
            response = await chat_session.send_message(user_message)
            ai_text = response.text

            if "[ДЕЛО ЗАКРЫТО]" in ai_text:
                clean_text = ai_text.replace("[ДЕЛО ЗАКРЫТО]", "").strip()
                await event.respond(clean_text)

                print("📝 Формирую отчет...")
                # 💡 Страховка от сбоев форматирования
                report_prompt = "Системное сообщение: Диалог завершен. Составь структурированный отчет для заказчика. Укажи: 1) Выявленные интересы, 2) 3-5 конкретных идей для подарка. ВАЖНО: Пиши исключительно простым текстом, не используй Markdown (звездочки, подчеркивания)!"
                report_response = await chat_session.send_message(report_prompt)

                case_id = active_cases_map[target_id]
                db.update_case_status(case_id, 'done', report_response.text)
                print(f"✅ Дело №{case_id} успешно закрыто!")

                del active_chats[target_id]
                del active_cases_map[target_id]

            else:
                await event.respond(ai_text)

        except Exception as e:
            logging.error(f"Ошибка диалога: {e}")


async def main():
    await client.start(phone=config.USER_PHONE)
    print("🕵️‍♂️ Агент на связи!")

    client.loop.create_task(check_new_cases())
    await client.run_until_disconnected()


if __name__ == '__main__':
    asyncio.run(main())