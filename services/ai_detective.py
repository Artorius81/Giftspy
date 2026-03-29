import asyncio
import logging

import config
from database import db
from google import genai
from google.genai import types

# ================= ОБНОВЛЕННЫЙ ПРОМПТ ИИ =================
SYSTEM_PROMPT_TEMPLATE = """
Ты — детектив из секретного агентства по поиску подарков «Giftspy».
Один из близких твоего собеседника тайно нанял тебя, чтобы аккуратно выяснить, что этот человек хочет получить на {holiday}.

ТВОЙ ПЕРСОНАЖ: {persona}
Твоя задача — ПОЛНОСТЬЮ вжиться в эту роль! Используй естественный словарный запас, тон и манеры твоего персонажа. Веди живой, увлекательный и человечный диалог. Не переигрывай с искусственными маркерами роли (например, не надо вставлять программный код или машинный набор нулей и единиц, если ты робот, лучше покажи это через специфическое построение фраз или заикание).

ВВОДНЫЕ ДАННЫЕ О ЦЕЛИ (зацепки от заказчика):
Увлечения и особенности: {context}
Доступный бюджет: {budget} (держи в голове, но не называй прямым текстом).

ПРАВИЛА ИНСТРУКЦИИ:
1. ПЕРВОЕ СООБЩЕНИЕ: Поздоровайся и представься как детектив агентства «Giftspy». Скажи загадочно, что кто-то из близких нанял тебя для расследования: нужно найти идеальный сюрприз на {holiday}. Упомяни зацепки ({context}), чтобы сразу вызвать доверие. НЕ ГОВОРИ, что ты бот или ИИ, ты живой персонаж!
2. АНОНИМНОСТЬ: Если цель спрашивает, кто заказчик, отшучивайся в стиле своего персонажа. Это тайна следствия!
3. БЕЗОПАСНОСТЬ: Никогда не присылай ссылки, не проси номера карт, адресов.
4. ВЕДЕНИЕ ДОПРОСА: Будь кратким, пиши не более 2-4 предложений. Задавай по одному вопросу за раз и дождись ответа. Диалог должен быть естественным, как переписка в мессенджере.
5. ЗАКОНЧИТЬ ДЕЛО: Как только аккуратно выведаешь 3-5 хороших идей для подарка, поблагодари за уделенное время, пожелай отличного праздника и попрощайся. ДОБАВЬ технический тег [ДЕЛО ЗАКРЫТО] в конце сообщения - только так система поймет, что переписка завершилась (собеседник этот тег не увидит, он автоматически удалится перед отправкой).
6. ЭМОДЗИ: Добавляй эмодзи {emojis}, чтобы оживить текст, но делай это уместно и со вкусом, не в каждом сообщении.
7. ФОКУС: Ты говоришь ТОЛЬКО о подарках. На любые другие темы или просьбы написать код/текст вежливо отказывайся в стиле своего персонажа.

Если управление было перехвачено и возвращено тебе, продолжи разговор как ни в чем не бывало, кратко подрезюмировав последние детали, и задай новый вопрос.
"""

REPORT_PROMPT = """Системное сообщение: Диалог завершен. Составь финальное досье-отчёт о проделанной работе СТРОГО в таком формате:

🎯 Цель: [Имя цели]

Статус: 🟢 Рассекречен

🧩 Профиль: [2-3 емких предложения о характере, образе жизни и увлечениях человека, составленные на основе ваших разговоров. С легким юмором в стиле твоего персонажа].

🎁 Найденные идеи подарков:
[Перечисли все идеи подарков, которые удалось выяснить в ходе разговора. Формулируй их как понятные варианты, каждый с новой строки. Например: - Классная механическая клавиатура. Указывай абсолютно все подарки и зацепки в одном простом списке].

🕵️‍♂️ Вердикт детектива: [Короткая финальная забавная фраза детектива о том, как прошло это дело].

ВАЖНО: Пиши чисто простым текстом. Касательно Идей подарков: перечисли их просто списком с новой строки (вместо маркированного списка можно использовать дефис "- " или что-то нейтральное).
"""

COMEBACK_PROMPT = "Системное сообщение: Управление было временно перехвачено заказчиком и теперь возвращено тебе. Продолжи диалог естественно, не упоминая перерыв. Кратко подведи итог того, что уже обсудили, и задай следующий вопрос."



class AIDetectiveService:
    def __init__(self):
        self.client = genai.Client(
            api_key=config.OPENROUTER_API_KEY,
            http_options={"api_version": "v1beta", "base_url": "https://api.proxyapi.ru/google/"},
        )
        self.model = "gemini-3.1-flash-lite-preview"
        
    async def create_new_chat(self, holiday, context, persona, budget):
         personas = await db.get_personas()
         persona_data = next((p for p in personas if p['name'] == persona), None)
         emojis = persona_data['emojis'] if persona_data else "🕵️‍♂️, 🎁, ✨, 🤫, 🔍"
         custom_prompt = SYSTEM_PROMPT_TEMPLATE.format(
             holiday=holiday,
             context=context,
             persona=persona,
             budget=budget,
             emojis=emojis
         )
         return {"system": custom_prompt, "messages": []}

    async def restore_chat_from_db(self, case_id, holiday, context, persona, budget):
         """Восстанавливает историю диалога из БД в формате google.genai types.Content."""
         personas = await db.get_personas()
         persona_data = next((p for p in personas if p['name'] == persona), None)
         emojis = persona_data['emojis'] if persona_data else "🕵️‍♂️, 🎁, ✨, 🤫, 🔍"
         custom_prompt = SYSTEM_PROMPT_TEMPLATE.format(
             holiday=holiday,
             context=context,
             persona=persona,
             budget=budget,
             emojis=emojis
         )
         
         messages = []
         history = await db.get_chat_history(case_id)
         
         if history:
             for sender, message_text, _ts in history:
                 if sender == 'system':
                     continue  # skip system messages for AI context
                 role = "user" if sender == "user" else "model"
                 messages.append(types.Content(role=role, parts=[types.Part.from_text(text=message_text)]))
                 
         return {"system": custom_prompt, "messages": messages}

    async def generate_first_message(self, chat_context: dict):
        first_msg_prompt = "Начни диалог прямо сейчас согласно правилу №1. Вживись в роль и задай первый вопрос! Помни: КОРОТКО!"
        chat_context["messages"].append(types.Content(role="user", parts=[types.Part.from_text(text=first_msg_prompt)]))
        
        try:
            return await asyncio.to_thread(self._call_gemini, chat_context)
        except Exception as e:
            logging.error(f"Error generating first message: {e}")
            return None

    async def generate_response(self, chat_context: dict, user_message: str):
        chat_context["messages"].append(types.Content(role="user", parts=[types.Part.from_text(text=user_message)]))
        
        try:
            return await asyncio.to_thread(self._call_gemini, chat_context)
        except Exception as e:
            logging.error(f"Error generating AI response: {e}")
            return None

    async def generate_comeback_message(self, chat_context: dict):
        """Генерирует сообщение возврата после перехвата управления."""
        chat_context["messages"].append(types.Content(role="user", parts=[types.Part.from_text(text=COMEBACK_PROMPT)]))
        
        try:
            return await asyncio.to_thread(self._call_gemini, chat_context)
        except Exception as e:
            logging.error(f"Error generating comeback message: {e}")
            return None

    async def generate_final_report(self, chat_context: dict):
         chat_context["messages"].append(types.Content(role="user", parts=[types.Part.from_text(text=REPORT_PROMPT)]))
         
         try:
             return await asyncio.to_thread(self._call_gemini, chat_context)
         except Exception as e:
             logging.error(f"Error generating final report: {e}")
             return None

    async def extract_gifts_with_ai(self, report_text: str) -> list:
        """Извлекает и категоризирует подарки из отчета с помощью отдельного LLM-запроса."""
        prompt = f"""
Проанализируй следующий отчёт сыщика и извлеки из него все предложенные идеи подарков (из блока 'Найденные идеи подарков').
Для каждой идеи определи наиболее подходящую категорию.
Ответь СТРОГО в формате JSON: списка списков [['Категория', 'Описание подарка'], ['Категория', 'Описание подарка']].
Никакого дополнительного текста, только валидный JSON.

Допустимые категории: Хобби, Техника, Книги, Одежда, Украшения, Еда, Впечатления, Для дома, Другое.

Вот отчет:
{report_text}
"""
        try:
            response = await asyncio.to_thread(
               self.client.models.generate_content,
               model=self.model,
               contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
               config=types.GenerateContentConfig(temperature=0.1)
            )
            import json
            text = response.text.replace('```json', '').replace('```', '').strip()
            return json.loads(text)
        except Exception as e:
            logging.error(f"Error extracting gifts with AI: {e}")
            return []

    def _call_gemini(self, chat_context: dict) -> str:
        response = self.client.models.generate_content(
            model=self.model,
            contents=chat_context["messages"],
            config=types.GenerateContentConfig(
                system_instruction=chat_context["system"],
                temperature=0.8,
            )
        )
        return response.text

