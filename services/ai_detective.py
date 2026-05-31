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
[Перечисли все конкретные идеи подарков, которые удалось выяснить в ходе беседы, с четкими примерами того, что именно можно подарить цели. Формулируй их как понятные развернутые варианты с дефисом, каждый с новой строки.
Пример:
- Механическая клавиатура (например, беспроводная Keychron K2 с тихими переключателями) — отлично подойдёт для его вечерней работы.]

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
        
    async def create_new_chat(self, holiday, context, persona, budget, ai_model="deepseek-v4"):
         personas = await db.get_personas()
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
         personas = await db.get_personas()
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
        except Exception as e:
            logging.error(f"Error generating question: {e}")
            return [greeting]
        
        return [greeting, question] if question else [greeting]

    async def generate_first_message(self, chat_context: dict):
        """Legacy: generates a single first message."""
        first_msg_prompt = "Начни диалог прямо сейчас. Поздоровайся, представься и задай первый вопрос! Помни: КОРОТКО!"
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

