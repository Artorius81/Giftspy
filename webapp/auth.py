"""
Telegram Mini App authentication.
Validates initData from Telegram WebApp SDK using HMAC-SHA256.
"""
import hashlib
import hmac
import json
import urllib.parse
from typing import Optional

import config


def validate_init_data(init_data: str) -> Optional[dict]:
    """
    Validates Telegram WebApp initData and returns user data if valid.
    See: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    """
    try:
        parsed = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
        
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            return None
        
        # Build data-check-string: sort keys alphabetically, join with \n
        data_check_string = "\n".join(
            f"{k}={v}" for k, v in sorted(parsed.items())
        )
        
        # Secret key = HMAC-SHA256(bot_token, "WebAppData")
        secret_key = hmac.new(
            b"WebAppData", config.BOT_TOKEN.encode(), hashlib.sha256
        ).digest()
        
        # Calculate hash
        calculated_hash = hmac.new(
            secret_key, data_check_string.encode(), hashlib.sha256
        ).hexdigest()
        
        if calculated_hash != received_hash:
            return None
        
        # Extract user info
        user_data = parsed.get("user")
        if user_data:
            return json.loads(user_data)
        
        return None
    except Exception:
        return None


def get_user_id_from_init_data(init_data: str) -> Optional[int]:
    """Extract and validate user_id from Telegram initData."""
    user = validate_init_data(init_data)
    if user and "id" in user:
        return int(user["id"])
    return None
