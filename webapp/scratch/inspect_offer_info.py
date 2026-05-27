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
    
    response = requests.post(url, headers=headers, json=body, timeout=7)
    if response.status_code == 200:
        raw_data_b64 = response.json().get("rawData")
        xml_content = base64.b64decode(raw_data_b64).decode("utf-8")
        soup = BeautifulSoup(xml_content, "xml")
        docs = soup.find_all("doc")
        
        for idx, doc in enumerate(docs[:3], 1):
            print(f"\n--- Doc {idx} ---")
            print(f"URL: {doc.find('url').text if doc.find('url') else ''}")
            properties = doc.find("properties")
            if properties:
                offer_info_tag = properties.find("offer_info")
                if offer_info_tag:
                    try:
                        data = json.loads(offer_info_tag.text)
                        print(json.dumps(data, indent=2, ensure_ascii=False))
                    except Exception as e:
                        print("Error parsing JSON:", e)
                        print(offer_info_tag.text)
            else:
                print("No properties.")

if __name__ == "__main__":
    main()
