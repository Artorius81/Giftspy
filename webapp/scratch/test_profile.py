import asyncio
import logging
import sys
import os

# Add project root to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

logging.basicConfig(level=logging.INFO)

from database import db

async def test():
    print("Initializing DB...")
    await db.init_db()
    print("Testing get_user_profile for user_id 1...")
    try:
        res = await db.get_user_profile(1)
        print("Success! Profile:", res)
    except Exception as e:
        print("Failed get_user_profile:", e)
        logging.exception(e)

if __name__ == "__main__":
    asyncio.run(test())
