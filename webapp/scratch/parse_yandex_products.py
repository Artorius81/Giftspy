import requests
from bs4 import BeautifulSoup
import sys
import os
import json

# Add root folder to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import config
from webapp.services.yandex_market import make_request

def test_parse():
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Connection": "keep-alive"
    }
    
    query = "Bosch TSM6A013B"
    url = f"https://yandex.ru/products/search?text={requests.utils.quote(query)}"
    
    try:
        response = make_request("get", url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Write HTML to a file to inspect if needed
        with open("webapp/scratch/yandex_products_search.html", "w", encoding="utf-8") as f:
            f.write(response.text)
            
        print("HTML successfully saved.")
        
        # Let's search for potential product card elements
        # Usually Yandex Products page has elements with classes like:
        # "ProductCard", "ProductCard-Title", "ProductCard-Price", etc.
        # Or let's inspect the page content for price patterns and titles
        cards_info = []
        
        # Let's search for product-like blocks
        # Let's look for tags that contain products or links to products
        # A common tag in yandex products search is <div class="ProductCard ..."> or links with href="/products/product/..."
        product_links = soup.find_all("a", href=lambda h: h and ("/products/product/" in h or "/products/product?" in h))
        print(f"Found product links count: {len(product_links)}")
        
        for a in product_links:
            # Let's print details about parents of this link or find text
            parent = a.find_parent("div")
            cards_info.append({
                "href": a["href"],
                "text": a.get_text()[:100]
            })
            
        with open("webapp/scratch/parsed_links.json", "w", encoding="utf-8") as f:
            json.dump(cards_info, f, ensure_ascii=False, indent=2)
            
        print("Parsed links saved.")
        
    except Exception as e:
        print(f"Error during parse: {e}")

if __name__ == "__main__":
    test_parse()
