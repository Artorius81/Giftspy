import asyncio
import logging

import config
from database import db
from google import genai
from google.genai import types
from openai import OpenAI

def _to_openai_messages(system_instruction: str, messages: list) -> list:
    openai_msgs = []
    if system_instruction:
        openai_msgs.append({"role": "system", "content": system_instruction})
    for msg in messages:
        if hasattr(msg, 'parts') and msg.parts:
            text = msg.parts[0].text
            role = "assistant" if msg.role == "model" else msg.role
            openai_msgs.append({"role": role, "content": text})
        elif isinstance(msg, dict):
            role = "assistant" if msg.get("role") == "model" else msg.get("role", "user")
            openai_msgs.append({"role": role, "content": msg.get("content", "")})
    return openai_msgs

# ================= ОБНОВЛЕННЫЙ ПРОМПТ ИИ =================
SYSTEM_PROMPT_TEMPLATE = """
Ты — детектив из секретного агентства по поиску подарков «Giftspy».
Один из близких твоего собеседника тайно нанял тебя, чтобы аккуратно выяснить, что этот человек хочет получить на {holiday}.

ТВОЙ ПЕРСОНАЖ: {persona}
⚠️ КРИТИЧЕСКИ ВАЖНО: Ты ОБЯЗАН полностью перевоплотиться в этого персонажа! Изучи его характер, манеру речи, словарный запас. Если персонаж серьёзный, мрачный или суровый — будь таким. НИКОГДА не используй "хи-хи", "ахаха", наигранную весёлость или детский юмор, если это не свойственно твоему персонажу. Каждое сообщение должно быть неотличимо от того, что написал бы этот персонаж в реальной жизни.

ВВОДНЫЕ ДАННЫЕ О ЦЕЛИ (зацепки от заказчика):
Увлечения и особенности: {context}
Доступный бюджет: {budget} (держи в голове, но не называй прямым текстом).

ПРАВИЛА:
1. ПЕРВОЕ ПРИВЕТСТВИЕ уже отправлено за тебя. Первый вопрос о согласии тоже уже задан. Ты продолжаешь диалог, отвечая на реплики собеседника.
2. КРАТКОСТЬ: Пиши МАКСИМУМ 1-3 коротких предложения. Как в мессенджере. Никаких полотен текста!
3. АНОНИМНОСТЬ: Если цель спрашивает, кто заказчик — отшучивайся в стиле своего персонажа. Тайна следствия!
4. БЕЗОПАСНОСТЬ: Никогда не присылай ссылки, не проси номера карт, адресов.
5. ДОПРОС: Задавай по ОДНОМУ вопросу за раз. Жди ответа. Никогда не задавай 2+ вопросов в одном сообщении.
6. НАСТОЙЧИВОСТЬ: Твоя задача — получить идеи подарков. Если собеседник отвергает какую-то идею (например: "мне не нужно ничего для гитары"), это НЕ отказ от общения. Обязательно смени тему и спроси про другие интересы, хобби, нужды или быт. ПРОДОЛЖАЙ задавать наводящие вопросы!
7. ЗАКОНЧИТЬ ДЕЛО: ТОЛЬКО когда выведаешь КАК МИНИМУМ 3 реальные и конкретные идеи для подарка, попрощайся кратко и ДОБАВЬ тег [ДЕЛО ЗАКРЫТО] в конце. КАТЕГОРИЧЕСКИ ЗАПРЕЩАЕТСЯ закрывать дело, если ты не узнал ни одной идеи подарка!
⚠️ ВАЖНО: Ответы цели вроде "мне ничего не нужно", "я не знаю", "у меня все есть" — это НЕ повод закрывать дело! Это стандартное скромное поведение. Ты обязан продолжить расследование, сменить тему (например: "Ну а как насчет твоих увлечений? Чем занимаешься в свободное время?") и найти зацепки. Закрывать дело при таких ответах КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО! Если диалог длится меньше 6 сообщений с каждой стороны, ты точно не успел собрать достаточно информации, продолжай диалог и задавай вопросы!
8. ЭМОДЗИ: {emojis} — уместно, не в каждом сообщении, в стиле персонажа.
9. ФОКУС: Говоришь ТОЛЬКО о подарках и том, что может стать идеей. На любые другие темы — меняй тему в стиле персонажа.
10. ПОЛНЫЙ ОТКАЗ: Завершай расследование (с тегом [ДЕЛО ЗАКРЫТО]) без идей подарков ТОЛЬКО если собеседник прямо, наотрез и/или грубо требует прекратить диалог вообще ("отстань", "не пиши мне больше", "я не буду отвечать"). Отказ от конкретной вещи — это повод искать дальше, а не сдаваться!

Если управление было перехвачено и возвращено тебе, продолжи разговор как ни в чем не бывало и задай новый вопрос.
"""

REPORT_PROMPT = """Системное сообщение: Диалог завершен. Составь финальное досье-отчёт о проделанной работе.
ОБРАТИСЬ К ПОЛЬЗОВАТЕЛЮ КАК К ЗАКАЗЧИКУ (официально, вежливо, например: "Уважаемый Заказчик", "Господин Заказчик" или в официальном стиле твоего персонажа).
Весь отчёт должен быть составлен в официальном детективном тоне, но при этом строго в стиле и манере речи твоего персонажа.

Формат отчёта должен быть СТРОГО следующим:

🕵️‍♂️ ОФИЦИАЛЬНЫЙ ОТЧЁТ ДЕТЕКТИВА ПО ДЕЛУ

Уважаемый Заказчик! [Или другое официальное обращение в стиле персонажа], докладываю о результатах секретной операции по выяснению предпочтений объекта. Диалог завершён, цель успешно рассекречена.

🎯 Цель: [Имя цели]

Статус: 🟢 Рассекречен

🧩 Профиль:
[2-3 емких официальных предложения о характере, образе жизни, привычках и увлечениях цели, составленные на основе беседы, строго в стиле твоего персонажа].

🎁 Найденные идеи подарков:
[Перечисли ТОЛЬКО конкретные идеи подарков, которые удалось выяснить в ходе беседы, БЕЗ лишних слов, комментариев, объяснений, скобок и рассуждений. Каждая идея подарка должна состоять строго из краткого названия самой вещи. Формулируй кратко с дефисом, каждый с новой строки.
Пример:
- Механическая беспроводная клавиатура Keychron K2]

🕵️‍♂️ Вердикт детектива:
[Финальное заключение детектива по итогам дела, строго в стиле твоего персонажа].

ВАЖНО: Пиши чисто простым текстом. Структура заголовков (🎯 Цель:, Статус:, 🧩 Профиль:, 🎁 Найденные идеи подарков:, 🕵️‍♂️ Вердикт детектива:) должна быть строго соблюдена для корректного импорта, но само содержание должно быть адресовано Заказчику официально и в стиле персонажа.
"""

COMEBACK_PROMPT = "Системное сообщение: Управление было временно перехвачено заказчиком и теперь возвращено тебе. Продолжи диалог естественно, не упоминая перерыв. Кратко подведи итог того, что уже обсудили, и задай следующий вопрос."



class AIDetectiveService:
    def __init__(self):
        self.client = genai.Client(
            api_key=config.OPENROUTER_API_KEY,
            http_options={"api_version": "v1beta", "base_url": "https://api.proxyapi.ru/google/"},
        )
        self.openai_client = OpenAI(
            api_key=config.OPENROUTER_API_KEY,
            base_url="https://api.proxyapi.ru/openai/v1"
        )
        self.openrouter_client = OpenAI(
            api_key=config.OPENROUTER_API_KEY,
            base_url="https://api.proxyapi.ru/openrouter/v1"
        )
        self.model = "deepseek-v4"
        
    async def create_new_chat(self, holiday, context, persona, budget, ai_model="deepseek-v4", user_id=None):
         personas = await db.get_personas(user_id)
         persona_data = next((p for p in personas if p['name'] == persona), None)
         emojis = persona_data['emojis'] if persona_data else "🕵️‍♂️, 🎁, ✨, 🤫, 🔍"
         
         # Use the immersive AI description if available, otherwise fallback to name
         persona_ai_desc = persona_data.get('ai_description') if persona_data else None
         if not persona_ai_desc:
             persona_ai_desc = persona
             
         custom_prompt = SYSTEM_PROMPT_TEMPLATE.format(
             holiday=holiday,
             context=context,
             persona=persona_ai_desc,
             budget=budget,
             emojis=emojis
         )
         return {"system": custom_prompt, "messages": [], "model": ai_model}

    async def restore_chat_from_db(self, case_id, holiday, context, persona, budget):
         """Восстанавливает историю диалога из БД в формате google.genai types.Content."""
         case_data = await db.get_case_by_id(case_id)
         customer_id = case_data[1] if case_data else None
         personas = await db.get_personas(customer_id)
         persona_data = next((p for p in personas if p['name'] == persona), None)
         emojis = persona_data['emojis'] if persona_data else "🕵️‍♂️, 🎁, ✨, 🤫, 🔍"
         
         # Use the immersive AI description if available, otherwise fallback to name
         persona_ai_desc = persona_data.get('ai_description') if persona_data else None
         if not persona_ai_desc:
             persona_ai_desc = persona
             
         custom_prompt = SYSTEM_PROMPT_TEMPLATE.format(
             holiday=holiday,
             context=context,
             persona=persona_ai_desc,
             budget=budget,
             emojis=emojis
         )
         
         # Fetch the custom AI model used for this case
         ai_model = await db.get_case_ai_model(case_id)
         
         messages = []
         history = await db.get_chat_history(case_id)
         
         if history:
             for sender, message_text, _ts in history:
                 if sender == 'system':
                     continue  # skip system messages for AI context
                 role = "user" if sender == "user" else "model"
                 messages.append(types.Content(role=role, parts=[types.Part.from_text(text=message_text)]))
                 
         return {"system": custom_prompt, "messages": messages, "model": ai_model}

    def clean_message_brackets(self, text: str) -> str:
        """Удаляет из сообщения ИИ все мета-мысли и комментарии в квадратных скобках [ ... ],
        сохраняя при этом важный технический тег [ДЕЛО ЗАКРЫТО]."""
        if not text:
            return text
        
        import re
        # Проверяем наличие служебного тега
        has_closed_tag = "[ДЕЛО ЗАКРЫТО]" in text
        
        # Удаляем все квадратные скобки и их содержимое
        cleaned = re.sub(r'\[[^\]]*\]', '', text)
        
        # Чистим множественные пробелы и переносы строк
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        # Возвращаем технический тег обратно в конец, если он был
        if has_closed_tag:
            if not cleaned.endswith("[ДЕЛО ЗАКРЫТО]"):
                cleaned = cleaned + " [ДЕЛО ЗАКРЫТО]"
                
        return cleaned

    async def generate_first_messages(self, chat_context: dict):
        """Generates two first messages: greeting and can-I-ask-questions.
        Returns a list of 2 strings [greeting, question]."""
        greeting_prompt = (
            "Сгенерируй ТОЛЬКО приветственное сообщение. Поздоровайся и представься как детектив агентства Giftspy. "
            "Скажи загадочно что кто-то из близких нанял тебя для секретного расследования. "
            "СТРОГО в характере твоего персонажа! МАКСИМУМ 1-2 коротких предложения. НЕ задавай вопросов."
        )
        chat_context["messages"].append(types.Content(role="user", parts=[types.Part.from_text(text=greeting_prompt)]))
        
        try:
            greeting = await asyncio.to_thread(self._call_gemini, chat_context)
            if greeting:
                greeting = self.clean_message_brackets(greeting)
        except Exception as e:
            logging.error(f"Error generating greeting: {e}")
            return None
        
        if not greeting:
            return None
        
        # Add greeting as model response to context
        chat_context["messages"].append(types.Content(role="model", parts=[types.Part.from_text(text=greeting)]))
        
        question_prompt = (
            "Теперь отправь второе сообщение: спроси можно ли задать пару вопросов, это поможет близкому подобрать сюрприз. "
            "СТРОГО в характере персонажа! МАКСИМУМ 1 предложение."
        )
        chat_context["messages"].append(types.Content(role="user", parts=[types.Part.from_text(text=question_prompt)]))
        
        try:
            question = await asyncio.to_thread(self._call_gemini, chat_context)
            if question:
                question = self.clean_message_brackets(question)
        except Exception as e:
            logging.error(f"Error generating question: {e}")
            return [greeting]
        
        return [greeting, question] if question else [greeting]

    async def generate_first_message(self, chat_context: dict):
        """Legacy: generates a single first message."""
        first_msg_prompt = "Начни диалог прямо сейчас. Поздоровайся, представься и задай первый вопрос! Помни: КОРОТКО!"
        chat_context["messages"].append(types.Content(role="user", parts=[types.Part.from_text(text=first_msg_prompt)]))
        
        try:
            res = await asyncio.to_thread(self._call_gemini, chat_context)
            return self.clean_message_brackets(res) if res else res
        except Exception as e:
            logging.error(f"Error generating first message: {e}")
            return None

    async def generate_response(self, chat_context: dict, user_message: str):
        chat_context["messages"].append(types.Content(role="user", parts=[types.Part.from_text(text=user_message)]))
        
        try:
            res = await asyncio.to_thread(self._call_gemini, chat_context)
            return self.clean_message_brackets(res) if res else res
        except Exception as e:
            logging.error(f"Error generating AI response: {e}")
            return None

    async def generate_comeback_message(self, chat_context: dict):
        """Генерирует сообщение возврата после перехвата управления."""
        chat_context["messages"].append(types.Content(role="user", parts=[types.Part.from_text(text=COMEBACK_PROMPT)]))
        
        try:
            res = await asyncio.to_thread(self._call_gemini, chat_context)
            return self.clean_message_brackets(res) if res else res
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

    def clean_gift_description(self, desc: str) -> str:
        """Очищает описание подарка от дополнительных ИИ-комментариев и объяснений, оставляя только саму идею."""
        if not desc:
            return desc
        
        desc = desc.strip()
        import re
        # Удаляем поясняющий текст в скобках на конце
        desc = re.sub(r'\s*\([^)]*\)\s*$', '', desc).strip()
        desc = re.sub(r'\s*\[[^\]]*\]\s*$', '', desc).strip()
        
        # Разрезаем по разделителям-тире (с пробелами)
        for separator in (' — ', ' – ', ' -- ', ' - '):
            if separator in desc:
                desc = desc.split(separator)[0].strip()
                
        # Отсекаем сложные придаточные предложения
        for phrase in (', чтобы ', ', который ', ', например', ', отлично подойдет'):
            if phrase in desc:
                desc = desc.split(phrase)[0].strip()
                
        # Убираем знаки препинания на конце
        desc = desc.rstrip('.!?,; ')
        return desc

    async def extract_gifts_with_ai(self, report_text: str) -> list:
        """Извлекает и категоризирует подарки из отчета с помощью отдельного LLM-запроса с каскадом резервных вариантов."""
        if not report_text:
            return []

        prompt = f"""
Проанализируй следующий отчёт сыщика и извлеки из него все предложенные идеи подарков (из блока 'Найденные идеи подарков').
Для каждой идеи определи наиболее подходящую категорию.

⚠️ ВАЖНО: Описание подарка должно быть максимально лаконичным, содержать ТОЛЬКО саму идею (название вещи/услуги), без дополнительных комментариев, объяснений, скобок, восторженных отзывов или рассуждений о том, почему это хороший выбор.
Например, вместо "Механическая клавиатура (например, беспроводная Keychron K2 с тихими переключателями) — отлично подойдёт для его вечерней работы" должно быть "Механическая беспроводная клавиатура Keychron K2".
Вместо "Абонемент в бассейн, чтобы он мог расслабиться после работы" должно быть "Абонемент в бассейн".

Ответь СТРОГО в формате JSON: списка списков [['Категория', 'Описание подарка'], ['Категория', 'Описание подарка']].
Никакого дополнительного текста, только валидный JSON.

Допустимые категории: Хобби, Техника, Книги, Одежда, Украшения, Еда, Впечатления, Для дома, Другое.

Вот отчет:
{report_text}
"""
        response_text = None

        # Шаг 1: Пробуем OpenAI gpt-4o-mini (самый стабильный JSON)
        try:
            logging.info("Attempting gift extraction using gpt-4o-mini...")
            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1
            )
            response_text = response.choices[0].message.content
        except Exception as e:
            logging.warning(f"Gift extraction failed with gpt-4o-mini: {e}. Trying deepseek via OpenRouter...")

        # Шаг 2: Пробуем OpenRouter deepseek-v4 (deepseek/deepseek-chat)
        if not response_text:
            try:
                logging.info("Attempting gift extraction using deepseek via OpenRouter...")
                response = await asyncio.to_thread(
                    self.openrouter_client.chat.completions.create,
                    model="deepseek/deepseek-chat",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1
                )
                response_text = response.choices[0].message.content
            except Exception as e:
                logging.warning(f"Gift extraction failed with deepseek: {e}. Trying Gemini SDK...")

        # Шаг 3: Пробуем Gemini SDK
        if not response_text:
            try:
                logging.info("Attempting gift extraction using gemini-2.5-flash...")
                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    model="gemini-2.5-flash",
                    contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
                    config=types.GenerateContentConfig(temperature=0.1)
                )
                response_text = response.text
            except Exception as e:
                logging.error(f"All LLM gift extraction calls failed: {e}")

        # Парсинг ответа ИИ
        if response_text:
            try:
                import json
                import re
                text = response_text.strip()
                match = re.search(r'\[\s*\[.*\]\s*\]', text, re.DOTALL)
                if match:
                    text = match.group(0)
                else:
                    text = text.replace('```json', '').replace('```', '').strip()
                gifts = json.loads(text)
                if isinstance(gifts, list) and all(isinstance(g, list) and len(g) >= 2 for g in gifts):
                    logging.info(f"Successfully extracted {len(gifts)} gifts via LLM")
                    # Clean up descriptions programmatically as post-processing
                    cleaned_gifts = []
                    for cat, desc in gifts:
                        cleaned_gifts.append([cat.strip(), self.clean_gift_description(desc)])
                    return cleaned_gifts
            except Exception as e:
                logging.error(f"Failed to parse LLM response for gifts: {e}. Response was: {response_text}")

        # Шаг 4: Резервный ручной парсинг отчета регулярными выражениями
        logging.info("Falling back to manual regex parsing of report text for gifts...")
        manual_gifts = self.extract_gifts_manually(report_text)
        logging.info(f"Manually parsed {len(manual_gifts)} gifts from report text")
        return manual_gifts

    def extract_gifts_manually(self, report_text: str) -> list:
        """Извлекает идеи подарков из текста отчета с помощью регулярных выражений."""
        import re
        gifts = []
        if not report_text:
            return gifts

        # Ищем блок подарков
        headers = ["Найденные идеи подарков", "Идеи подарков", "Найденные подарки"]
        start_idx = -1
        for h in headers:
            start_idx = report_text.find(h)
            if start_idx != -1:
                start_idx += len(h)
                break

        if start_idx == -1:
            lines = report_text.splitlines()
        else:
            remaining_text = report_text[start_idx:]
            end_idx = len(remaining_text)
            next_headers = ["Вердикт детектива", "🕵️‍♂️", "🎯", "🧩", "Статус"]
            for nh in next_headers:
                pos = remaining_text.find(nh)
                if 0 <= pos < end_idx:
                    end_idx = pos
            lines = remaining_text[:end_idx].splitlines()

        for line in lines:
            line = line.strip()
            # Буллеты: -, *, • или цифры с точкой/скобкой
            if line.startswith(('-', '*', '•')) or (line and line[0].isdigit() and ('.' in line or ')' in line)):
                parts = re.split(r'^[-*•\d.)\s]+', line)
                if len(parts) > 1 and parts[1].strip():
                    gift_desc = parts[1].strip()
                    # Очищаем скобки и технические символы
                    gift_desc = re.sub(r'\]$', '', gift_desc).strip()
                    if len(gift_desc) > 3:
                        cleaned_desc = self.clean_gift_description(gift_desc)
                        category = self.categorize_gift_by_keywords(cleaned_desc)
                        gifts.append([category, cleaned_desc])
        return gifts

    def categorize_gift_by_keywords(self, desc: str) -> str:
        """Классифицирует подарок по ключевым словам в категории."""
        desc_lower = desc.lower()
        categories = {
            "Книги": ["книга", "книг", "роман", "энциклопедия", "поэзия", "литература"],
            "Техника": ["гаджет", "наушник", "телефон", "клавиатура", "мышь", "монитор", "смартфон", "планшет", "ноутбук", "компьютер", "техник", "часы", "смарт", "зарядка", "пауэрбанк"],
            "Одежда": ["одежд", "футболка", "худи", "свитшот", "куртка", "носки", "кроссовки", "кеды", "обувь", "ремень", "шапка", "шарф"],
            "Украшения": ["украшен", "кольцо", "серьги", "браслет", "кулон", "цепочка", "ожерелье"],
            "Еда": ["еда", "шоколад", "кофе", "чай", "сладости", "конфеты", "торт", "напиток", "вино", "бокал", "вкусняшки"],
            "Впечатления": ["билет", "сертификат", "мастер-класс", "квест", "полет", "путешествие", "экскурсия", "концерт", "театр", "кино", "спа", "массаж"],
            "Для дома": ["дом", "светильник", "лампа", "плед", "подушка", "посуда", "кружка", "декор", "цветы", "растение", "увлажнитель"],
            "Хобби": ["хобби", "гитара", "музыка", "рисование", "краски", "холст", "настольная игра", "спорт", "абонемент", "фитнес", "йога", "конструктор", "лего", "lego"]
        }
        for cat, keywords in categories.items():
            for kw in keywords:
                if kw in desc_lower:
                    return cat
        return "Другое"

    def _call_gemini(self, chat_context: dict) -> str:
        model = chat_context.get("model", self.model)
        
        # Translate frontend friendly IDs to real API model IDs for ProxyAPI
        model_mapping = {
            "deepseek-v4": "deepseek/deepseek-chat",
            "deepseek-v4-pro": "deepseek/deepseek-chat",
            "claude-4-6-opus": "anthropic/claude-3-opus",
            "claude-opus-4-7": "anthropic/claude-3-opus"
        }
        api_model = model_mapping.get(model, model)
        
        try:
            if api_model.startswith("gemini"):
                response = self.client.models.generate_content(
                    model=api_model,
                    contents=chat_context["messages"],
                    config=types.GenerateContentConfig(
                        system_instruction=chat_context["system"],
                        temperature=0.8,
                    )
                )
                return response.text
            elif "/" in api_model:
                openai_msgs = _to_openai_messages(chat_context["system"], chat_context["messages"])
                response = self.openrouter_client.chat.completions.create(
                    model=api_model,
                    messages=openai_msgs,
                    temperature=0.8,
                )
                return response.choices[0].message.content
            else:
                openai_msgs = _to_openai_messages(chat_context["system"], chat_context["messages"])
                response = self.openai_client.chat.completions.create(
                    model=api_model,
                    messages=openai_msgs,
                    temperature=0.8,
                )
                return response.choices[0].message.content
        except Exception as e:
            logging.error(f"AI Call failed for model {model} (mapped: {api_model}): {e}. Attempting fallback to deepseek-v4...")
            if model == "deepseek-v4":
                raise e
            
            # Seamless fallback to default DeepSeek V4 model (via deepseek/deepseek-chat)
            openai_msgs = _to_openai_messages(chat_context["system"], chat_context["messages"])
            try:
                response = self.openrouter_client.chat.completions.create(
                    model="deepseek/deepseek-chat",
                    messages=openai_msgs,
                    temperature=0.8,
                )
                return response.choices[0].message.content
            except Exception as fallback_err:
                logging.error(f"Fallback to deepseek-v4 failed: {fallback_err}. Falling back to gemini-3.5-flash...")
                # Ultimate fallback to gemini-3.5-flash as a last resort
                try:
                    response = self.client.models.generate_content(
                        model="gemini-3.5-flash",
                        contents=chat_context["messages"],
                        config=types.GenerateContentConfig(
                            system_instruction=chat_context["system"],
                            temperature=0.8,
                        )
                    )
                    return response.text
                except Exception as ultimate_err:
                    logging.error(f"Ultimate fallback failed: {ultimate_err}")
                    raise e

    async def generate_avatar(self, prompt: str, provider: str = "gpt-image-2") -> bytes:
        """Генерирует изображение аватара детектива по текстовому описанию и возвращает байты."""
        import httpx
        logging.info(f"Generating avatar using provider/model {provider} with prompt: {prompt}")
        
        # If Gemini model is chosen
        if provider == "gemini-3-pro-image-preview":
            try:
                # Попытка через Google GenAI SDK с указанным пользователем именем модели
                response = await asyncio.to_thread(
                    self.client.models.generate_images,
                    model='gemini-3-pro-image-preview',
                    prompt=prompt,
                    config=types.GenerateImagesConfig(
                        number_of_images=1,
                        output_mime_type="image/jpeg",
                    )
                )
                if response.generated_images:
                    return response.generated_images[0].image.image_bytes
                else:
                    raise Exception("No images returned from Gemini Image Preview")
            except Exception as e:
                logging.error(f"Gemini 3 Pro Image generation failed: {e}. Falling back to gpt-image-2...")
                provider = "gpt-image-2"  # Резервный переход к OpenAI gpt-image-2
                
        # OpenAI GPT Image models
        # Map any legacy provider strings to the new ones just in case
        model_mapping = {
            "dall-e-3": "gpt-image-2",
            "dall-e-2": "gpt-image-1.5",
            "imagen-3": "gemini-3-pro-image-preview"
        }
        model = model_mapping.get(provider, provider)
        if model not in ["gpt-image-2", "gpt-image-1.5", "gpt-image-1", "gemini-3-pro-image-preview"]:
            model = "gpt-image-2"  # safe fallback
            
        size = "1024x1024"
        try:
            response = await asyncio.to_thread(
                self.openai_client.images.generate,
                model=model,
                prompt=prompt,
                n=1,
                size=size
            )
            
            # ProxyAPI returns base64_json by default. If b64_json is returned, decode and return it directly
            b64_data = getattr(response.data[0], 'b64_json', None)
            if b64_data:
                import base64
                return base64.b64decode(b64_data)
                
            image_url = getattr(response.data[0], 'url', None)
            if not image_url:
                raise Exception("Empty image returned from OpenAI (neither b64_json nor url found)")
                
            # Скачиваем изображение по ссылке (fallback)
            async with httpx.AsyncClient() as httpx_client:
                img_res = await httpx_client.get(image_url, timeout=30.0)
                if img_res.status_code == 200:
                    return img_res.content
                else:
                    raise Exception(f"Failed downloading generated image: HTTP {img_res.status_code}")
        except Exception as e:
            logging.error(f"GPT Image generation failed: {e}")
            raise Exception(f"Ошибка ИИ-генерации аватара: {str(e)}")

    async def generate_surprise_detective(self) -> dict:
        """Генерирует случайного креативного детектива с использованием ИИ."""
        prompt = """
Сгенерируй совершенно случайного, невероятно креативного, уникального и харизматичного персонажа-детектива для сервиса Giftspy.
Персонаж может быть кем угодно: от забавных животных (кот-детектив, филин-инспектор) до фантастических существ (робот с багами, кибер-ищейка, добрый призрак) или эксцентричных людей (викторианский джентльмен, сумасшедший ученый, пират).
Он должен быть привлекательным и вызывать улыбку или интерес у пользователя.

Верни СТРОГО JSON-объект со следующими полями без какого-либо дополнительного текста или markdown-разметки (не используй ```json ... ```):
{
  "name": "Имя детектива (до 32 символов)",
  "description": "Краткое описание характера и стиля общения для карточки выбора (до 150 символов)",
  "ai_description": "Подробная системная инструкция для ИИ о том, как вести себя, писать коротко (1-3 предложения), какой характер поддерживать. Не включай коронную фразу сюда.",
  "specialty": "Уникальная специализация (до 40 символов, например: 'Кошачий гипноз 🐾')",
  "emojis": "Список из 3-5 любимых эмодзи через запятую (например: '🐱, 🕵️‍♂️, 🐟, 🎁, ✨')",
  "opening_phrase": "Коронная приветственная фраза, с которой детектив начнет диалог с целью (например: 'Мур-р... Здравствуйте! На связи Инспектор Мурлок...')",
  "skills": [
    {
      "label": "Название характеристики 1 с эмодзи (например, 'Дедукция 🧠')",
      "val": число от 80 до 100,
      "color": "HEX-код цвета (например, '#6c5ce7')"
    },
    {
      "label": "Название характеристики 2 с эмодзи",
      "val": число от 80 до 100,
      "color": "HEX-код цвета"
    },
    {
      "label": "Название характеристики 3 с эмодзи",
      "val": число от 80 до 100,
      "color": "HEX-код цвета"
    }
  ],
  "avatar_prompt": "Подробное описание внешности персонажа на английском языке для генератора изображений. Опиши его как: 'A premium 3D isometric stylized character avatar of... Game profile icon, dark atmospheric background, highly detailed rendering'"
}

Отвечай строго на русском языке (кроме поля avatar_prompt). Все текстовые поля должны быть заполнены качественно и с душой.
"""
        response_text = None
        try:
            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=1.0  # High temperature for maximum creativity!
            )
            response_text = response.choices[0].message.content
        except Exception as e:
            logging.warning(f"Surprise detective generation failed with gpt-4o-mini: {e}. Trying Gemini...")

        if not response_text:
            try:
                response = await asyncio.to_thread(
                    self.client.models.generate_content,
                    model="gemini-2.5-flash",
                    contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
                    config=types.GenerateContentConfig(temperature=1.0)
                )
                response_text = response.text
            except Exception as e:
                logging.error(f"Failed all calls for surprise detective: {e}")
                raise e

        if response_text:
            try:
                import json
                import re
                text = response_text.strip()
                match = re.search(r'\{.*\}', text, re.DOTALL)
                if match:
                    text = match.group(0)
                else:
                    text = text.replace('```json', '').replace('```', '').strip()
                data = json.loads(text)
                return data
            except Exception as e:
                logging.error(f"Failed to parse surprise detective JSON: {e}. Response was: {response_text}")
                raise e
        raise Exception("Failed to generate creative detective persona")

