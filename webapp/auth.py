"""
Telegram Mini App authentication.
Validates initData from Telegram WebApp SDK using HMAC-SHA256.
"""
import hashlib
import hmac
import json
import logging
import urllib.parse
from typing import Optional

import config

logger = logging.getLogger("webapp.auth")


def validate_init_data(init_data: str) -> Optional[dict]:
    """
    Validates Telegram WebApp initData and returns user data if valid.
    See: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    """
    try:
        if not init_data:
            logger.warning("validate_init_data: init_data is empty!")
            return None

        parsed = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
        
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            logger.warning("validate_init_data: hash is missing from init_data!")
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
            logger.warning(
                f"validate_init_data: HASH MISMATCH!\n"
                f"  Calculated: {calculated_hash}\n"
                f"  Received:   {received_hash}\n"
                f"  Data string: {data_check_string!r}\n"
                f"  Using token: {config.BOT_TOKEN[:10]}...{config.BOT_TOKEN[-5:] if len(config.BOT_TOKEN) > 5 else ''}"
            )
            return None
        
        # Extract user info
        user_data = parsed.get("user")
        if user_data:
            return json.loads(user_data)
        
        logger.warning("validate_init_data: user field not found in parsed data")
        return None
    except Exception as e:
        logger.exception(f"validate_init_data: Exception during validation: {e}")
        return None


def get_user_id_from_init_data(init_data: str) -> Optional[int]:
    """Extract and validate user_id from Telegram initData."""
    user = validate_init_data(init_data)
    if user and "id" in user:
        return int(user["id"])
    return None
