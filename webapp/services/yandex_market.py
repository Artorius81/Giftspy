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

def generate_svg_placeholder(title: str) -> str:
    """Generate a clean, beautiful gradient SVG placeholder with the first letter of the product."""
    first_letter = title[0].upper() if title else "🎁"
    
    # Elegant color gradients for placeholder cards
    gradients = [
        ('<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">'
         '<stop offset="0%" stop-color="#6c5ce7"/>'
         '<stop offset="100%" stop-color="#a78bfa"/>'
         '</linearGradient>'),
        ('<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">'
         '<stop offset="0%" stop-color="#f093fb"/>'
         '<stop offset="100%" stop-color="#f5576c"/>'
         '</linearGradient>'),
        ('<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">'
         '<stop offset="0%" stop-color="#4facfe"/>'
         '<stop offset="100%" stop-color="#00f2fe"/>'
         '</linearGradient>')
    ]
    # Pick gradient based on product title length
    selected_gradient = gradients[len(title) % len(gradients)]
    
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="100%" height="100%">'
        f'<defs>{selected_gradient}</defs>'
        f'<rect width="100%" height="100%" fill="url(#g)" rx="16"/>'
        f'<text x="50%" y="55%" font-family="system-ui, sans-serif" font-size="72" font-weight="bold" '
        f'fill="#ffffff" dominant-baseline="middle" text-anchor="middle">{first_letter}</text>'
        f'</svg>'
    )
    # Convert SVG to inline Data URI
    encoded_svg = urllib.parse.quote(svg)
    return f"data:image/svg+xml,{encoded_svg}"

def extract_json_ld_from_html(html: str) -> dict | None:
    """Extract Schema.org JSON-LD microdata from Product page HTML."""
    try:
        soup = BeautifulSoup(html, "html.parser")
        tags = soup.find_all("script", type="application/ld+json")
        for tag in tags:
            try:
                data = json.loads(tag.string)
                # JSON-LD can be a list or a direct object
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
                        
                        # Process image (can be list or string)
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

def fetch_yandex_search_results(query: str) -> list[dict]:
    """
    Search Yandex Search API v2 for market product pages.
    Returns list of basic results (url, raw_title, snippet).
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
        "responseFormat": "FORMAT_XML"
    }
    
    logger.info(f"Searching Yandex Search API v2: {search_query}")
    
    try:
        response = requests.post(url, headers=headers, json=body, timeout=7)
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
            # Filter URLs: we want products/cards, not reviews, catalogs, or question pages
            if not doc_url:
                continue
            if not ("/product/" in doc_url or "/product--" in doc_url or "/card/" in doc_url):
                continue
            if "/reviews" in doc_url or "/questions" in doc_url or "/search?" in doc_url:
                continue
            
            raw_title = clean_xml_text(doc.find("title"))
            
            # Combine snippets and passages for fallback description
            headline = clean_xml_text(doc.find("headline"))
            passages = " ".join([clean_xml_text(p) for p in doc.find_all("passage")])
            snippet = f"{headline} {passages}".strip()
            
            results.append({
                "url": doc_url,
                "raw_title": raw_title,
                "snippet": snippet
            })
            
            # Limit to top 5 products to avoid excessive parsing
            if len(results) >= 5:
                break
                
        return results
    except Exception as e:
        logger.error(f"Failed to query Yandex XML v2: {e}")
        return []

def get_product_details_hybrid(doc: dict) -> dict:
    """
    Hybrid extractor: attempts to load the page and read JSON-LD.
    Falls back to Yandex Search Snippet parsing on failure.
    """
    url = doc["url"]
    raw_title = doc["raw_title"]
    snippet = doc["snippet"]
    
    clean_title = clean_product_title(raw_title)
    fallback_price = parse_price_from_text(snippet)
    
    # Try fetching the actual page for rich data
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Connection": "keep-alive"
    }
    
    logger.info(f"Attempting to parse JSON-LD from direct card: {url}")
    try:
        # Short timeout: we don't want to hang the main thread
        response = requests.get(url, headers=headers, timeout=4)
        if response.status_code == 200:
            details = extract_json_ld_from_html(response.text)
            if details:
                logger.info(f"Successfully extracted JSON-LD details for: {details['title']}")
                # Clean the JSON-LD title just in case
                details["title"] = clean_product_title(details["title"])
                # Fallback image if JSON-LD image is empty
                if not details.get("image"):
                    details["image"] = generate_svg_placeholder(details["title"])
                details["url"] = url
                return details
            else:
                logger.warning(f"No JSON-LD Product schema found in {url}")
        else:
            logger.warning(f"Failed to fetch product page (HTTP {response.status_code}) for: {url}")
    except Exception as e:
        logger.warning(f"Error fetching product page {url}: {e}")
        
    # FALLBACK LOGIC: use search snippets and generate beautiful visual gradient svg
    logger.info(f"Falling back to snippet extraction for: {clean_title}")
    return {
        "title": clean_title,
        "description": snippet or "Описание доступно при переходе на сайт.",
        "image": generate_svg_placeholder(clean_title),
        "price": fallback_price,
        "currency": "RUB",
        "url": url
    }

def get_yandex_market_suggestions(product_name: str) -> list[dict]:
    """
    Main entry point: searches Yandex and extracts product cards.
    """
    if not product_name or len(product_name.strip()) < 2:
        return []
        
    docs = fetch_yandex_search_results(product_name)
    if not docs:
        return []
        
    cards = []
    for doc in docs:
        card = get_product_details_hybrid(doc)
        # Add market referral clid in production if desired
        # card["url"] = f"{card['url']}?clid=YOUR_PARTNER_CLID"
        cards.append(card)
        
    return cards
