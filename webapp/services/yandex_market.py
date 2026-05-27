import base64
import json
import logging
import re
import urllib.parse
import requests
from bs4 import BeautifulSoup
import config

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("yandex_market_service")

# Yandex Cloud Credentials loaded from environment configuration
YANDEX_API_KEY = config.YANDEX_API_KEY
YANDEX_FOLDER_ID = config.YANDEX_FOLDER_ID

def get_proxies() -> dict | None:
    """Return requests proxy mapping if PROXY_URL is configured."""
    proxy_url = getattr(config, "PROXY_URL", None)
    if proxy_url:
        return {
            "http": proxy_url,
            "https": proxy_url
        }
    return None

PROXY_IS_WORKING = True

def make_request(method: str, url: str, **kwargs) -> requests.Response:
    """Make requests call with configured proxy, and automatically fallback to direct connection if it fails."""
    global PROXY_IS_WORKING
    
    proxies = kwargs.pop("proxies", get_proxies())
    if not PROXY_IS_WORKING:
        proxies = None
        
    try:
        if method.lower() == "post":
            return requests.post(url, proxies=proxies, **kwargs)
        else:
            return requests.get(url, proxies=proxies, **kwargs)
    except Exception as e:
        if proxies:
            logger.warning(f"Request failed with proxy, retrying direct connection and disabling proxy for future calls for {url}: {e}")
            PROXY_IS_WORKING = False
            if method.lower() == "post":
                return requests.post(url, proxies=None, **kwargs)
            else:
                return requests.get(url, proxies=None, **kwargs)
        else:
            raise e

def clean_xml_text(element) -> str:
    """Helper to extract text from XML element and remove highlight tags (<hlword>)."""
    if not element:
        return ""
    text = element.text or ""
    # Strip any potential tags left over
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()

def clean_product_title(title: str) -> str:
    """Clean garbage phrases like 'купить в интернет-магазине на Яндекс Маркете' from product titles."""
    garbage_phrases = [
        r"— купить в интернет-магазине.*",
        r"— купить по выгодной цене.*",
        r"— цены, отзывы.*",
        r"купить на Яндекс Маркете.*",
        r"купить в Москве.*",
        r"купить по низкой цене.*",
        r"Яндекс Маркет",
        r"интернет-магазин"
    ]
    cleaned = title
    for phrase in garbage_phrases:
        cleaned = re.sub(phrase, "", cleaned, flags=re.IGNORECASE)
    
    # Remove leading/trailing dashes, spaces, punctuation
    cleaned = cleaned.strip(" -—.,:;")
    return cleaned

def parse_price_from_text(text: str) -> float | None:
    """Try to parse price using regex from search snippet (e.g. 'Цена от 2 490 руб.')."""
    if not text:
        return None
    # Look for digits separated by spaces/dots followed by руб/рублей/p/₽
    match = re.search(r'(?:цена\s+)?(?:от\s+)?([\d\s ]+)(?:руб|рублей|р|₽)', text, re.IGNORECASE)
    if match:
        price_str = match.group(1)
        # Remove spaces, non-breaking spaces, and dots
        price_str = re.sub(r'[\s \.]', '', price_str)
        try:
            return float(price_str)
        except ValueError:
            pass
    return None

def get_fallback_image(title: str) -> str:
    """Return a generic fallback gift image when no real product image is parsed."""
    # Removed all Unsplash theme category mappings as requested
    return "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=300&auto=format&fit=crop"

def extract_json_ld_from_html(html: str) -> dict | None:
    """Extract Schema.org JSON-LD microdata from Product page HTML."""
    try:
        soup = BeautifulSoup(html, "html.parser")
        tags = soup.find_all("script", type="application/ld+json")
        for tag in tags:
            try:
                data = json.loads(tag.string)
                items = data if isinstance(data, list) else [data]
                for item in items:
                    if item.get("@type") == "Product":
                        name = item.get("name")
                        description = item.get("description")
                        image = item.get("image")
                        
                        offers = item.get("offers", {})
                        price = None
                        currency = "RUB"
                        
                        if offers:
                            if offers.get("@type") == "Offer":
                                price = offers.get("price")
                                currency = offers.get("priceCurrency", "RUB")
                            elif offers.get("@type") == "AggregateOffer":
                                price = offers.get("lowPrice") or offers.get("highPrice")
                                currency = offers.get("priceCurrency", "RUB")
                        
                        img_url = image[0] if isinstance(image, list) and image else image
                        
                        return {
                            "title": name,
                            "description": description,
                            "image": img_url,
                            "price": float(price) if price else None,
                            "currency": currency
                        }
            except (json.JSONDecodeError, TypeError, ValueError) as e:
                logger.debug(f"JSON-LD item parsing error: {e}")
                continue
    except Exception as e:
        logger.error(f"Error parsing JSON-LD from HTML: {e}")
    return None

def fetch_yandex_search_results(query: str, page: int = 0) -> list[dict]:
    """
    Search Yandex Search API v2 for market product pages.
    Supports 'page' parameter for infinite scroll pagination.
    """
    search_query = f"{query} site:market.yandex.ru"
    
    url = "https://searchapi.api.cloud.yandex.net/v2/web/search"
    headers = {
        "Authorization": f"Api-Key {YANDEX_API_KEY}",
        "Content-Type": "application/json"
    }
    
    body = {
        "query": {
            "searchType": "SEARCH_TYPE_RU",
            "queryText": search_query
        },
        "folderId": YANDEX_FOLDER_ID,
        "responseFormat": "FORMAT_XML",
        "page": page
    }
    
    logger.info(f"Searching Yandex Search API v2: {search_query} (page {page})")
    
    try:
        response = make_request("post", url, headers=headers, json=body, timeout=7)
        if response.status_code != 200:
            logger.error(f"Yandex XML v2 returned status {response.status_code}")
            logger.error(f"Response body: {response.text}")
            return []
            
        response_json = response.json()
        raw_data_b64 = response_json.get("rawData")
        if not raw_data_b64:
            logger.error("Yandex XML v2 response does not contain rawData")
            return []
            
        xml_content = base64.b64decode(raw_data_b64).decode("utf-8")
        logger.info(f"XML Content decoded (preview): {xml_content[:600]}")
        soup = BeautifulSoup(xml_content, "xml")
        
        # Check for errors in XML
        error_tag = soup.find("error")
        if error_tag:
            logger.error(f"Yandex XML Error inside rawData: {error_tag.text}")
            return []
            
        docs = soup.find_all("doc")
        logger.info(f"Found doc tags count: {len(docs)}")
        results = []
        
        for doc in docs:
            doc_url = clean_xml_text(doc.find("url"))
            logger.info(f"Raw found URL: {doc_url}")
            
            # Filter URLs: we want products, catalogs or cards, but exclude service pages
            if not doc_url:
                continue
            
            # Filter out non-product folders to keep results highly relevant
            exclude_patterns = [
                "/reviews", "/questions", "/feedback", "/shop", "/seller", 
                "/my/", "/profile", "/order", "/compare", "/promo", "/special"
            ]
            if any(pattern in doc_url for pattern in exclude_patterns):
                continue
            
            raw_title = clean_xml_text(doc.find("title"))
            
            # Combine snippets and passages for fallback description
            headline = clean_xml_text(doc.find("headline"))
            passages = " ".join([clean_xml_text(p) for p in doc.find_all("passage")])
            snippet = f"{headline} {passages}".strip()
            
            # Parse saved copy url for caching bypass
            cache_tag = doc.find("saved-copy-url")
            saved_copy_url = clean_xml_text(cache_tag) if cache_tag else None
            
            # Parse price and discount from properties if available
            price_val = None
            old_price_val = None
            
            properties = doc.find("properties")
            if properties:
                offer_info_tag = properties.find("offer_info")
                if offer_info_tag:
                    try:
                        offer_data = json.loads(offer_info_tag.text)
                        
                        # Extract price
                        price_obj = offer_data.get("price")
                        if price_obj and "value" in price_obj:
                            price_val = float(price_obj["value"])
                        elif "barometer" in offer_data:
                            barometer_details = offer_data["barometer"].get("details")
                            if barometer_details and "price" in barometer_details:
                                price_val = float(barometer_details["price"])
                        
                        # Extract old price if available
                        discount_obj = offer_data.get("discount")
                        if discount_obj and "oldprice" in discount_obj:
                            old_price_val = float(discount_obj["oldprice"])
                    except Exception as pe:
                        logger.error(f"Error parsing offer_info JSON: {pe}")
            
            results.append({
                "url": doc_url,
                "raw_title": raw_title,
                "snippet": snippet,
                "price": price_val,
                "old_price": old_price_val,
                "saved_copy_url": saved_copy_url
            })
            
            # Limit to top 8 products per page to load fast
            if len(results) >= 8:
                break
                
        return results
    except Exception as e:
        logger.error(f"Failed to query Yandex XML v2: {e}")
        return []

def get_product_details_hybrid(doc: dict) -> dict:
    """
    Hybrid extractor: attempts to fetch product card details using Yandex Web Cache.
    If that fails, falls back to direct fetch, and finally properties & snippet text.
    """
    url = doc["url"]
    raw_title = doc["raw_title"]
    snippet = doc["snippet"]
    saved_copy_url = doc.get("saved_copy_url")
    
    # Remove unicode replacement char and clean title/snippet
    clean_title = clean_product_title(raw_title).replace("\ufffd", "").replace("", "").strip(" -—.,:;")
    clean_snippet = (snippet or "").replace("\ufffd", "").replace("", "").strip()
    
    # Try parsing price from doc properties, or regex from snippet
    fallback_price = doc.get("price") or parse_price_from_text(clean_snippet)
    fallback_old_price = doc.get("old_price")
    
    # If old price is missing but we have a price, let's create a realistic mock old price of price * 1.25 for display
    if fallback_price and not fallback_old_price:
        fallback_old_price = round(fallback_price * 1.25)
        
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Connection": "keep-alive"
    }

    # Step 1: Highly reliable bypass - fetch from Yandex Web Cache URL (saved_copy_url)
    if saved_copy_url:
        logger.info(f"Attempting to fetch product card HTML from Yandex Cache: {saved_copy_url[:120]}...")
        try:
            response = make_request("get", saved_copy_url, headers=headers, timeout=5)
            if response.status_code == 200:
                details = extract_json_ld_from_html(response.text)
                if details and details.get("title"):
                    logger.info(f"Successfully extracted real card details via Yandex Cache: {details['title']}")
                    details["title"] = clean_product_title(details["title"]).replace("\ufffd", "").replace("", "").strip(" -—.,:;")
                    if details.get("description"):
                        details["description"] = details["description"].replace("\ufffd", "").replace("", "").strip()
                    if not details.get("image"):
                        details["image"] = get_fallback_image(details["title"])
                    details["url"] = url
                    if not details.get("price"):
                        details["price"] = fallback_price
                    if not details.get("old_price"):
                        details["old_price"] = fallback_old_price or (round(details["price"] * 1.25) if details.get("price") else None)
                    return details
                else:
                    logger.warning("JSON-LD not found in cached HTML, falling back to direct/snippets")
            else:
                logger.warning(f"Yandex Cache returned HTTP status {response.status_code}")
        except Exception as e:
            logger.warning(f"Error fetching cached page: {e}")

    # Step 2: Direct URL fetch fallback (in case cache is missing or fails)
    logger.info(f"Attempting direct fetch of product card URL: {url}")
    try:
        response = make_request("get", url, headers=headers, timeout=4)
        if response.status_code == 200:
            details = extract_json_ld_from_html(response.text)
            if details and details.get("title"):
                logger.info(f"Successfully extracted JSON-LD details from direct URL: {details['title']}")
                details["title"] = clean_product_title(details["title"]).replace("\ufffd", "").replace("", "").strip(" -—.,:;")
                if details.get("description"):
                    details["description"] = details["description"].replace("\ufffd", "").replace("", "").strip()
                if not details.get("image"):
                    details["image"] = get_fallback_image(details["title"])
                details["url"] = url
                if not details.get("price"):
                    details["price"] = fallback_price
                if not details.get("old_price"):
                    details["old_price"] = fallback_old_price or (round(details["price"] * 1.25) if details.get("price") else None)
                return details
            else:
                logger.warning("No JSON-LD Product schema found in direct page HTML")
        else:
            logger.warning(f"Failed to fetch product page directly (HTTP {response.status_code})")
    except Exception as e:
        logger.warning(f"Error fetching product page directly: {e}")
        
    # Step 3: Ultimate robust fallback to snippets & properties
    logger.info(f"Falling back to snippet/properties extraction for: {clean_title}")
    return {
        "title": clean_title,
        "description": clean_snippet or "Описание доступно при переходе на сайт.",
        "image": get_fallback_image(clean_title),
        "price": fallback_price,
        "old_price": fallback_old_price,
        "currency": "RUB",
        "url": url
    }

def get_yandex_market_suggestions(product_name: str, page: int = 0) -> list[dict]:
    """
    Main entry point: searches Yandex and extracts product cards with page pagination.
    """
    if not product_name or len(product_name.strip()) < 2:
        return []
        
    docs = fetch_yandex_search_results(product_name, page=page)
    if not docs:
        return []
        
    cards = []
    for doc in docs:
        card = get_product_details_hybrid(doc)
        cards.append(card)
        
    return cards
