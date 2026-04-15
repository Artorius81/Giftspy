"""
Marketplace parsers for Giftspy.
Searches Ozon, Wildberries, and Yandex Market for products.
"""
import asyncio
import logging
from typing import Optional
from urllib.parse import quote

import aiohttp

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Accept": "application/json",
    "Accept-Language": "ru-RU,ru;q=0.9",
}

TIMEOUT = aiohttp.ClientTimeout(total=10)


async def search_wildberries(query: str, limit: int = 20) -> list[dict]:
    """Search Wildberries using their public search API."""
    url = "https://search.wb.ru/exactmatch/ru/common/v7/search"
    params = {
        "ab_testing": "false",
        "appType": "1",
        "curr": "rub",
        "dest": "-1257786",
        "query": query,
        "resultset": "catalog",
        "sort": "popular",
        "spp": "30",
        "suppressSpellcheck": "false",
    }

    try:
        async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
            async with session.get(url, params=params, headers=HEADERS) as resp:
                if resp.status != 200:
                    logger.warning(f"WB search returned {resp.status}")
                    return []
                data = await resp.json(content_type=None)

        products = data.get("data", {}).get("products", [])
        results = []
        for p in products[:limit]:
            nm_id = p.get("id", 0)
            # WB image URL pattern: basket number derived from nm_id
            vol = nm_id // 100000
            part = nm_id // 1000
            if vol >= 0 and vol <= 143:
                basket = "01"
            elif vol <= 287:
                basket = "02"
            elif vol <= 431:
                basket = "03"
            elif vol <= 719:
                basket = "04"
            elif vol <= 1007:
                basket = "05"
            elif vol <= 1061:
                basket = "06"
            elif vol <= 1115:
                basket = "07"
            elif vol <= 1169:
                basket = "08"
            elif vol <= 1313:
                basket = "09"
            elif vol <= 1601:
                basket = "10"
            elif vol <= 1655:
                basket = "11"
            elif vol <= 1919:
                basket = "12"
            elif vol <= 2045:
                basket = "13"
            elif vol <= 2189:
                basket = "14"
            elif vol <= 2405:
                basket = "15"
            elif vol <= 2621:
                basket = "16"
            elif vol <= 2837:
                basket = "17"
            else:
                basket = "18"

            image_url = f"https://basket-{basket}.wbbasket.ru/vol{vol}/part{part}/{nm_id}/images/c246x328/1.webp"

            price = p.get("sizes", [{}])[0].get("price", {}).get("total", 0)
            price_rub = price // 100 if price else 0

            results.append({
                "id": str(nm_id),
                "title": p.get("name", ""),
                "price": price_rub,
                "image": image_url,
                "url": f"https://www.wildberries.ru/catalog/{nm_id}/detail.aspx",
                "rating": p.get("reviewRating", 0),
                "reviews": p.get("feedbacks", 0),
                "marketplace": "wildberries",
            })
        return results
    except Exception as e:
        logger.error(f"WB search error: {e}")
        return []


async def search_ozon(query: str, limit: int = 20) -> list[dict]:
    """Search Ozon using their public mobile API."""
    url = "https://www.ozon.ru/api/composer-api.bx/page/json/v2"
    params = {
        "url": f"/search/?text={quote(query)}&from_global=true",
    }
    headers = {
        **HEADERS,
        "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    }

    try:
        async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
            async with session.get(url, params=params, headers=headers) as resp:
                if resp.status != 200:
                    logger.warning(f"Ozon search returned {resp.status}")
                    return []
                data = await resp.json(content_type=None)

        results = []
        # Navigate Ozon's nested response structure
        widget_states = data.get("widgetStates", {})

        for key, value in widget_states.items():
            if "searchResultsV2" not in key:
                continue
            import json
            if isinstance(value, str):
                try:
                    value = json.loads(value)
                except json.JSONDecodeError:
                    continue

            items = value.get("items", [])
            for item in items[:limit]:
                main_state = item.get("mainState", [])
                title = ""
                price_str = ""
                image = ""

                # Extract atom data
                for block in main_state:
                    for atom in block.get("atom", {}).get("textAtom", {}) if "atom" in block else []:
                        pass

                # Simpler: use cellTrackingInfo if available
                tracking = item.get("cellTrackingInfo", {})
                if not tracking:
                    continue

                title = tracking.get("title", "")
                price_val = tracking.get("price", 0)
                item_id = tracking.get("id", "")
                availability = tracking.get("availability", 0)

                if not title or not item_id:
                    continue

                # Try to get image from tileImage
                tile_image = item.get("tileImage", {})
                if tile_image:
                    images_list = tile_image.get("items", [])
                    if images_list:
                        image = images_list[0].get("image", {}).get("link", "")

                # Fallback: mainState image
                if not image:
                    for block in main_state:
                        if "atom" in block:
                            atom = block["atom"]
                            if "image" in atom:
                                image = atom["image"].get("link", "")
                                if image:
                                    break

                try:
                    price_clean = int(float(str(price_val).replace("\u2009", "").replace(" ", "").replace("₽", "")))
                except (ValueError, TypeError):
                    price_clean = 0

                results.append({
                    "id": str(item_id),
                    "title": title,
                    "price": price_clean,
                    "image": image,
                    "url": f"https://www.ozon.ru/product/{item_id}/",
                    "rating": tracking.get("rating", 0),
                    "reviews": tracking.get("countItems", 0),
                    "marketplace": "ozon",
                })

            if results:
                break

        return results[:limit]
    except Exception as e:
        logger.error(f"Ozon search error: {e}")
        return []


async def search_yandex_market(query: str, limit: int = 20) -> list[dict]:
    """Search Yandex Market using their public API."""
    url = "https://market.yandex.ru/api/search"
    params = {
        "text": query,
        "cvredirect": "0",
        "adult": "0",
        "onstock": "1",
    }
    headers = {
        **HEADERS,
        "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
    }

    try:
        async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
            async with session.get(url, params=params, headers=headers) as resp:
                if resp.status != 200:
                    logger.warning(f"YMarket search returned {resp.status}")
                    return []
                data = await resp.json(content_type=None)

        results = []
        # Try different response structures
        search_result = data.get("searchResult", data.get("results", {}))
        items = []

        if isinstance(search_result, dict):
            items = search_result.get("results", search_result.get("items", []))
        elif isinstance(search_result, list):
            items = search_result

        for item in items[:limit]:
            offer = item.get("offers", {}).get("items", [{}])[0] if "offers" in item else item
            title = item.get("title", item.get("name", offer.get("title", "")))
            item_id = str(item.get("id", offer.get("id", "")))

            # Price extraction
            price_info = offer.get("price", item.get("price", {}))
            price_val = 0
            if isinstance(price_info, dict):
                price_val = price_info.get("value", price_info.get("min", 0))
            elif isinstance(price_info, (int, float)):
                price_val = int(price_info)

            # Image
            image = ""
            photos = item.get("photos", item.get("pictures", []))
            if photos:
                photo = photos[0]
                if isinstance(photo, dict):
                    image = photo.get("url", photo.get("original", ""))
                elif isinstance(photo, str):
                    image = photo

            if not image:
                thumb = item.get("thumb", item.get("picture", ""))
                if thumb:
                    image = thumb

            if not title or not item_id:
                continue

            try:
                price_clean = int(float(str(price_val).replace("\u2009", "").replace(" ", "").replace("₽", "")))
            except (ValueError, TypeError):
                price_clean = 0

            rating_info = item.get("rating", {})
            rating = 0
            if isinstance(rating_info, dict):
                rating = rating_info.get("value", 0)
            elif isinstance(rating_info, (int, float)):
                rating = rating_info

            results.append({
                "id": item_id,
                "title": title,
                "price": price_clean,
                "image": image,
                "url": f"https://market.yandex.ru/product/{item_id}",
                "rating": rating,
                "reviews": item.get("opinions", 0),
                "marketplace": "yandex_market",
            })

        return results[:limit]
    except Exception as e:
        logger.error(f"YMarket search error: {e}")
        return []


MARKETPLACE_PARSERS = {
    "wildberries": search_wildberries,
    "ozon": search_ozon,
    "yandex_market": search_yandex_market,
}


async def search_marketplaces(
    query: str,
    marketplaces: list[str] | None = None,
    limit: int = 20,
) -> dict[str, list[dict]]:
    """
    Search across multiple marketplaces concurrently.
    Returns dict keyed by marketplace name with product lists.
    """
    if not marketplaces:
        marketplaces = list(MARKETPLACE_PARSERS.keys())

    tasks = {}
    for mp in marketplaces:
        parser = MARKETPLACE_PARSERS.get(mp)
        if parser:
            tasks[mp] = asyncio.create_task(parser(query, limit))

    results = {}
    for mp, task in tasks.items():
        try:
            results[mp] = await task
        except Exception as e:
            logger.error(f"Search task failed for {mp}: {e}")
            results[mp] = []

    return results
