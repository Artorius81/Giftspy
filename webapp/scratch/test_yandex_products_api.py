import sys
import os
import base64
import requests
from bs4 import BeautifulSoup
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import config

def main():
    url = "https://searchapi.api.cloud.yandex.net/v2/web/search"
    headers = {
        "Authorization": f"Api-Key {config.YANDEX_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Try searching site:yandex.ru/products
    query = "Bosch TSM6A013B"
    search_query = f"{query} site:yandex.ru/products"
    
    body = {
        "query": {
            "searchType": "SEARCH_TYPE_RU",
            "queryText": search_query
        },
        "folderId": config.YANDEX_FOLDER_ID,
        "responseFormat": "FORMAT_XML",
        "page": 0
    }
    
    print(f"Searching: {search_query}")
    response = requests.post(url, headers=headers, json=body, timeout=7)
    if response.status_code == 200:
        raw_data_b64 = response.json().get("rawData")
        xml_content = base64.b64decode(raw_data_b64).decode("utf-8")
        soup = BeautifulSoup(xml_content, "xml")
        docs = soup.find_all("doc")
        
        results = []
        for doc in docs:
            doc_url = doc.find("url").text if doc.find("url") else ""
            title = doc.find("title").text if doc.find("title") else ""
            headline = doc.find("headline").text if doc.find("headline") else ""
            results.append({
                "url": doc_url,
                "title": title,
                "headline": headline
            })
            
        print(f"Found docs count: {len(docs)}")
        with open("webapp/scratch/yandex_products_api_results.json", "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print("Results saved.")
    else:
        print(f"Error {response.status_code}: {response.text}")

if __name__ == "__main__":
    main()
