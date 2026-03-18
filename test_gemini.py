import asyncio
import logging
from services.ai_detective import AIDetectiveService

async def main():
    service = AIDetectiveService()
    chat_context = await service.restore_chat_from_db(999999, "День Рождения", "Любит IT, программирование", "Гика", "до 5000 руб")
    print("--- SYSTEM PROMPT ---")
    print(chat_context["system"])
    print("--- CHAT MESSAGES START ---")
    for m in chat_context["messages"]:
        print(f"[{m.role}]: {m.parts[0].text}")
    print("--- CHAT MESSAGES END ---")
    
    print("\nGenerating First Message...")
    res = await service.generate_first_message(chat_context)
    print("RESPONSE:")
    print(res)

if __name__ == "__main__":
    logging.basicConfig(level=logging.ERROR, filename="test_gemini.log", filemode="w", encoding="utf-8")
    asyncio.run(main())
