from telethon.sync import TelegramClient

# Впиши свои данные
API_ID = 32732137
API_HASH = '68bfc44cd76a71af6edcc72455e85c59'
PHONE = '+79294279309' # Твой номер Детектива (с плюсом)

print("🚀 Запускаем процесс авторизации...")

# Используем синхронного клиента, он не "зависает" в PyCharm
with TelegramClient('user_session', API_ID, API_HASH) as client:
    print("Отправляем запрос на код...")
    client.start(phone=PHONE)
    print("✅ УРА! Авторизация прошла успешно. Файл user_session.session создан!")