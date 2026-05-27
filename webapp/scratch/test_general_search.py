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
    
    query = "Bosch TSM6A013B"
    body = {
        "query": {
            "searchType": "SEARCH_TYPE_RU",
            "queryText": query
        },
        "folderId": config.YANDEX_FOLDER_ID,
        "responseFormat": "FORMAT_XML",
        "page": 0
    }
    
    print(f"Searching general web for: {query}")
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
            
            offer_info = None
            properties = doc.find("properties")
            if properties:
                offer_info_tag = properties.find("offer_info")
                if offer_info_tag:
                    offer_info = offer_info_tag.text
                    
            results.append({
                "url": doc_url,
                "title": title,
                "has_offer_info": offer_info is not None,
                "offer_info_preview": offer_info[:150] if offer_info else None
            })
            
        print(f"Found docs count: {len(docs)}")
        with open("webapp/scratch/general_search_results.json", "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print("Results saved.")
    else:
        print(f"Error {response.status_code}: {response.text}")

if __name__ == "__main__":
    main()
