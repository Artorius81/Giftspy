from google import genai

GEMINI_API_KEY = 'AIzaSyCkHO8GHkUboHUm5OJnFlBYDDxo1brTDOM' # Вставь свой ключ
genai.client(api_key=GEMINI_API_KEY)

print("Доступные модели для генерации текста:")
for m in genai.version():
    if 'generateContent' in m.supported_generation_methods:
        print(m.name)

        # ================= НАСТРОЙКИ =================
        TELEGRAM_API_ID = 32732137  # ЗАМЕНИ НА СВОЙ API_ID (без кавычек)
        TELEGRAM_API_HASH = '68bfc44cd76a71af6edcc72455e85c59'  # ЗАМЕНИ НА СВОЙ HASH
        GEMINI_API_KEY = 'AIzaSyCkHO8GHkUboHUm5OJnFlBYDDxo1brTDOM'  # ЗАМЕНИ НА КЛЮЧ ОТ GOOGLE AI STUDIO