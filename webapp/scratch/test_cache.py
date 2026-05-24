import sys
import os
import base64
import requests
from bs4 import BeautifulSoup
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import config

def extract_json_ld_from_html(html: str) -> dict | None:
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
            except Exception as e:
                continue
    except Exception as e:
        print(f"Error parsing HTML: {e}")
    return None

def main():
    url = "https://searchapi.api.cloud.yandex.net/v2/web/search"
    headers = {
        "Authorization": f"Api-Key {config.YANDEX_API_KEY}",
        "Content-Type": "application/json"
    }
    body = {
        "query": {
            "searchType": "SEARCH_TYPE_RU",
            "queryText": "Bosch TSM6A013B site:market.yandex.ru"
        },
        "folderId": config.YANDEX_FOLDER_ID,
        "responseFormat": "FORMAT_XML",
        "page": 0
    }
    
    response = requests.post(url, headers=headers, json=body, timeout=7)
    if response.status_code == 200:
        raw_data_b64 = response.json().get("rawData")
        xml_content = base64.b64decode(raw_data_b64).decode("utf-8")
        soup = BeautifulSoup(xml_content, "xml")
        docs = soup.find_all("doc")
        
        if docs:
            first_doc = docs[0]
            cache_tag = first_doc.find("saved-copy-url")
            
            if cache_tag:
                cache_url = cache_tag.text.strip()
                headers_get = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                }
                
                try:
                    resp = requests.get(cache_url, headers=headers_get, timeout=7)
                    if resp.status_code == 200:
                        details = extract_json_ld_from_html(resp.text)
                        if details:
                            # Save JSON to file safely
                            out_path = os.path.join(os.path.dirname(__file__), "extracted_data.json")
                            with open(out_path, "w", encoding="utf-8") as f:
                                json.dump(details, f, indent=2, ensure_ascii=False)
                            print(f"[OK] Extracted data saved to {out_path}")
                        else:
                            print("[WARN] Schema.org Product NOT found in cached page.")
                    else:
                        print(f"Error status code: {resp.status_code}")
                except Exception as e:
                    print(f"Failed to fetch cache URL: {e}")
            else:
                print("No saved-copy-url found.")
        else:
            print("No docs found.")
    else:
        print(f"Search API error: {response.status_code}")

if __name__ == "__main__":
    main()
