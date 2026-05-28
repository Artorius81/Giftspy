import sys
sys.path.append('c:/projects/Giftspy')
import logging
import asyncio
from google import genai
from google.genai import types
import config

logging.basicConfig(level=logging.INFO)

async def test_model(model_name):
    print(f"\n--- Testing model: {model_name} ---")
    client = genai.Client(
        api_key=config.OPENROUTER_API_KEY,
        http_options={"api_version": "v1beta", "base_url": "https://api.proxyapi.ru/google/"},
    )
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=[types.Content(role="user", parts=[types.Part.from_text(text="Say Hello!")])],
        )
        print(f"Success! Response: {response.text}")
        return True
    except Exception as e:
        print(f"Failed: {e}")
        return False

async def main():
    models = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"]
    for m in models:
        await test_model(m)

if __name__ == "__main__":
    asyncio.run(main())
